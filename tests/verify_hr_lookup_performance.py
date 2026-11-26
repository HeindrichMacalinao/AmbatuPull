#!/usr/bin/env python3
"""S3-DBA-06: test index migrations and the isolated 10k/100k SQLite benchmark.

Run from repository root:
  python3 -B tests/verify_hr_lookup_performance.py

All test databases are temporary. No checked-in or production DB is opened.
"""
from __future__ import annotations

import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def load(conn: sqlite3.Connection, relative: str) -> None:
    conn.executescript((ROOT / relative).read_text(encoding='utf-8'))


def create_runner_variant() -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.execute('PRAGMA foreign_keys=ON')
    for path in (
        'migrations/001_init_core_schema.sql',
        'migrations/008_active_hr_views_indexes.sql',
        'migrations/009_employee_jobhistory_domain_constraints.sql',
        'migrations/010_hr_referential_integrity.sql',
    ):
        load(conn, path)
    load(conn, 'db/seeds/004_human_resources_seed.sql')
    return conn


def create_historical_variant() -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.execute('PRAGMA foreign_keys=ON')
    for path in (
        'db/migrations/001_hope_base_tables.sql',
        'db/seeds/002_hope_historical_data.sql',
        'db/migrations/009_active_hr_views_indexes.sql',
        'db/migrations/010_employee_jobhistory_domain_constraints.sql',
        'db/migrations/011_hr_referential_integrity.sql',
    ):
        load(conn, path)
    load(conn, 'db/seeds/004_human_resources_seed.sql')
    return conn


def assert_index(conn: sqlite3.Connection, table: str, index: str, exists: bool) -> None:
    names = {row[1] for row in conn.execute(f'PRAGMA index_list("{table}")')}
    assert (index in names) is exists, f'{table}.{index}: expected exists={exists}, got {names}'


def verify_cycle(variant: str, conn: sqlite3.Connection, up: str, down: str, expected_tables: dict[str, list[str]]) -> None:
    try:
        for table, indexes in expected_tables.items():
            for index in indexes:
                assert_index(conn, table, index, False)
        load(conn, up)
        for table, indexes in expected_tables.items():
            for index in indexes:
                assert_index(conn, table, index, True)
        load(conn, down)
        for table, indexes in expected_tables.items():
            for index in indexes:
                assert_index(conn, table, index, False)
        load(conn, up)
        for table, indexes in expected_tables.items():
            for index in indexes:
                assert_index(conn, table, index, True)
        assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
        assert conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        print(f'PASS {variant}: index migration up/down/up and integrity checks')
    finally:
        conn.close()


def verify_benchmark_pipeline() -> None:
    with tempfile.TemporaryDirectory(prefix='s3-dba06-tests-') as tmp:
        database = Path(tmp) / 'hr_benchmark.sqlite'
        report = Path(tmp) / 'performance.md'
        generated = subprocess.run(
            [sys.executable, '-B', str(ROOT / 'scripts/benchmark/generate_hr_benchmark.py'),
             '--output', str(database), '--employees', '10000', '--history-rows', '100000',
             '--confirm-non-production'],
            cwd=ROOT, text=True, capture_output=True, timeout=180,
        )
        assert generated.returncode == 0, generated.stdout + generated.stderr
        conn = sqlite3.connect(database)
        try:
            assert conn.execute('SELECT COUNT(*) FROM EMPLOYEE').fetchone()[0] == 10_000
            assert conn.execute('SELECT COUNT(*) FROM JOBHISTORY').fetchone()[0] == 100_000
            assert conn.execute("SELECT COUNT(*) FROM EMPLOYEE WHERE status='Active' AND lastName LIKE '%Garcia%'").fetchone()[0] == 100
            assert conn.execute("SELECT COUNT(*) FROM v_active_employees WHERE empNo='E-004'").fetchone()[0] == 0
            assert conn.execute("SELECT salary FROM JOBHISTORY WHERE empNo='E-001' AND status='Active' AND effDate<='2022-12-31' ORDER BY effDate DESC LIMIT 1").fetchone()[0] == 45_000
            assert conn.execute("SELECT salary FROM JOBHISTORY WHERE empNo='E-001' AND status='Active' AND effDate<='2026-11-26' ORDER BY effDate DESC LIMIT 1").fetchone()[0] == 52_000
            assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
        finally:
            conn.close()

        profiled = subprocess.run(
            [sys.executable, '-B', str(ROOT / 'scripts/benchmark/profile_hr_queries.py'),
             '--database', str(database), '--output', str(report), '--confirm-non-production'],
            cwd=ROOT, text=True, capture_output=True, timeout=180,
        )
        assert profiled.returncode == 0, profiled.stdout + profiled.stderr
        report_text = report.read_text(encoding='utf-8')
        for expected in (
            '10,000', '100,000', 'EXPLAIN QUERY PLAN',
            'idx_jobhistory_active_empno_effdate_cover',
            'idx_employee_active_name_cover',
            'PostgreSQL plans remain pending',
            'did **not** meet the target',
        ):
            assert expected in report_text, f'Missing report content: {expected}'
        conn = sqlite3.connect(database)
        try:
            tuned_names = {row[0] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index'")}
            assert 'idx_jobhistory_active_empno_effdate_cover' not in tuned_names, 'Profiler modified its source database'
        finally:
            conn.close()
        print('PASS benchmark pipeline: 10k employees, 100k history rows, repeatable profile and report; source DB unchanged')


def main() -> None:
    runner_indexes = {
        'EMPLOYEE': ['idx_employee_active_name_cover', 'idx_employee_jobcode'],
        'JOBHISTORY': ['idx_jobhistory_jobcode', 'idx_jobhistory_deptcode', 'idx_jobhistory_active_empno_effdate_cover'],
    }
    historical_indexes = {
        'EMPLOYEE': ['idx_employee_active_name_cover'],
        'JOBHISTORY': ['idx_jobhistory_jobcode', 'idx_jobhistory_deptcode', 'idx_jobhistory_active_empno_effdate_cover'],
    }
    verify_cycle('runner SQLite', create_runner_variant(),
                 'migrations/011_hr_lookup_performance_indexes.sql',
                 'migrations/011_hr_lookup_performance_indexes.down.sql', runner_indexes)
    verify_cycle('historical SQLite', create_historical_variant(),
                 'db/migrations/012_hr_lookup_performance_indexes.sql',
                 'db/migrations/012_hr_lookup_performance_indexes.down.sql', historical_indexes)
    verify_benchmark_pipeline()
    print('ALL S3-DBA-06 SQLITE TESTS PASSED')


if __name__ == '__main__':
    main()
