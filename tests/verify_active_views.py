#!/usr/bin/env python3
<<<<<<< HEAD
"""Verify active customer/product views and their SQLite indexes."""
=======
"""S2-DBA-01: validate SQLite views/indexes with approved HOPE historical rows.

Run from the repository root: python tests/verify_active_views.py
Uses in-memory databases; no user accounts, credentials, or production data changed.
"""
>>>>>>> origin/main
from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIEW_COLUMNS = {
    'v_active_customer': ('custNo', 'custName', 'address', 'payTerms', 'status', 'stamp'),
    'v_active_product': ('prodCode', 'description', 'unit', 'status', 'stamp'),
}
INDEXES = {
    'CUSTOMER': ('idx_customer_status_custname', ('status', 'custName')),
    'PRODUCT': ('idx_product_status_description', ('status', 'description')),
    'PRICEHIST': ('idx_pricehist_prodcode_effdate_status', ('prodCode', 'effDate', 'status')),
}


def assert_schema_and_query_plans(conn: sqlite3.Connection) -> None:
    for view, columns in VIEW_COLUMNS.items():
<<<<<<< HEAD
        row = conn.execute(
            "SELECT type, sql FROM sqlite_master WHERE name=?", (view,)
        ).fetchone()
        assert row and row[0] == 'view', f'{view} is missing'
        actual = tuple(
            column[0] for column in conn.execute(f'SELECT * FROM {view} LIMIT 0').description
        )
=======
        row = conn.execute("SELECT type, sql FROM sqlite_master WHERE name=?", (view,)).fetchone()
        assert row and row[0] == 'view', f'{view} is missing'
        actual = tuple(col[0] for col in conn.execute(f'SELECT * FROM {view} LIMIT 0').description)
>>>>>>> origin/main
        assert actual == columns, f'{view}: wrong columns {actual}'
        assert "status = 'Active'" in row[1], f'{view}: missing active filter'

    for table, (index, columns) in INDEXES.items():
<<<<<<< HEAD
        existing = {
            item[1] for item in conn.execute(f'PRAGMA index_list("{table}")')
        }
        assert index in existing, f'{table}: missing {index}'
        actual = tuple(
            item[2] for item in conn.execute(f'PRAGMA index_info("{index}")')
        )
=======
        existing = {item[1] for item in conn.execute(f'PRAGMA index_list("{table}")')}
        assert index in existing, f'{table}: missing {index}'
        actual = tuple(item[2] for item in conn.execute(f'PRAGMA index_info("{index}")'))
>>>>>>> origin/main
        assert actual == columns, f'{index}: wrong columns {actual}'

    plans = {
        'customer': (
            'SELECT custNo FROM v_active_customer WHERE custName = ?',
<<<<<<< HEAD
            ('Globus Medical, Inc',),
            'idx_customer_status_custname',
=======
            ('Globus Medical, Inc',), 'idx_customer_status_custname',
>>>>>>> origin/main
        ),
        'product': (
            'SELECT prodCode FROM v_active_product WHERE description = ?',
            (conn.execute('SELECT description FROM PRODUCT LIMIT 1').fetchone()[0],),
            'idx_product_status_description',
        ),
        'price': (
            'SELECT COUNT(*) FROM PRICEHIST WHERE prodCode = ? AND status = ?',
            (conn.execute('SELECT prodCode FROM PRICEHIST LIMIT 1').fetchone()[0], 'Active'),
            'idx_pricehist_prodcode_effdate_status',
        ),
    }
    for label, (sql, params, index) in plans.items():
<<<<<<< HEAD
        plan = ' | '.join(
            row[3] for row in conn.execute('EXPLAIN QUERY PLAN ' + sql, params)
        )
=======
        plan = ' | '.join(row[3] for row in conn.execute('EXPLAIN QUERY PLAN ' + sql, params))
>>>>>>> origin/main
        assert index in plan, f'{label}: query did not use {index}: {plan}'
        print(f'PASS: EXPLAIN {label}: {plan}')


def assert_active_only(conn: sqlite3.Connection) -> None:
    for table, view, key in (
        ('CUSTOMER', 'v_active_customer', 'custNo'),
        ('PRODUCT', 'v_active_product', 'prodCode'),
    ):
