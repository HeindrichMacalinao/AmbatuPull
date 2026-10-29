#!/usr/bin/env python3
"""S1-DBA-02: assert schema, constraints, and 928-row source-to-target parity.

Run from any directory: python tests/verify_hope.py
Optional single database: python tests/verify_hope.py HopeERP.db
"""
from __future__ import annotations

import re
from datetime import date
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SQL = ROOT / 'reference/HopeDB_audit.sql.txt'
SOURCE_DB = ROOT / 'reference/Model1.db'

# Expected record counts come from the actual historical INSERT statements.
EXPECTED_COUNTS = {
    'CUSTOMER': 82, 'PRODUCT': 57, 'PRICEHIST': 79, 'EMPLOYEE': 32,
    'JOB': 14, 'DEPARTMENT': 8, 'JOBHISTORY': 54, 'SALES': 124,
    'SALESDETAIL': 313, 'PAYMENT': 165,
}
TABLES = {
    'CUSTOMER': {'custNo': 'VARCHAR(10)', 'custName': 'VARCHAR(100)', 'address': 'VARCHAR(200)', 'payTerms': 'VARCHAR(20)'},
    'PRODUCT': {'prodCode': 'VARCHAR(10)', 'description': 'VARCHAR(100)', 'unit': 'VARCHAR(20)'},
    'PRICEHIST': {'prodCode': 'VARCHAR(10)', 'effDate': 'DATE', 'unitPrice': 'DECIMAL(10,2)'},
    'EMPLOYEE': {'empNo': 'VARCHAR(10)', 'lastName': 'VARCHAR(100)', 'firstName': 'VARCHAR(100)', 'gender': 'CHAR(1)', 'birthDate': 'DATE', 'hireDate': 'DATE', 'sepDate': 'DATE'},
    'JOB': {'jobCode': 'VARCHAR(10)', 'jobDesc': 'VARCHAR(100)'},
    'DEPARTMENT': {'deptCode': 'VARCHAR(10)', 'deptName': 'VARCHAR(100)'},
    'JOBHISTORY': {'empNo': 'VARCHAR(10)', 'jobCode': 'VARCHAR(10)', 'effDate': 'DATE', 'salary': 'DECIMAL(12,2)', 'deptCode': 'VARCHAR(10)'},
    'SALES': {'transNo': 'VARCHAR(10)', 'salesDate': 'DATE', 'custNo': 'VARCHAR(10)', 'empNo': 'VARCHAR(10)'},
    'SALESDETAIL': {'transNo': 'VARCHAR(10)', 'prodCode': 'VARCHAR(10)', 'quantity': 'INT'},
    'PAYMENT': {'ORNo': 'VARCHAR(10)', 'payDate': 'DATE', 'amount': 'DECIMAL(12,2)', 'transNo': 'VARCHAR(10)'},
}
SOURCE_COLUMNS = {
    'CUSTOMER': ['custNo','custName','address','payterm'],
    'PRODUCT': ['prodCode','description','unit'],
    'PRICEHIST': ['effDate','prodCode','unitPrice'],
    'EMPLOYEE': ['empNo','lastName','firstName','gender','birthDate','hireDate','sepDate'],
    'JOB': ['jobCode','jobDesc'],
    'DEPARTMENT': ['deptCode','deptName'],
    'JOBHISTORY': ['empNo','jobCode','effDate','salary','deptCode'],
    'SALES': ['transNo','salesDate','custNo','empNo'],
    'SALESDETAIL': ['transNo','prodCode','quantity'],
    'PAYMENT': ['ORNo','payDate','amount','transNo'],
}
# For source/target parity: these names select the same business values, in source order.
TARGET_COLUMNS = {**SOURCE_COLUMNS,
                  'CUSTOMER': ['custNo','custName','address','payTerms']}
