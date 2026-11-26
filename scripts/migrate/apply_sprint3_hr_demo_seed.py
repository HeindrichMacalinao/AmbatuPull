#!/usr/bin/env python3
"""Apply S3-DBA-05 PARTIAL demo seed ONLY to an existing disposable SQLite DB.

Example: python3 scripts/migrate/apply_sprint3_hr_demo_seed.py ./data/hr_demo.db --confirm-non-production
The SQL is transaction-scoped, validates conflicts, and never updates existing rows.
"""
from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / 'db/seeds/004_human_resources_seed.sql'
REQUIRED_COLUMNS = {
    'JOB': {'jobCode', 'jobDesc', 'status', 'stamp'},
    'DEPARTMENT': {'deptCode', 'deptName', 'status', 'stamp'},
    'EMPLOYEE': {'empNo', 'lastName', 'firstName', 'gender', 'birthDate', 'hireDate', 'sepDate', 'status', 'stamp'},
    'JOBHISTORY': {'empNo', 'jobCode', 'deptCode', 'effDate', 'salary', 'status', 'stamp'},
}


def verify_schema(conn: sqlite3.Connection) -> None:
    for table, expected in REQUIRED_COLUMNS.items():
        actual = {str(row[1]) for row in conn.execute(f'PRAGMA table_info("{table}")')}
        if missing := expected - actual:
            raise RuntimeError(f'Incompatible {table} schema, missing: {sorted(missing)}')
    trigger_names = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='trigger'")}
    required = {'trg_s3_employee_hr_domain_insert', 'trg_s3_hrri_history_insert'}
    if not required.issubset(trigger_names):
        raise RuntimeError('Apply S3-DBA-03/04 SQLite migrations before this seed')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('database', type=Path, help='Existing NON-PRODUCTION SQLite database')
    parser.add_argument('--confirm-non-production', action='store_true', required=True,
                        help='Acknowledge this is a disposable/non-production demo DB')
    args = parser.parse_args()
    path = args.database.resolve()
    if not path.is_file():
        parser.error('Database does not exist. Apply migrations to a disposable DB first.')
    if any(token in part.lower() for part in path.parts for token in ('production', 'prod-db')):
        parser.error('Database path looks like production; refusing to seed.')
    conn = sqlite3.connect(f'{path.as_uri()}?mode=rw', uri=True, timeout=5)
    try:
        conn.execute('PRAGMA foreign_keys=ON')
        if conn.execute('PRAGMA foreign_keys').fetchone() != (1,):
            raise RuntimeError('SQLite foreign key enforcement is not enabled')
        verify_schema(conn)
        try:
            conn.executescript(SEED.read_text(encoding='utf-8'))
        except Exception:
            conn.rollback()
            raise
        if conn.execute('PRAGMA foreign_key_check').fetchall():
            raise RuntimeError('Database has foreign-key violations after seeding')
        if conn.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('SQLite integrity check failed')
        print('PASS S3-DBA-05 partial demo seed: 4 jobs, 4 departments, 4 employees, 2 E-001 history rows')
        print('OPEN: Figure 16-17 history for E-002/E-003/E-004 and Supabase schema compatibility')
    finally:
        conn.close()


if __name__ == '__main__':
    try:
        main()
    except (sqlite3.Error, RuntimeError) as exc:
        raise SystemExit(f'S3-DBA-05 seed failed safely: {exc}') from None