<<<<<<< HEAD
        active_count = conn.execute(
            f"SELECT COUNT(*) FROM {table} WHERE status='Active'"
        ).fetchone()[0]
        visible_count = conn.execute(f'SELECT COUNT(*) FROM {view}').fetchone()[0]
        assert active_count == visible_count and active_count > 0, (
            f'{view}: baseline count mismatch'
        )
        assert conn.execute(
            f"SELECT COUNT(*) FROM {view} WHERE status!='Active'"
        ).fetchone()[0] == 0

        record_id = conn.execute(f'SELECT {key} FROM {view} LIMIT 1').fetchone()[0]
        conn.execute(f"UPDATE {table} SET status='Inactive' WHERE {key}=?", (record_id,))
        assert conn.execute(
            f'SELECT 1 FROM {view} WHERE {key}=?', (record_id,)
        ).fetchone() is None
        assert conn.execute(f'SELECT COUNT(*) FROM {view}').fetchone()[0] == active_count - 1
        assert conn.execute(
            f'SELECT COUNT(*) FROM {table} WHERE {key}=?', (record_id,)
        ).fetchone()[0] == 1
        conn.execute(f"UPDATE {table} SET status='Active' WHERE {key}=?", (record_id,))
        assert conn.execute(f'SELECT COUNT(*) FROM {view}').fetchone()[0] == active_count
        print(f'PASS: {view}: inactive records hidden and restored')
=======
        active_count = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE status='Active'").fetchone()[0]
        visible_count = conn.execute(f'SELECT COUNT(*) FROM {view}').fetchone()[0]
        assert active_count == visible_count and active_count > 0, f'{view}: baseline count mismatch'
        assert conn.execute(f"SELECT COUNT(*) FROM {view} WHERE status!='Active'").fetchone()[0] == 0

        # Exercise real soft-deletion on an existing historical record, then restore it.
        record_id = conn.execute(f'SELECT {key} FROM {view} LIMIT 1').fetchone()[0]
        conn.execute(f"UPDATE {table} SET status='Inactive' WHERE {key}=?", (record_id,))
        assert conn.execute(f'SELECT 1 FROM {view} WHERE {key}=?', (record_id,)).fetchone() is None
        assert conn.execute(f'SELECT COUNT(*) FROM {view}').fetchone()[0] == active_count - 1
        assert conn.execute(f'SELECT 1 FROM {table} WHERE {key}=?', (record_id,)).fetchone()
        conn.execute(f"UPDATE {table} SET status='Active' WHERE {key}=?", (record_id,))
        assert conn.execute(f'SELECT COUNT(*) FROM {view}').fetchone()[0] == active_count
        print(f'PASS: {view}: {active_count} active rows; inactive records hidden and restored')
>>>>>>> origin/main


def main() -> None:
    base_sql = (ROOT / 'db/migrations/001_hope_base_tables.sql').read_text(encoding='utf-8')
    seed_sql = (ROOT / 'db/seeds/002_hope_historical_data.sql').read_text(encoding='utf-8')
<<<<<<< HEAD
    migrations = (
        'db/migrations/006_active_customer_product_views_indexes.sql',
        'migrations/006_active_customer_product_views_indexes.sql',
    )

    for migration in migrations:
=======
    for migration in (
        'db/migrations/006_active_customer_product_views_indexes.sql',
        'migrations/005_active_customer_product_views_indexes.sql',
    ):
>>>>>>> origin/main
        conn = sqlite3.connect(':memory:')
        try:
            conn.execute('PRAGMA foreign_keys = ON')
            conn.executescript(base_sql)
            conn.executescript(seed_sql)
            sql = (ROOT / migration).read_text(encoding='utf-8')
            conn.executescript(sql)
<<<<<<< HEAD
            conn.executescript(sql)
=======
            conn.executescript(sql)  # Reapplying must be safe.
>>>>>>> origin/main
            assert_schema_and_query_plans(conn)
            assert_active_only(conn)
            assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
            assert conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
<<<<<<< HEAD
            print(f'PASS: {migration} applies twice with valid integrity')
        finally:
            conn.close()

    conn = sqlite3.connect(':memory:')
    try:
        conn.executescript(base_sql)
        conn.executescript(seed_sql)
        conn.executescript(
            (ROOT / 'migrations/006_active_customer_product_views_indexes.sql')
            .read_text(encoding='utf-8')
        )
        conn.executescript(
            (ROOT / 'migrations/006_active_customer_product_views_indexes.down.sql')
            .read_text(encoding='utf-8')
        )
        remaining = conn.execute(
            "SELECT name FROM sqlite_master WHERE name IN (?, ?, ?, ?, ?)",
            (
                'v_active_customer',
                'v_active_product',
                'idx_customer_status_custname',
                'idx_product_status_description',
                'idx_pricehist_prodcode_effdate_status',
            ),
        ).fetchall()
        assert not remaining, f'Rollback left active-view objects behind: {remaining}'
        print('PASS: local migration rollback removes views and indexes')
    finally:
        conn.close()

=======
            print(f'PASS: {migration} applies twice with historical rows and valid integrity')
        finally:
            conn.close()

>>>>>>> origin/main

if __name__ == '__main__':
    main()
