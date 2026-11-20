#!/usr/bin/env python3
"""Safely apply S2-DBA-05 SQLite seed to an existing, explicitly named DB."""

from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path


SQL_FILE = Path(__file__).with_name('seed_sprint2_demo_data.sql')

# Refuse to mask conflicting existing demo IDs. The SQL's ON CONFLICT DO NOTHING
# is for *identical reruns*, not silently accepting different user data.
CUSTOMERS = {
    'C-001': ('Acme Corporation', '123 Main St, Metro City', 'Net 30', 'Active', 'CREATED system 2026-10-01 9:00 AM'),
    'C-002': ('Globex Industries', '456 Oak Ave, Harbor Town', 'Net 45', 'Active', 'CREATED system 2026-10-02 10:15 AM'),
    'C-003': ('Initech LLC', '789 Pine Rd, Silicon Valley', 'COD', 'Active', 'EDITED user1 2026-10-13 1:01 PM'),
    'C-004': ('Umbrella Corp', '1 Raccoon City Blvd', 'Prepaid', 'Inactive', 'DELETED user2 2026-10-13 1:01 PM'),
    'C-005': ('Stark Enterprises', '200 Park Avenue, New York', 'Net 15', 'Active', 'EDITED user1 2026-10-13 1:01 PM'),
}
PRODUCTS = {
    'P-001': ('Industrial Widget A', 'pcs', 'Active', 'CREATED system 2026-10-01 9:00 AM'),
    'P-002': ('Steel Bracket Heavy', 'pcs', 'Active', 'CREATED system 2026-10-02 10:00 AM'),
    'P-003': ('Lubricant Oil 5L', 'can', 'Active', 'EDITED user1 2026-10-13 1:01 PM'),
    'P-004': ('Safety Gloves XL', 'pair', 'Inactive', 'DELETED user2 2026-10-13 1:01 PM'),
    'P-005': ('Copper Wire 2.5mm', 'meter', 'Active', 'CREATED system 2026-10-05 3:00 PM'),
}
PRICES = {
    ('P-001', '2026-09-01'): 0.50,
    ('P-001', '2026-10-01'): 0.75,
    ('P-002', '2026-10-01'): 0.50,
    ('P-005', '2026-10-01'): 0.35,
}


def check_conflicts(conn: sqlite3.Connection) -> None:
    checks = (
        ('CUSTOMER', 'custNo', 'custName,address,payTerms,status,stamp', CUSTOMERS),
        ('PRODUCT', 'prodCode', 'description,unit,status,stamp', PRODUCTS),
    )
    for table, key, fields, expected in checks:
        for record_id, wanted in expected.items():
            row = conn.execute(f'SELECT {fields} FROM {table} WHERE {key}=?', (record_id,)).fetchone()
            if row is not None and tuple(row) != wanted:
                raise RuntimeError(f'Refusing to overwrite/ignore different existing {table} {record_id}')
    for (code, date), amount in PRICES.items():
        row = conn.execute(
            'SELECT unitPrice,status,stamp FROM PRICEHIST WHERE prodCode=? AND effDate=?',
            (code, date),
        ).fetchone()
        if row is not None and (row[0] != amount or row[1] != 'Active' or not row[2]):
            raise RuntimeError(f'Refusing to overwrite/ignore different existing PRICEHIST {code} {date}')
    for code in ('P-003', 'P-004'):
        if conn.execute('SELECT count(*) FROM PRICEHIST WHERE prodCode=?', (code,)).fetchone()[0]:
            raise RuntimeError(f'{code} already has price history; no approved compatible figure is available')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('database', type=Path, help='existing SQLite DB path (will never be created)')
    args = parser.parse_args()
    db_path = args.database.resolve()
    if not db_path.is_file():
        parser.error(f'Database does not exist: {db_path}; run migrations first')

    conn = sqlite3.connect(f'{db_path.as_uri()}?mode=rw', uri=True)
    try:
        conn.execute('PRAGMA foreign_keys = ON')
        if conn.execute('PRAGMA foreign_keys').fetchone() != (1,):
            raise RuntimeError('SQLite foreign keys must be enabled')
        required = {'trg_customer_domain_insert', 'trg_product_domain_insert',
                    'trg_pricehist_domain_insert'}
        present = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='trigger'")}
        if not required.issubset(present):
            raise RuntimeError('S2-DBA-03 constraints missing; apply ordered migrations first')
        check_conflicts(conn)
        try:
            conn.executescript(SQL_FILE.read_text(encoding='utf-8'))
        except sqlite3.Error:
            conn.rollback()
            raise
        check_conflicts(conn)
        if conn.execute('PRAGMA foreign_key_check').fetchall():
            raise RuntimeError('Existing foreign-key violations detected after seeding')
        print(f'PASS: seeded/reverified five customers, five products, four eligible prices in {db_path}')
        print('P-003 0.00 Active price omitted: conflicts with S2-DBA-03 unitPrice > 0.')
    finally:
        conn.close()


if __name__ == '__main__':
    try:
        main()
    except (sqlite3.Error, RuntimeError) as error:
        raise SystemExit(f'S2-DBA-05 seed aborted: {error}') from None
