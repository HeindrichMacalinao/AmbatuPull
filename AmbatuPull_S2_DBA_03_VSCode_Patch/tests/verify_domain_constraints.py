#!/usr/bin/env python3
"""S2-DBA-03 SQLite migration checks against isolated historical HOPE fixtures.

All writes happen in memory. Legacy rows are never altered or normalized.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_SQL = (ROOT / 'db/migrations/001_hope_base_tables.sql').read_text(encoding='utf-8')
SEED_SQL = (ROOT / 'db/seeds/002_hope_historical_data.sql').read_text(encoding='utf-8')
TRIGGERS = {
    'trg_customer_domain_insert', 'trg_customer_domain_update',
    'trg_product_domain_insert', 'trg_product_domain_update',
    'trg_pricehist_domain_insert', 'trg_pricehist_domain_update',
}


def assert_rejected(conn: sqlite3.Connection, sql: str, args: tuple = (), message: str | None = None) -> None:
    conn.execute('SAVEPOINT check_reject')
    try:
        try:
            conn.execute(sql, args)
        except sqlite3.IntegrityError as error:
            if message:
                assert message in str(error), (message, str(error))
        else:
            raise AssertionError(f'Database accepted an invalid write: {sql}, {args!r}')
    finally:
        conn.execute('ROLLBACK TO SAVEPOINT check_reject')
        conn.execute('RELEASE SAVEPOINT check_reject')


def assert_accepted(conn: sqlite3.Connection, sql: str, args: tuple = ()) -> None:
    conn.execute('SAVEPOINT check_accept')
    try:
        conn.execute(sql, args)
    finally:
        conn.execute('ROLLBACK TO SAVEPOINT check_accept')
        conn.execute('RELEASE SAVEPOINT check_accept')


def test_checks(conn: sqlite3.Connection) -> None:
    customer_insert = (
        'INSERT INTO CUSTOMER(custNo,custName,payTerms,status,stamp) VALUES (?,?,?,?,?)'
    )
    product_insert = (
        'INSERT INTO PRODUCT(prodCode,description,unit,status,stamp) VALUES (?,?,?,?,?)'
    )
    price_insert = (
        'INSERT INTO PRICEHIST(prodCode,effDate,unitPrice,status,stamp) VALUES (?,?,?,?,?)'
    )

    for term in ('Net 15', 'Net 30', 'Net 45', 'COD', 'Prepaid', None):
        assert_accepted(conn, customer_insert, ('C-NEW1', 'New Customer', term, 'Active', 'TEST'))
    for term in ('InvalidTerm', '30D', '', 'net 15'):
        assert_rejected(conn, customer_insert,
                        ('C-NEW1', 'New Customer', term, 'Active', 'TEST'), 'chk_customer_payterms')
    for number in ('C-123456789', '', '    ', None):
        assert_rejected(conn, customer_insert,
                        (number, 'New Customer', 'COD', 'Active', 'TEST'), 'chk_customer_custno_length')
    for name in ('', '   ', None):
        assert_rejected(conn, customer_insert,
                        ('C-NEW1', name, 'COD', 'Active', 'TEST'))
    for state in ('Inactive', 'Active'):
        assert_accepted(conn, customer_insert, ('C-NEW1', 'New Customer', 'COD', state, 'TEST'))
    assert_rejected(conn, customer_insert, ('C-NEW1', 'New Customer', 'COD', 'Archived', 'TEST'))
    print('PASS: CUSTOMER valid/invalid payment terms, ID length, nonblank name, and status')

    for unit in ('pcs', 'can', 'pair', 'meter', 'box', 'kg', 'set', None):
        assert_accepted(conn, product_insert, ('P-NEW1', 'Test Product', unit, 'Active', 'TEST'))
    for unit in ('ea', 'pc', 'liter', '', 'PCS'):
        assert_rejected(conn, product_insert,
                        ('P-NEW1', 'Test Product', unit, 'Active', 'TEST'), 'chk_product_unit')
    assert_rejected(conn, product_insert, ('P-NEW1', 'Test Product', 'pcs', 'Archived', 'TEST'))
    assert_accepted(conn, product_insert, ('P-NEW1', 'Test Product', 'pcs', 'Inactive', 'TEST'))
    print('PASS: PRODUCT valid/invalid units and status')

    # AK0001 and this historical effective date already exist in approved data.
    assert_rejected(conn, price_insert, ('AK0001', '2010-05-15', 12, 'Active', 'TEST'))
    for price in (0, -0.01, -100, 'not-a-price'):
        assert_rejected(conn, price_insert,
                        ('AK0001', '2030-01-01', price, 'Active', 'TEST'),
                        'chk_pricehist_unitprice_positive')
    for price in (0.01, 3.50, 10):
        assert_accepted(conn, price_insert, ('AK0001', '2030-01-01', price, 'Active', 'TEST'))
    assert_accepted(conn, price_insert, ('AK0001', '2030-01-01', 3.50, 'Inactive', 'TEST'))
    assert_rejected(conn, price_insert, ('AK0001', '2030-01-01', 3.50, 'Archived', 'TEST'))
    assert_rejected(conn, price_insert, ('BAD-NO-PROD', '2030-01-01', 3.50, 'Active', 'TEST'))
    print('PASS: PRICEHIST positive numeric prices, duplicate composite PK, status, and FK')

    # Updating compliant rows must validate their *new* values.
    conn.execute(customer_insert, ('C-NEW1', 'New Customer', 'COD', 'Active', 'TEST'))
    conn.execute(product_insert, ('P-NEW1', 'Test Product', 'pcs', 'Active', 'TEST'))
    conn.execute(price_insert, ('P-NEW1', '2030-01-01', 2.50, 'Active', 'TEST'))
    try:
        assert_rejected(conn, "UPDATE CUSTOMER SET payTerms='InvalidTerm' WHERE custNo='C-NEW1'",
                        message='chk_customer_payterms')
        assert_rejected(conn, "UPDATE CUSTOMER SET custName='  ' WHERE custNo='C-NEW1'",
                        message='chk_customer_name_nonempty')
        assert_rejected(conn, "UPDATE PRODUCT SET unit='ea' WHERE prodCode='P-NEW1'",
                        message='chk_product_unit')
        assert_rejected(conn, "UPDATE PRICEHIST SET unitPrice=0 WHERE prodCode='P-NEW1'",
                        message='chk_pricehist_unitprice_positive')
        assert_rejected(conn, "UPDATE PRICEHIST SET status='Archived' WHERE prodCode='P-NEW1'")
    finally:
        conn.execute("DELETE FROM PRICEHIST WHERE prodCode='P-NEW1'")
        conn.execute("DELETE FROM PRODUCT WHERE prodCode='P-NEW1'")
        conn.execute("DELETE FROM CUSTOMER WHERE custNo='C-NEW1'")
    print('PASS: UPDATE constraints reject invalid changes without altering valid rows')


def main() -> None:
    for file in (
        'migrations/006_customer_product_domain_constraints.sql',
        'db/migrations/007_customer_product_domain_constraints.sql',
    ):
        conn = sqlite3.connect(':memory:')
        try:
            conn.execute('PRAGMA foreign_keys = ON')
            conn.executescript(BASE_SQL)
            conn.executescript(SEED_SQL)
            baseline = tuple(conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
                             for table in ('CUSTOMER', 'PRODUCT', 'PRICEHIST'))
            forward = (ROOT / file).read_text(encoding='utf-8')
            conn.executescript(forward)
            conn.executescript(forward)  # Idempotent schema installation.
            existing = {row[0] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='trigger'")}
            assert TRIGGERS.issubset(existing)
            assert baseline == (82, 57, 79)
            assert conn.execute("SELECT COUNT(*) FROM CUSTOMER WHERE payTerms IN ('30D','45D')").fetchone()[0] == 58
            assert conn.execute("SELECT COUNT(*) FROM PRODUCT WHERE unit IN ('ea','pc')").fetchone()[0] == 57
            test_checks(conn)
            assert baseline == tuple(conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
                                     for table in ('CUSTOMER', 'PRODUCT', 'PRICEHIST'))
            assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
            assert conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
            print(f'PASS: {file}: repeated apply, preserved historical data, intact FKs')
        finally:
            conn.close()

    # Paired migration rollback must remove ONLY task-specific enforcement.
    conn = sqlite3.connect(':memory:')
    try:
        conn.executescript(BASE_SQL)
        conn.executescript((ROOT / 'migrations/006_customer_product_domain_constraints.sql').read_text())
        conn.executescript((ROOT / 'migrations/006_customer_product_domain_constraints.down.sql').read_text())
        names = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='trigger'")}
        assert not TRIGGERS.intersection(names)
        assert_accepted(conn, "INSERT INTO CUSTOMER(custNo,custName,payTerms,stamp) VALUES ('C-123','Test','InvalidTerm','TEST')")
        assert_rejected(conn, "INSERT INTO PRODUCT(prodCode,description,unit,status,stamp) VALUES ('TEST','Test','pcs','Archived','TEST')")
        print('PASS: SQLite down migration is reversible; pre-existing status CHECK persists')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
