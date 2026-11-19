#!/usr/bin/env python3
"""S2-DBA-04: run SQL FK/soft-delete checks only on disposable SQLite copies."""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VERIFY_SQL = ROOT / 'db/verify/verify_customer_product_restrict.sql'
HISTORICAL_MIGRATION = ROOT / 'db/migrations/008_customer_product_referential_soft_delete.sql'
RUNNER_MIGRATION = ROOT / 'migrations/007_customer_product_referential_soft_delete.sql'
TABLES = ('CUSTOMER', 'PRODUCT', 'PRICEHIST', 'SALES', 'SALESDETAIL', 'EMPLOYEE')
FIXTURE_IDS = (
    ('CUSTOMER', 'custNo', 'C-001'),
    ('PRODUCT', 'prodCode', 'P-S2-PH'),
    ('PRODUCT', 'prodCode', 'P-S2-SD'),
    ('EMPLOYEE', 'empNo', 'E-S204'),
    ('SALES', 'transNo', 'S2V00001'),
)


def read_sections() -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current = None
    for line in VERIFY_SQL.read_text(encoding='utf-8').splitlines():
        match = re.fullmatch(r'--\s*@([a-z_]+)\s*', line.strip())
        if match:
            current = match.group(1)
            if current in sections:
                raise AssertionError(f'Duplicate SQL section: {current}')
            sections[current] = []
        elif current is not None:
            sections[current].append(line)
    expected = {
        'begin', 'setup', 'reject_customer', 'reject_product_pricehist',
        'reject_product_salesdetail', 'soft_delete', 'verify', 'rollback',
    }
    assert set(sections) == expected, set(sections)
    return sections


def statements(lines: list[str]):
    buffer = ''
    for line in lines:
        buffer += line + '\n'
        if sqlite3.complete_statement(buffer):
            yield buffer.strip()
            buffer = ''
    if buffer.strip() and not buffer.strip().startswith('--'):
        raise AssertionError(f'Incomplete verification SQL: {buffer}')


def run_section(conn: sqlite3.Connection, sections: dict, key: str) -> list[sqlite3.Cursor]:
    return [conn.execute(statement) for statement in statements(sections[key])]


def expect_restricted_delete(conn: sqlite3.Connection, sections: dict, key: str) -> None:
    conn.execute('SAVEPOINT expected_fk_failure')
    try:
        for statement in statements(sections[key]):
            try:
                conn.execute(statement)
            except sqlite3.IntegrityError as exc:
                assert 'FOREIGN KEY constraint failed' in str(exc), str(exc)
            else:
                raise AssertionError(f'{key} unexpectedly deleted a referenced record')
    finally:
        conn.execute('ROLLBACK TO expected_fk_failure')
        conn.execute('RELEASE expected_fk_failure')


def assert_foreign_keys(conn: sqlite3.Connection) -> None:
    assert conn.execute('PRAGMA foreign_keys').fetchone() == (1,), 'FK enforcement is OFF'
    for child, column, parent, parent_column in (
        ('SALES', 'custNo', 'CUSTOMER', 'custNo'),
        ('SALESDETAIL', 'prodCode', 'PRODUCT', 'prodCode'),
        ('PRICEHIST', 'prodCode', 'PRODUCT', 'prodCode'),
    ):
        foreign_keys = conn.execute(f'PRAGMA foreign_key_list("{child}")').fetchall()
        rows = [row for row in foreign_keys if row[2].upper() == parent and
                row[3].lower() == column.lower() and row[4].lower() == parent_column.lower()]
        assert len(rows) == 1, (child, column, foreign_keys)
        assert rows[0][6].upper() in ('NO ACTION', 'RESTRICT'), (child, rows)
    assert conn.execute('PRAGMA foreign_key_check').fetchall() == []


def snapshot(conn: sqlite3.Connection) -> tuple[int, ...]:
    return tuple(conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
                 for table in TABLES)


def run_disposable_verification(conn: sqlite3.Connection, label: str, sections: dict) -> None:
    conn.execute('PRAGMA foreign_keys = ON')
    assert_foreign_keys(conn)
    counts = snapshot(conn)
    for table, field, key in FIXTURE_IDS:
        assert conn.execute(f'SELECT COUNT(*) FROM "{table}" WHERE "{field}"=?',
                            (key,)).fetchone() == (0,), f'Fixture ID collision: {table}.{key}'
    try:
        run_section(conn, sections, 'begin')
        run_section(conn, sections, 'setup')
        expect_restricted_delete(conn, sections, 'reject_customer')
        expect_restricted_delete(conn, sections, 'reject_product_pricehist')
        expect_restricted_delete(conn, sections, 'reject_product_salesdetail')
        run_section(conn, sections, 'soft_delete')
        verification = run_section(conn, sections, 'verify')
        assert len(verification) == 5
        assert [cursor.fetchone()[0] for cursor in verification] == [1] * 5
        for statement, error in (
            ("UPDATE CUSTOMER SET payTerms='InvalidTerm' WHERE custNo='C-001'", 'chk_customer_payterms'),
            ("UPDATE PRODUCT SET unit='ea' WHERE prodCode='P-S2-SD'", 'chk_product_unit'),
        ):
            try:
                conn.execute(statement)
            except sqlite3.IntegrityError as exc:
                assert error in str(exc), str(exc)
            else:
                raise AssertionError(f'Domain constraint bypassed: {statement}')
        run_section(conn, sections, 'rollback')
    finally:
        if conn.in_transaction:
            conn.rollback()
    assert snapshot(conn) == counts, f'{label}: row counts changed after rollback'
    assert_foreign_keys(conn)
    for table, field, key in FIXTURE_IDS:
        assert conn.execute(f'SELECT COUNT(*) FROM "{table}" WHERE "{field}"=?',
                            (key,)).fetchone() == (0,)
    assert conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    print(f'PASS {label}: C-001 and both product FK deletes rejected; soft deletes and historical joins succeed; rollback clean')