PKS = {
    'CUSTOMER': ['custNo'], 'PRODUCT': ['prodCode'],
    'PRICEHIST': ['prodCode','effDate'], 'EMPLOYEE': ['empNo'],
    'JOB': ['jobCode'], 'DEPARTMENT': ['deptCode'],
    'JOBHISTORY': ['empNo','jobCode','effDate'], 'SALES': ['transNo'],
    'SALESDETAIL': ['transNo','prodCode'], 'PAYMENT': ['ORNo'],
}
EXPECTED_FKS = {
    ('PRICEHIST', 'prodCode', 'PRODUCT', 'prodCode'),
    ('JOBHISTORY', 'empNo', 'EMPLOYEE', 'empNo'),
    ('JOBHISTORY', 'jobCode', 'JOB', 'jobCode'),
    ('JOBHISTORY', 'deptCode', 'DEPARTMENT', 'deptCode'),
    ('SALES', 'custNo', 'CUSTOMER', 'custNo'),
    ('SALES', 'empNo', 'EMPLOYEE', 'empNo'),
    ('SALESDETAIL', 'transNo', 'SALES', 'transNo'),
    ('SALESDETAIL', 'prodCode', 'PRODUCT', 'prodCode'),
    ('PAYMENT', 'transNo', 'SALES', 'transNo'),
}
BAD_FK_CASES = [
    ('PRICEHIST.prodCode', 'INSERT INTO PRICEHIST (prodCode,effDate,unitPrice,stamp) VALUES (?,?,?,?)', ('BAD','2026-11-01',9,'test')),
    ('JOBHISTORY.empNo', 'INSERT INTO JOBHISTORY (empNo,jobCode,effDate,stamp) VALUES (?,?,?,?)', ('BAD','PR1','2026-11-01','test')),
    ('JOBHISTORY.jobCode', 'INSERT INTO JOBHISTORY (empNo,jobCode,effDate,stamp) VALUES (?,?,?,?)', ('00001','BAD','2026-11-01','test')),
    ('JOBHISTORY.deptCode', 'INSERT INTO JOBHISTORY (empNo,jobCode,effDate,deptCode,stamp) VALUES (?,?,?,?,?)', ('00001','PR1','2026-11-01','BAD','test')),
    ('SALES.custNo', 'INSERT INTO SALES (transNo,custNo,empNo,stamp) VALUES (?,?,?,?)', ('TR999999','BAD','00001','test')),
    ('SALES.empNo', 'INSERT INTO SALES (transNo,custNo,empNo,stamp) VALUES (?,?,?,?)', ('TR999999','C0001','BAD','test')),
    ('SALESDETAIL.transNo', 'INSERT INTO SALESDETAIL (transNo,prodCode,stamp) VALUES (?,?,?)', ('BAD','AK0001','test')),
    ('SALESDETAIL.prodCode', 'INSERT INTO SALESDETAIL (transNo,prodCode,stamp) VALUES (?,?,?)', ('TR000001','BAD','test')),
    ('PAYMENT.transNo', 'INSERT INTO PAYMENT (ORNo,transNo,stamp) VALUES (?,?,?)', ('OR999999','BAD','test')),
]


def reject(conn: sqlite3.Connection, description: str, statement: str, values: tuple) -> None:
    conn.execute('SAVEPOINT negative_test')
    try:
        try:
            conn.execute(statement, values)
        except sqlite3.IntegrityError:
            return
        raise AssertionError(f'Constraint NOT enforced: {description}')
    finally:
        conn.execute('ROLLBACK TO SAVEPOINT negative_test')
        conn.execute('RELEASE SAVEPOINT negative_test')


def load_original_rows() -> dict[str, list[tuple]]:
    """Load only original INSERT statements into an isolated SQLite reference DB.

    No business values are supplied by this test. The temporary table definitions
    merely let SQLite parse the original PostgreSQL INSERTs for exact comparison.
    """
    assert SOURCE_SQL.is_file(), f'Missing historical reference: {SOURCE_SQL}'
    source = SOURCE_SQL.read_text(encoding='utf-8-sig')
    before_audit = source.split('-- AUDIT TRAIL + SOFT DELETE', 1)[0]
    inserts = re.findall(r'\bINSERT\s+INTO\s+([A-Za-z]+)\s+VALUES\s*(.*?);', before_audit, flags=re.I | re.S)
    assert len(inserts) == 921, f'Unexpected number of original INSERT statements: {len(inserts)}'
    reference = sqlite3.connect(':memory:')
    try:
        for table, cols in SOURCE_COLUMNS.items():
            columns = ', '.join(f'"{col}" ' + ('DECIMAL(12,2)' if table == 'PAYMENT' and col.lower() == 'amount' else 'DECIMAL(12,2)' if table == 'JOBHISTORY' and col.lower() == 'salary' else 'DECIMAL(10,2)' if table == 'PRICEHIST' and col.lower() == 'unitprice' else 'INT' if table == 'SALESDETAIL' and col.lower() == 'quantity' else 'TEXT') for col in cols)
            reference.execute(f'CREATE TABLE "{table}" ({columns})')
        for table, values in inserts:
            table = table.upper()
            assert table in SOURCE_COLUMNS, f'Unexpected source table: {table}'
            reference.execute(f'INSERT INTO "{table}" VALUES {values}')
        return {table: reference.execute(f'SELECT * FROM "{table}"').fetchall() for table in SOURCE_COLUMNS}
    finally:
        reference.close()


