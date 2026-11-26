#!/usr/bin/env python3
"""Build a fresh, disposable SQLite HR benchmark database with synthetic data.

Example (from repository root):
  python3 -B scripts/benchmark/generate_hr_benchmark.py \
    --output ./data/hr_s3_dba06_benchmark.sqlite \
    --employees 10000 --history-rows 100000 --confirm-non-production

The script refuses to overwrite an existing file and requires an explicit
non-production acknowledgement. It applies the repository's S3-DBA-01/03/04
SQLite migrations and the available S3-DBA-05 demo seed before adding synthetic
records. It never opens HopeERP.db, HOPE_Model1.db, or a Supabase connection.
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import tempfile
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REQUIRED_FILES = (
    'migrations/001_init_core_schema.sql',
    'migrations/008_active_hr_views_indexes.sql',
    'migrations/009_employee_jobhistory_domain_constraints.sql',
    'migrations/010_hr_referential_integrity.sql',
    'db/seeds/004_human_resources_seed.sql',
)
BENCHMARK_JOBS = tuple((f'BJOB-{i:02d}', f'Benchmark Job {i}', 'Active', 'BENCHMARK_FIXTURE') for i in range(1, 5))
BENCHMARK_DEPARTMENTS = tuple((f'BDEP-{i:02d}', f'Benchmark Department {i}', 'Active', 'BENCHMARK_FIXTURE') for i in range(1, 5))


def refuse_production_path(path: Path) -> None:
    parts = [part.casefold() for part in path.parts]
    if any(part == 'prod' or 'production' in part or part.startswith(('prod-', 'prod_')) for part in parts):
        raise SystemExit('Refusing a path that looks like production. Choose a disposable local test path.')


def load_sql(conn: sqlite3.Connection, relative: str) -> None:
    path = ROOT / relative
    if not path.is_file():
        raise SystemExit(f'Missing prerequisite {relative}. Apply/restore the S3-DBA-01/03/04/05 files first.')
    conn.executescript(path.read_text(encoding='utf-8'))


def date_text(value: date) -> str:
    return value.isoformat()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True, help='New SQLite benchmark DB path; existing files are never overwritten')
    parser.add_argument('--employees', type=int, default=10_000, help='Total employee rows including the four S3-DBA-05 demo employees')
    parser.add_argument('--history-rows', type=int, default=100_000, help='Total JOBHISTORY rows including the two supplied E-001 rows')
    parser.add_argument('--confirm-non-production', action='store_true', required=True, help='Acknowledge that this is a disposable local/test database')
    args = parser.parse_args()

    if args.employees < 5 or args.history_rows < 3:
        parser.error('Use at least 5 employees and 3 history rows so synthetic records can be generated.')

    output = args.output.expanduser().resolve()
    refuse_production_path(output)
    if output.exists():
        parser.error(f'Refusing to overwrite existing file: {output}')
    output.parent.mkdir(parents=True, exist_ok=True)

    fd, temp_name = tempfile.mkstemp(prefix='.hr-benchmark-', suffix='.sqlite', dir=output.parent)
    os.close(fd)
    temporary = Path(temp_name)
    try:
        conn = sqlite3.connect(temporary)
        try:
            conn.execute('PRAGMA foreign_keys = ON')
            conn.execute('PRAGMA journal_mode = WAL')
            for relative in REQUIRED_FILES[:4]:
                load_sql(conn, relative)
            load_sql(conn, REQUIRED_FILES[4])

            if conn.execute('PRAGMA foreign_keys').fetchone()[0] != 1:
                raise RuntimeError('SQLite foreign-key enforcement is not enabled')

            existing_employees = conn.execute('SELECT COUNT(*) FROM EMPLOYEE').fetchone()[0]
            existing_history = conn.execute('SELECT COUNT(*) FROM JOBHISTORY').fetchone()[0]
            if existing_employees != 4 or existing_history != 2:
                raise RuntimeError(
                    'Expected only the four S3-DBA-05 demo employees and two E-001 history rows '
                    f'before benchmark generation; found {existing_employees} employees and {existing_history} history rows.'
                )

            synthetic_employee_count = args.employees - existing_employees
            synthetic_history_count = args.history_rows - existing_history
            base_rows, extra_rows = divmod(synthetic_history_count, synthetic_employee_count)
            if base_rows < 1:
                parser.error('history-rows must provide at least one synthetic history row per synthetic employee.')

            conn.execute('BEGIN IMMEDIATE')
            conn.executemany(
                'INSERT INTO JOB(jobCode,jobDesc,status,stamp) VALUES(?,?,?,?)',
                BENCHMARK_JOBS,
            )
            conn.executemany(
                'INSERT INTO DEPARTMENT(deptCode,deptName,status,stamp) VALUES(?,?,?,?)',
                BENCHMARK_DEPARTMENTS,
            )

            employee_rows = []
            history_rows = []
            origin = date(2010, 1, 1)
            birth_origin = date(1970, 1, 1)
            for offset in range(synthetic_employee_count):
                ordinal = offset + 5  # E-001..E-004 belong to the supplied demo seed.
                emp_no = f'E-{ordinal:06d}'
                hire_date = origin + timedelta(days=(offset * 7) % 1825)
                birth_date = birth_origin + timedelta(days=(offset * 17) % 7000)
                is_inactive = (offset % 20 == 0)
                status = 'Inactive' if is_inactive else 'Active'
                sep_date = date_text(hire_date + timedelta(days=3650 + 1)) if is_inactive else None
                last_name = f'GarciaBench{ordinal:06d}' if offset % 100 == 1 else f'SyntheticSurname{offset % 10000:05d}'
                first_name = f'SyntheticFirst{ordinal:06d}'
                gender = ('M', 'F', 'O')[offset % 3]
                history_count = base_rows + (1 if offset < extra_rows else 0)
                latest_active_index = max(i for i in range(history_count) if i % 5 != 0)
                latest_job = f'BJOB-{((offset + latest_active_index) % 4) + 1:02d}'
                latest_dept = f'BDEP-{((offset + latest_active_index) % 4) + 1:02d}'
                employee_rows.append((
                    emp_no, last_name, first_name, gender, date_text(birth_date),
                    date_text(hire_date), sep_date, latest_dept, latest_job,
                    status, 'BENCHMARK_FIXTURE',
                ))

                for history_index in range(history_count):
                    job_number = ((offset + history_index) % 4) + 1
                    dept_number = ((offset + history_index) % 4) + 1
                    effective_date = hire_date + timedelta(days=365 * history_index)
                    history_status = 'Inactive' if history_index % 5 == 0 else 'Active'
                    salary = 35_000 + ((offset * 13) % 25_000) + history_index * 750
                    history_rows.append((
                        emp_no, f'BJOB-{job_number:02d}', f'BDEP-{dept_number:02d}',
                        date_text(effective_date), salary, history_status, 'BENCHMARK_FIXTURE',
                    ))

            conn.executemany(
                '''INSERT INTO EMPLOYEE
                   (empNo,lastName,firstName,gender,birthDate,hireDate,sepDate,deptCode,jobCode,status,stamp)
                   VALUES(?,?,?,?,?,?,?,?,?,?,?)''',
                employee_rows,
            )
            conn.executemany(
                '''INSERT INTO JOBHISTORY
                   (empNo,jobCode,deptCode,effDate,salary,status,stamp)
                   VALUES(?,?,?,?,?,?,?)''',
                history_rows,
            )
            conn.execute('''CREATE TABLE benchmark_metadata (
                fixture_name TEXT PRIMARY KEY,
                employee_count INTEGER NOT NULL,
                history_count INTEGER NOT NULL,
                note TEXT NOT NULL
            )''')
            conn.execute(
                'INSERT INTO benchmark_metadata VALUES(?,?,?,?)',
                ('S3-DBA-06 synthetic HR benchmark', args.employees, args.history_rows,
                 'Fake records only; local disposable SQLite fixture; no production data.'),
            )
            conn.commit()

            conn.execute('ANALYZE')
            fk_errors = conn.execute('PRAGMA foreign_key_check').fetchall()
            integrity = conn.execute('PRAGMA integrity_check').fetchone()[0]
            actual_employees = conn.execute('SELECT COUNT(*) FROM EMPLOYEE').fetchone()[0]
            actual_history = conn.execute('SELECT COUNT(*) FROM JOBHISTORY').fetchone()[0]
            if fk_errors or integrity != 'ok' or (actual_employees, actual_history) != (args.employees, args.history_rows):
                raise RuntimeError(
                    f'Benchmark validation failed: employees={actual_employees}, history={actual_history}, '
                    f'foreign_key_errors={len(fk_errors)}, integrity={integrity}'
                )
            conn.execute('PRAGMA wal_checkpoint(TRUNCATE)')
        finally:
            conn.close()
        os.replace(temporary, output)
        print(f'CREATED disposable benchmark database: {output}')
        print(f'EMPLOYEE rows: {args.employees:,}')
        print(f'JOBHISTORY rows: {args.history_rows:,}')
        print('Synthetic fixture uses valid ISO dates, allowed gender/status values, nonnegative salaries, active parent jobs/departments, and existing HR triggers.')
        print('No source DB, production DB, or Supabase database was opened or modified.')
    finally:
        if temporary.exists():
            temporary.unlink()
        # SQLite WAL sidecars are removed when the connection closes/checkpoints.
        for suffix in ('-wal', '-shm'):
            sidecar = Path(str(temporary) + suffix)
            if sidecar.exists():
                sidecar.unlink()


if __name__ == '__main__':
    main()
