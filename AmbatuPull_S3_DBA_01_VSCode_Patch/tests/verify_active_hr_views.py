#!/usr/bin/env python3
"""S3-DBA-01: verify both SQLite schema variants without altering real DBs.

Run from project root: python3 -B tests/verify_active_hr_views.py
"""
from __future__ import annotations

import shutil
import sqlite3
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIEWS = {
    'v_active_employees': 'EMPLOYEE',
    'v_active_jobs': 'JOB',
    'v_active_departments': 'DEPARTMENT',
    'v_active_jobhistory': 'JOBHISTORY',
}
INDEXES = {
    'idx_employee_status_lastname_firstname': ('EMPLOYEE', ('status', 'lastName', 'firstName')),
    'idx_job_status_jobcode': ('JOB', ('status', 'jobCode')),
    'idx_department_status_deptcode': ('DEPARTMENT', ('status', 'deptCode')),
    'idx_jobhistory_empno_effdate_status': ('JOBHISTORY', ('empNo', 'effDate', 'status')),
}
PLAN_QUERIES = (
    ('SELECT empNo FROM v_active_employees ORDER BY lastName, firstName', 'idx_employee_status_lastname_firstname'),
    ('SELECT jobCode FROM v_active_jobs ORDER BY jobCode', 'idx_job_status_jobcode'),
    ('SELECT deptCode FROM v_active_departments ORDER BY deptCode', 'idx_department_status_deptcode'),
    ("SELECT empNo, effDate FROM v_active_jobhistory WHERE empNo='S3E-A' ORDER BY effDate", 'idx_jobhistory_empno_effdate_status'),
)


def setup_rows(conn: sqlite3.Connection) -> None:
    # Uses only columns confirmed in BOTH archived SQLite core migrations.
    for status, suffix in [('Active', 'A'), ('Inactive', 'I')]:
        conn.execute('INSERT INTO JOB(jobCode,jobDesc,status,stamp) VALUES (?,?,?,?)',
                     (f'S3J-{suffix}', f'HR test job {suffix}', status, 'TEST'))
        conn.execute('INSERT INTO DEPARTMENT(deptCode,deptName,status,stamp) VALUES (?,?,?,?)',
                     (f'S3D-{suffix}', f'HR test dept {suffix}', status, 'TEST'))
        conn.execute('INSERT INTO EMPLOYEE(empNo,lastName,firstName,hireDate,status,stamp) '
                     'VALUES (?,?,?,?,?,?)',
                     (f'S3E-{suffix}', f'Test {suffix}', 'Employee', '2026-01-01', status, 'TEST'))
        conn.execute('INSERT INTO JOBHISTORY(empNo,jobCode,effDate,salary,deptCode,status,stamp) '
                     'VALUES (?,?,?,?,?,?,?)',
                     (f'S3E-{suffix}', f'S3J-{suffix}', '2026-02-01', 1000.00,
                      f'S3D-{suffix}', status, 'TEST'))


def check_views_indexes(conn: sqlite3.Connection) -> None:
    for view, table in VIEWS.items():
        v = conn.execute("SELECT type, sql FROM sqlite_master WHERE name=?", (view,)).fetchone()
        assert v and v[0] == 'view', f'{view}: missing view'
        assert "status = 'Active'" in v[1], f'{view}: missing active predicate'
        view_cols = tuple(row[1] for row in conn.execute(f'PRAGMA table_info("{view}")'))
        table_cols = tuple(row[1] for row in conn.execute(f'PRAGMA table_info("{table}")'))
        assert view_cols == table_cols, f'{view}: must expose ALL underlying columns'
        active = conn.execute(f"SELECT count(*) FROM {table} WHERE status='Active'").fetchone()[0]
        visible = conn.execute(f'SELECT count(*) FROM {view}').fetchone()[0]
        assert active == visible, f'{view}: active count mismatch'
        assert conn.execute(f"SELECT count(*) FROM {view} WHERE status!='Active'").fetchone()[0] == 0
        assert conn.execute(f'SELECT 1 FROM {view} WHERE status=?', ('Inactive',)).fetchone() is None
        print(f'PASS {view}: all {len(view_cols)} columns, {visible} active records, no inactive records')

    for name, (table, expected) in INDEXES.items():
        assert name in [row[1] for row in conn.execute(f'PRAGMA index_list("{table}")')]
        cols = tuple(row[2] for row in conn.execute(f'PRAGMA index_info("{name}")'))
        assert cols == expected, f'{name}: wrong columns {cols}'
        print(f'PASS {name}: {cols}')
    for sql, expected_index in PLAN_QUERIES:
        plan = ' | '.join(row[3] for row in conn.execute('EXPLAIN QUERY PLAN ' + sql))
        assert expected_index in plan, f'{expected_index}: planner did not use index: {plan}'
        print(f'PASS EXPLAIN: {plan}')
    assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
    assert conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'