def same_rows(a: list[tuple], b: list[tuple]) -> bool:
    return sorted(map(repr, a)) == sorted(map(repr, b))


def verify_original_simulation(conn: sqlite3.Connection) -> None:
    assert SOURCE_DB.is_file(), f'Missing original Model1.db: {SOURCE_DB}'
    original = sqlite3.connect(f'file:{SOURCE_DB.resolve().as_posix()}?mode=ro', uri=True)
    try:
        original_objects = original.execute("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").fetchall()
        for kind, name, ddl in original_objects:
            got = conn.execute('SELECT sql FROM sqlite_master WHERE type=? AND name=?', (kind,name)).fetchone()
            assert got is not None and got[0] == ddl, f'Original simulation object changed: {name}'
            if kind == 'table':
                assert same_rows(original.execute(f'SELECT * FROM "{name}"').fetchall(),
                                 conn.execute(f'SELECT * FROM "{name}"').fetchall()), f'Original simulation rows changed: {name}'
        print(f'PASS: original Model1.db preserved ({sum(kind == "table" for kind, _, _ in original_objects)} tables plus indexes/views)')
    finally:
        original.close()


def verify(db_path: Path, original_rows: dict[str, list[tuple]]) -> None:
    assert db_path.is_file(), f'Database missing: {db_path}'
    conn = sqlite3.connect(db_path)
    try:
        conn.execute('PRAGMA foreign_keys = ON')
        assert conn.execute('PRAGMA foreign_keys').fetchone()[0] == 1
        assert conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert conn.execute('PRAGMA foreign_key_check').fetchall() == [], 'Orphaned records found'
        existing = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert set(TABLES).issubset(existing), f'Missing HOPE tables: {set(TABLES) - existing}'
        if db_path.name.lower() == 'hoperp.db':
            # S1-DBA-03 extends the clean ERP database by five tables;
            # AUTOINCREMENT additionally creates SQLite's internal sequence table.
            user_tables = {'app_user', 'role', 'module', 'rights', 'user_permission'}
            expected_tables = set(TABLES) | user_tables | {'sqlite_sequence'}
            assert existing == expected_tables, f'Clean HopeERP.db schema mismatch: missing={expected_tables-existing}, extra={existing-expected_tables}'
        print(f'PASS: {db_path.name} SQLite integrity and 10 required tables')

        for table, business_cols in TABLES.items():
            info = conn.execute(f'PRAGMA table_info("{table}")').fetchall()
            cols = {r[1]: r for r in info}
            expected = {**business_cols, 'status':'VARCHAR(8)', 'stamp':'VARCHAR(80)'}
            assert set(cols) == set(expected), f'{table}: incorrect column set'
            for column, declared_type in expected.items():
                assert cols[column][2].upper() == declared_type, f'{table}.{column}: incorrect SQL type'
            assert cols['status'][3] == 1 and cols['status'][4] == "'Active'"
            assert cols['stamp'][3] == 1
            pk_columns = [r[1] for r in sorted(info, key=lambda r: r[5]) if r[5] > 0]
            assert pk_columns == PKS[table], f'{table}: wrong PK: {pk_columns}'
            assert conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0] == EXPECTED_COUNTS[table], f'{table}: historical count mismatch'
            assert conn.execute(f'''SELECT COUNT(*) FROM "{table}" WHERE status != 'Active' OR status IS NULL
                                      OR stamp IS NULL OR length(trim(stamp)) = 0 OR length(stamp) > 80''').fetchone()[0] == 0, f'{table}: bad audit values'
            # Negative tests: every table rejects invalid audit values.
            reject(conn, f'{table}.status', f'UPDATE "{table}" SET status=? WHERE rowid=(SELECT rowid FROM "{table}" LIMIT 1)', ('Other',))
            reject(conn, f'{table}.stamp', f'UPDATE "{table}" SET stamp=? WHERE rowid=(SELECT rowid FROM "{table}" LIMIT 1)', (None,))
            # Every historical DATE value must be a real ISO-8601 calendar date.
            for column, declared_type in business_cols.items():
                if declared_type == 'DATE':
                    for (value,) in conn.execute(f'SELECT \"{column}\" FROM \"{table}\" WHERE \"{column}\" IS NOT NULL'):
                        assert isinstance(value, str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', value), f'{table}.{column}: not ISO YYYY-MM-DD'
                        date.fromisoformat(value)
            # Primary key must reject a duplicate record.
            reject(conn, f'{table} duplicate PK', f'INSERT INTO \"{table}\" SELECT * FROM \"{table}\" LIMIT 1', ())
            # Compare EVERY business column of EVERY imported row to original source.
            target_cols = ', '.join(f'"{name}"' for name in TARGET_COLUMNS[table])
            actual = conn.execute(f'SELECT {target_cols} FROM "{table}"').fetchall()
            assert same_rows(original_rows[table], actual), f'{table}: source-to-target historical values differ'
        print('PASS: exact SQL schema, PKs, and status/stamp constraints on all 10 tables')
        print(f'PASS: {sum(EXPECTED_COUNTS.values())} historical records; every business value matches HopeDB_audit.sql.txt')

        fks = set()
        for table in TABLES:
            for row in conn.execute(f'PRAGMA foreign_key_list("{table}")'):
                fks.add((table,row[3],row[2],row[4]))
        assert fks == EXPECTED_FKS, f'Incorrect FKs: missing={EXPECTED_FKS-fks}, extra={fks-EXPECTED_FKS}'
        for desc, statement, values in BAD_FK_CASES:
            reject(conn, desc, statement, values)
        print('PASS: all 9 foreign keys present and reject orphaned INSERTs')
        assert conn.execute('SELECT COUNT(*) FROM SALES s JOIN CUSTOMER c ON c.custNo=s.custNo JOIN EMPLOYEE e ON e.empNo=s.empNo').fetchone()[0] == 124
        assert conn.execute('SELECT COUNT(*) FROM SALESDETAIL d JOIN SALES s ON s.transNo=d.transNo JOIN PRODUCT p ON p.prodCode=d.prodCode').fetchone()[0] == 313
        assert conn.execute('SELECT COUNT(*) FROM PAYMENT p JOIN SALES s ON s.transNo=p.transNo').fetchone()[0] == 165
        assert conn.execute("SELECT custName FROM CUSTOMER WHERE custNo='C0001'").fetchone()[0] == 'Globus Medical, Inc'
        assert conn.execute("SELECT lastName,firstName FROM EMPLOYEE WHERE empNo='00001'").fetchone() == ('Smith','John')
        assert conn.execute("SELECT unitPrice FROM PRICEHIST WHERE prodCode='AK0001' AND effDate='2010-05-15'").fetchone()[0] == 12
        print('PASS: expected historical IDs/values and relationship joins')
        if db_path.name.lower() == 'hope_model1.db':
            verify_original_simulation(conn)
        assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
        print(f'SUCCESS: {db_path.name}\n')
    finally:
        conn.close()


def main() -> None:
    original_rows = load_original_rows()
    for table, expected in EXPECTED_COUNTS.items():
        assert len(original_rows[table]) == expected, f'Original source {table} count changed'
    targets = [Path(arg).resolve() for arg in sys.argv[1:]] if len(sys.argv) > 1 else [ROOT/'HopeERP.db', ROOT/'HOPE_Model1.db']
    for target in targets:
        verify(target, original_rows)
    print(f'ALL TESTS PASSED: {len(targets)} database(s); {sum(EXPECTED_COUNTS.values())} baseline records each')


if __name__ == '__main__':
    main()
