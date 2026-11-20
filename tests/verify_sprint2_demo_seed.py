#!/usr/bin/env python3
"""S2-DBA-05 SQLite demo seed verification (all database writes are in memory)."""

from __future__ import annotations

import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SEED = (ROOT / 'scripts/migrate/seed_sprint2_demo_data.sql').read_text(encoding='utf-8')
CUSTOMERS = [
    ('C-001', 'Acme Corporation', '123 Main St, Metro City', 'Net 30', 'Active',
     'CREATED system 2026-10-01 9:00 AM'),
    ('C-002', 'Globex Industries', '456 Oak Ave, Harbor Town', 'Net 45', 'Active',
     'CREATED system 2026-10-02 10:15 AM'),
    ('C-003', 'Initech LLC', '789 Pine Rd, Silicon Valley', 'COD', 'Active',
     'EDITED user1 2026-10-13 1:01 PM'),
    ('C-004', 'Umbrella Corp', '1 Raccoon City Blvd', 'Prepaid', 'Inactive',
     'DELETED user2 2026-10-13 1:01 PM'),
    ('C-005', 'Stark Enterprises', '200 Park Avenue, New York', 'Net 15', 'Active',
     'EDITED user1 2026-10-13 1:01 PM'),
]
PRODUCTS = [
    ('P-001', 'Industrial Widget A', 'pcs', 'Active', 'CREATED system 2026-10-01 9:00 AM'),
    ('P-002', 'Steel Bracket Heavy', 'pcs', 'Active', 'CREATED system 2026-10-02 10:00 AM'),
    ('P-003', 'Lubricant Oil 5L', 'can', 'Active', 'EDITED user1 2026-10-13 1:01 PM'),
    ('P-004', 'Safety Gloves XL', 'pair', 'Inactive', 'DELETED user2 2026-10-13 1:01 PM'),
    ('P-005', 'Copper Wire 2.5mm', 'meter', 'Active', 'CREATED system 2026-10-05 3:00 PM'),
]
PRICES = [
    ('P-001', '2026-09-01', 0.50),
    ('P-001', '2026-10-01', 0.75),
    ('P-002', '2026-10-01', 0.50),
    ('P-005', '2026-10-01', 0.35),
]


def demo_rows(conn: sqlite3.Connection) -> tuple:
    return (
        conn.execute("SELECT custNo,custName,address,payTerms,status,stamp FROM CUSTOMER WHERE custNo LIKE 'C-00%' ORDER BY custNo").fetchall(),
        conn.execute("SELECT prodCode,description,unit,status,stamp FROM PRODUCT WHERE prodCode LIKE 'P-00%' ORDER BY prodCode").fetchall(),
        conn.execute("SELECT prodCode,effDate,unitPrice,status,stamp FROM PRICEHIST WHERE prodCode LIKE 'P-00%' ORDER BY prodCode,effDate").fetchall(),
    )


def verify(conn: sqlite3.Connection, label: str) -> None:
    conn.execute('PRAGMA foreign_keys = ON')
    assert conn.execute('PRAGMA foreign_keys').fetchone() == (1,)
    assert demo_rows(conn) == ([], [], []), f'{label}: demo identifiers pre-exist'
    before = tuple(conn.execute(f'SELECT count(*) FROM {table}').fetchone()[0]
                   for table in ('CUSTOMER', 'PRODUCT', 'PRICEHIST'))

    conn.executescript(SEED)
    customers, products, prices = demo_rows(conn)
    assert customers == CUSTOMERS, (label, customers)
    assert products == PRODUCTS, (label, products)
    assert [(prod, date, float(value)) for prod, date, value, _, _ in prices] == PRICES, prices
    assert all(status == 'Active' and stamp.startswith('CREATED system ')
               and len(stamp) <= 80 for _, _, _, status, stamp in prices)
    assert tuple(conn.execute(f'SELECT count(*) FROM {table}').fetchone()[0]
                 for table in ('CUSTOMER', 'PRODUCT', 'PRICEHIST')) == tuple(
                     count + delta for count, delta in zip(before, (5, 5, 4)))

    # No invented replacement for the required 0.00: preserve the positive
    # unitPrice constraint and await the team's resolution.
    assert conn.execute("SELECT count(*) FROM PRICEHIST WHERE prodCode IN ('P-003','P-004')").fetchone() == (0,)
    try:
        conn.execute("INSERT INTO PRICEHIST(prodCode,effDate,unitPrice,status,stamp) VALUES ('P-003','2026-02-01',0,'Active','TEST')")
    except sqlite3.IntegrityError as exc:
        assert 'chk_pricehist_unitprice_positive' in str(exc), str(exc)
    else:
        raise AssertionError('S2-DBA-03 zero-price restriction was bypassed')
    assert conn.execute("SELECT count(*) FROM PRICEHIST WHERE prodCode='P-003'").fetchone() == (0,)

    conn.executescript(SEED)
    assert demo_rows(conn) == (customers, products, prices), 'Rerun changed existing demo records'
    assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
    assert conn.execute('PRAGMA integrity_check').fetchone() == ('ok',)

    # As-of-date behavior from S2-DBA-02; P-003 is NULL until a compatible
    # price is approved, and P-004 remains without price as required.
    query = '''SELECT p.prodCode,
         (SELECT h.unitPrice FROM PRICEHIST h
           WHERE h.prodCode=p.prodCode AND h.effDate<=? AND h.status='Active'
           ORDER BY h.effDate DESC LIMIT 1)
         FROM PRODUCT p WHERE p.prodCode LIKE 'P-00%' ORDER BY p.prodCode'''
    assert conn.execute(query, ('2026-10-13',)).fetchall() == [
        ('P-001', .75), ('P-002', .5), ('P-003', None),
        ('P-004', None), ('P-005', .35),
    ]
    print(f'PASS {label}: five customers, five products (two soft-deleted), four valid prices, rerun-safe')


def main() -> None:
    # Test against both SQLite conventions without writing to the source DBs.
    for asset in ('HopeERP.db', 'HOPE_Model1.db'):
        source = sqlite3.connect(f'{(ROOT / asset).as_uri()}?mode=ro', uri=True)
        conn = sqlite3.connect(':memory:')
        try:
            source.backup(conn)
            verify(conn, asset)
        finally:
            conn.close()
            source.close()

    conn = sqlite3.connect(':memory:')
    try:
        conn.execute('PRAGMA foreign_keys = ON')
        for migration in (
            'migrations/001_init_core_schema.sql',
            'migrations/005_active_customer_product_views_indexes.sql',
            'migrations/006_customer_product_domain_constraints.sql',
            'migrations/007_customer_product_referential_soft_delete.sql',
        ):
            conn.executescript((ROOT / migration).read_text(encoding='utf-8'))
        verify(conn, 'fresh SQLite migration runner schema')
    finally:
        conn.close()
    print('NOTE: P-003 0.00 Active price intentionally NOT seeded; contradicts S2-DBA-03.')


if __name__ == '__main__':
    main()