def verify_real_history(conn: sqlite3.Connection, label: str) -> None:
    """Prove old 30D/ea records can be soft-deleted without losing sales."""
    customer = conn.execute("SELECT payTerms,status,stamp FROM CUSTOMER WHERE custNo='C0001'").fetchone()
    product = conn.execute("SELECT unit,status,stamp FROM PRODUCT WHERE prodCode='NB0005'").fetchone()
    assert customer is not None and customer[0] == '30D', customer
    assert product is not None and product[0] == 'ea', product
    sales_count = conn.execute("SELECT count(*) FROM SALES WHERE custNo='C0001'").fetchone()[0]
    details_count = conn.execute("SELECT count(*) FROM SALESDETAIL WHERE prodCode='NB0005'").fetchone()[0]
    price_count = conn.execute("SELECT count(*) FROM PRICEHIST WHERE prodCode='NB0005'").fetchone()[0]
    assert sales_count > 0 and details_count > 0 and price_count > 0
    try:
        conn.execute('BEGIN')
        for table, key, record in (('CUSTOMER', 'custNo', 'C0001'), ('PRODUCT', 'prodCode', 'NB0005')):
            try:
                conn.execute(f'DELETE FROM "{table}" WHERE "{key}"=?', (record,))
            except sqlite3.IntegrityError as exc:
                assert 'FOREIGN KEY constraint failed' in str(exc)
            else:
                raise AssertionError(f'Historical {table} deletion was not restricted')
        conn.execute("UPDATE CUSTOMER SET status='Inactive',stamp='EDITED s2-dba-04 verify' WHERE custNo='C0001'")
        conn.execute("UPDATE PRODUCT SET status='Inactive',stamp='EDITED s2-dba-04 verify' WHERE prodCode='NB0005'")
        assert conn.execute("SELECT status FROM CUSTOMER WHERE custNo='C0001'").fetchone() == ('Inactive',)
        assert conn.execute("SELECT status FROM PRODUCT WHERE prodCode='NB0005'").fetchone() == ('Inactive',)
        assert conn.execute("SELECT count(*) FROM SALES s JOIN CUSTOMER c ON s.custNo=c.custNo WHERE c.custNo='C0001'").fetchone()[0] == sales_count
        assert conn.execute("SELECT count(*) FROM SALESDETAIL d JOIN PRODUCT p ON p.prodCode=d.prodCode WHERE p.prodCode='NB0005'").fetchone()[0] == details_count
        assert conn.execute("SELECT count(*) FROM PRICEHIST h JOIN PRODUCT p ON p.prodCode=h.prodCode WHERE p.prodCode='NB0005'").fetchone()[0] == price_count
    finally:
        conn.rollback()
    assert conn.execute("SELECT payTerms,status,stamp FROM CUSTOMER WHERE custNo='C0001'").fetchone() == customer
    assert conn.execute("SELECT unit,status,stamp FROM PRODUCT WHERE prodCode='NB0005'").fetchone() == product
    assert_foreign_keys(conn)
    print(f'PASS {label}: historical C0001/ NB0005 hard-delete protected, status-only soft-delete works, links survive')


def fresh_schema(filename: str, migration: str) -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.execute('PRAGMA foreign_keys = ON')
    conn.executescript((ROOT / filename).read_text(encoding='utf-8'))
    if filename.startswith('db/'):
        conn.executescript((ROOT / 'db/seeds/002_hope_historical_data.sql').read_text(encoding='utf-8'))
        domain = 'db/migrations/007_customer_product_domain_constraints.sql'
    else:
        domain = 'migrations/007_customer_product_domain_constraints.sql'
    conn.executescript((ROOT / domain).read_text(encoding='utf-8'))
    conn.executescript((ROOT / migration).read_text(encoding='utf-8'))
    return conn


def main() -> None:
    sections = read_sections()
    for label, filename, migration in (
        ('historical DDL + sample', 'db/migrations/001_hope_base_tables.sql',
         'db/migrations/008_customer_product_referential_soft_delete.sql'),
        ('local migration runner DDL', 'migrations/001_init_core_schema.sql',
         'migrations/007_customer_product_referential_soft_delete.sql'),
    ):
        conn = fresh_schema(filename, migration)
        try:
            run_disposable_verification(conn, label, sections)
            if label.startswith('historical'):
                verify_real_history(conn, label)
        finally:
            conn.close()

    # Also validate exact bundled SQLite assets via SQLite's read-only backup
    # API. The on-disk files are never opened for write.
    for name in ('HopeERP.db', 'HOPE_Model1.db'):
        source_path = ROOT / name
        source = sqlite3.connect(f'{source_path.as_uri()}?mode=ro', uri=True)
        conn = sqlite3.connect(':memory:')
        try:
            source.backup(conn)
            conn.execute('PRAGMA foreign_keys = ON')
            conn.executescript(HISTORICAL_MIGRATION.read_text(encoding='utf-8'))
            run_disposable_verification(conn, name, sections)
            verify_real_history(conn, name)
        finally:
            conn.close()
            source.close()


if __name__ == '__main__':
    main()