def verify_variant(label: str, core: str, up: str) -> None:
    conn = sqlite3.connect(':memory:')
    try:
        conn.execute('PRAGMA foreign_keys=ON')
        conn.executescript((ROOT / core).read_text(encoding='utf8'))
        for table in VIEWS.values():
            cols = tuple(row[1] for row in conn.execute(f'PRAGMA table_info("{table}")'))
            assert 'status' in cols, f'{table}: status not present'
        setup_rows(conn)
        before = {table: conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
                  for table in VIEWS.values()}
        conn.executescript((ROOT / up).read_text(encoding='utf8'))
        check_views_indexes(conn)
        down = (ROOT / 'migrations/008_active_hr_views_indexes.down.sql').read_text(encoding='utf8')
        conn.executescript('BEGIN;\n' + down + '\nCOMMIT;')
        for view in VIEWS:
            assert conn.execute('SELECT 1 FROM sqlite_master WHERE name=?', (view,)).fetchone() is None
        for index in INDEXES:
            assert conn.execute('SELECT 1 FROM sqlite_master WHERE name=?', (index,)).fetchone() is None
        for table in VIEWS.values():
            assert conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] == before[table]
        # Original indexes must survive down, including idx_employee_status in main schema.
        if label == 'local-runner':
            assert conn.execute("SELECT 1 FROM sqlite_master WHERE name='idx_employee_status'").fetchone()
        conn.executescript((ROOT / up).read_text(encoding='utf8'))
        check_views_indexes(conn)
        print(f'PASS {label}: up/down/up, no data loss, FK/integrity OK')
    finally:
        conn.close()


def verify_node_runner() -> None:
    if not shutil.which('node'):
        print('SKIP node migration runner: node executable not installed')
        return
    with tempfile.TemporaryDirectory(prefix='s3-dba-01-') as tmp:
        tmpdir = Path(tmp)
        db = tmpdir / 'test.db'
        migrations = tmpdir / 'migrations'
        migrations.mkdir()
        for name in ('008_active_hr_views_indexes.sql', '008_active_hr_views_indexes.down.sql'):
            shutil.copyfile(ROOT / 'migrations' / name, migrations / name)
        conn = sqlite3.connect(db)
        try:
            conn.executescript((ROOT / 'migrations/001_init_core_schema.sql').read_text())
        finally:
            conn.close()
        for cmd in ('up', 'down', 'up', 'status'):
            proc = subprocess.run(['node', str(ROOT / 'scripts/migrate/index.js'), cmd,
                                   f'--db={db}', f'--dir={migrations}'], cwd=ROOT,
                                  capture_output=True, text=True, timeout=30)
            if proc.returncode != 0:
                raise AssertionError(f'Node runner {cmd} failed: {proc.stdout}\n{proc.stderr}')
            print(f'PASS Node runner: {cmd}')
        conn = sqlite3.connect(db)
        try:
            check_views_indexes(conn)
            assert conn.execute("SELECT count(*) FROM schema_migrations WHERE version LIKE '008%' ").fetchone()[0] == 1
        finally:
            conn.close()


def main() -> None:
    print(f'SQLite version: {sqlite3.sqlite_version}; testing disposable databases only')
    verify_variant('local-runner', 'migrations/001_init_core_schema.sql',
                   'migrations/008_active_hr_views_indexes.sql')
    verify_variant('historical-asset', 'db/migrations/001_hope_base_tables.sql',
                   'db/migrations/009_active_hr_views_indexes.sql')
    verify_node_runner()
    print('ALL S3-DBA-01 SQLITE CHECKS PASSED')


if __name__ == '__main__':
    main()
