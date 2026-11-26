#!/usr/bin/env python3
"""S3-DBA-05: test only in-memory SQLite variants; no project DB writes.

python3 -B tests/verify_sprint3_hr_demo_seed.py
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED = (ROOT / 'db/seeds/004_human_resources_seed.sql').read_text(encoding='utf8')
STAMP = 'SEED S3-DBA-05'


def create(variant: str) -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.execute('PRAGMA foreign_keys=ON')
    paths = (
        ['migrations/001_init_core_schema.sql',
         'migrations/008_active_hr_views_indexes.sql',
         'migrations/009_employee_jobhistory_domain_constraints.sql',
         'migrations/010_hr_referential_integrity.sql']
        if variant == 'runner' else
        ['db/migrations/001_hope_base_tables.sql',
         'db/seeds/002_hope_historical_data.sql',
         'db/migrations/009_active_hr_views_indexes.sql',
         'db/migrations/010_employee_jobhistory_domain_constraints.sql',
         'db/migrations/011_hr_referential_integrity.sql']
    )
    for path in paths:
        conn.executescript((ROOT / path).read_text(encoding='utf8'))
    return conn


def snapshot(conn: sqlite3.Connection):
    ids = {
        'JOB': ('jobCode', ('J-001','J-002','J-003','J-004')),
        'DEPARTMENT': ('deptCode', ('D-001','D-002','D-003','D-004')),
        'EMPLOYEE': ('empNo', ('E-001','E-002','E-003','E-004')),
        'JOBHISTORY': ('empNo', ('E-001','E-002','E-003','E-004')),
    }
    result = {}
    for table,(column,keys) in ids.items():
        result[table] = conn.execute(f'SELECT * FROM {table} WHERE {column} IN (?,?,?,?) ORDER BY 1,2,3',keys).fetchall()
    return result


def test_variant(variant: str):
    conn = create(variant)
    try:
        # Existing schema constraints and S3-DBA-04 triggers must remain active.
        for name in ('trg_s3_employee_hr_domain_insert','trg_s3_hrri_history_insert'):
            assert conn.execute('SELECT COUNT(*) FROM sqlite_master WHERE type="trigger" AND name=?',(name,)).fetchone()[0] == 1
        before_baseline = {t:conn.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0] for t in ('JOB','DEPARTMENT','EMPLOYEE','JOBHISTORY')}
        conn.executescript(SEED)
        original = snapshot(conn)
        assert tuple(len(original[t]) for t in ('JOB','DEPARTMENT','EMPLOYEE','JOBHISTORY')) == (4,4,4,2)
        assert conn.execute("SELECT lastName,firstName,gender,birthDate,hireDate,sepDate,status,stamp FROM EMPLOYEE WHERE empNo='E-004'").fetchone() == ('Garcia','Pedro','M','1985-08-30','2018-05-01','2025-12-31','Inactive',STAMP)
        assert conn.execute("SELECT COUNT(*) FROM v_active_employees WHERE empNo='E-004'").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM v_active_employees WHERE empNo IN ('E-001','E-002','E-003')").fetchone()[0] == 3
        assert conn.execute("SELECT COUNT(*) FROM v_active_jobs WHERE jobCode='J-004'").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM v_active_departments WHERE deptCode='D-004'").fetchone()[0] == 0
        history = conn.execute("SELECT effDate,jobCode,deptCode,salary,status FROM JOBHISTORY WHERE empNo='E-001' ORDER BY effDate").fetchall()
        assert history == [('2020-03-01','J-001','D-001',45000,'Active'),('2023-01-01','J-001','D-001',52000,'Active')]
        for day, want in [('2026-11-26',52000),('2022-12-31',45000),('2019-01-01',None)]:
            row = conn.execute("SELECT salary FROM JOBHISTORY WHERE empNo=? AND status='Active' AND effDate<=? ORDER BY effDate DESC LIMIT 1",('E-001',day)).fetchone()
            assert (row[0] if row else None) == want
        for employee in ('E-002','E-003','E-004'):
            assert conn.execute('SELECT COUNT(*) FROM JOBHISTORY WHERE empNo=?',(employee,)).fetchone()[0] == 0
        conn.executescript(SEED)
        assert snapshot(conn) == original, 'Rerun changed existing seed records'
        for table, count in [('JOB',4),('DEPARTMENT',4),('EMPLOYEE',4),('JOBHISTORY',2)]:
            assert conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] == before_baseline[table]+count
        assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
        assert conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        # No seeded record may become inconsistent merely because ON CONFLICT skips.
        conn.execute("UPDATE JOB SET jobDesc='Tampered' WHERE jobCode='J-002'")
        try:
            try:
                conn.executescript(SEED)
            except sqlite3.IntegrityError:
                pass
            else:
                raise AssertionError('Preflight failed to detect changed Job value')
        finally:
            conn.rollback()
        assert conn.execute('SELECT COUNT(*) FROM JOB WHERE jobCode="J-002"').fetchone()[0] == 1
        print(f'PASS {variant}: two runs identical; figures provided verified; conflict rejected; FK integrity retained')
    finally:
        conn.close()


def main():
    for variant in ('runner','historical'):
        test_variant(variant)
    print('PASS S3-DBA-05 partial seed: both SQLite schema variants')
    print('INCOMPLETE: Figures 16-17 unavailable; PG schema mismatch; full acceptance not claimed')


if __name__=='__main__':
    main()
