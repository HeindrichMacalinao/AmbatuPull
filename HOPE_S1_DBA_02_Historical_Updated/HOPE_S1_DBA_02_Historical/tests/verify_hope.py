"""S1-DBA-02: verify SQLite HOPE migration, seed, audit checks, and every FK."""
import sqlite3
import sys
from pathlib import Path

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
    ("PRICEHIST.prodCode", 'INSERT INTO PRICEHIST (prodCode,effDate,unitPrice,stamp) VALUES (?,?,?,?)', ('BAD','2026-11-01',9,'test')),
    ("JOBHISTORY.empNo", 'INSERT INTO JOBHISTORY (empNo,jobCode,effDate,stamp) VALUES (?,?,?,?)', ('BAD','PR1','2026-11-01','test')),
    ("JOBHISTORY.jobCode", 'INSERT INTO JOBHISTORY (empNo,jobCode,effDate,stamp) VALUES (?,?,?,?)', ('00001','BAD','2026-11-01','test')),
    ("JOBHISTORY.deptCode", 'INSERT INTO JOBHISTORY (empNo,jobCode,effDate,deptCode,stamp) VALUES (?,?,?,?,?)', ('00001','PR1','2026-11-01','BAD','test')),
    ("SALES.custNo", 'INSERT INTO SALES (transNo,custNo,empNo,stamp) VALUES (?,?,?,?)', ('TR999999','BAD','00001','test')),
    ("SALES.empNo", 'INSERT INTO SALES (transNo,custNo,empNo,stamp) VALUES (?,?,?,?)', ('TR999999','C0001','BAD','test')),
    ("SALESDETAIL.transNo", 'INSERT INTO SALESDETAIL (transNo,prodCode,stamp) VALUES (?,?,?)', ('BAD','AK0001','test')),
    ("SALESDETAIL.prodCode", 'INSERT INTO SALESDETAIL (transNo,prodCode,stamp) VALUES (?,?,?)', ('TR000001','BAD','test')),
    ("PAYMENT.transNo", 'INSERT INTO PAYMENT (ORNo,transNo,stamp) VALUES (?,?,?)', ('OR999999','BAD','test')),
]

def rejected(c, label, sql, params):
    c.execute('SAVEPOINT check_constraint')
    try:
        try:
            c.execute(sql, params)
        except sqlite3.IntegrityError:
            return
        raise AssertionError(f'Invalid write was ACCEPTED: {label}')
    finally:
        c.execute('ROLLBACK TO SAVEPOINT check_constraint')
        c.execute('RELEASE SAVEPOINT check_constraint')

def main(db):
    assert db.is_file(), f'Database not found: {db}'
    c = sqlite3.connect(db)
    try:
        c.execute('PRAGMA foreign_keys = ON')
        assert c.execute('PRAGMA foreign_keys').fetchone()[0] == 1
        assert c.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert c.execute('PRAGMA foreign_key_check').fetchall() == [], 'Existing orphaned rows'
        existing = {name for (name,) in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert TABLES.keys() <= existing, f'Missing tables: {TABLES.keys() - existing}'
        print('PASS: all 10 HOPE tables exist; SQLite integrity OK')

        for table, business_cols in TABLES.items():
            cols = {r[1]: r for r in c.execute(f'PRAGMA table_info("{table}")')}
            expected = {**business_cols, 'status': 'VARCHAR(8)', 'stamp': 'VARCHAR(80)'}
            assert set(cols) == set(expected), f'{table}: incorrect columns {set(cols) ^ set(expected)}'
            for column, declared_type in expected.items():
                assert cols[column][2].upper() == declared_type, f'{table}.{column}: incorrect type'
            assert cols['status'][3] == 1 and cols['status'][4] == "'Active'", f'{table}: invalid status spec'
            assert cols['stamp'][3] == 1, f'{table}: stamp must be NOT NULL'
            assert c.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0] > 0, f'{table}: missing sample rows'
            assert c.execute(f'SELECT COUNT(*) FROM "{table}" WHERE status NOT IN (\'Active\',\'Inactive\') OR stamp IS NULL').fetchone()[0] == 0
            # Every table rejects an invalid status, and a missing mandatory stamp.
            rejected(c, table + ' status', f'UPDATE "{table}" SET "status" = ? WHERE rowid = (SELECT rowid FROM "{table}" LIMIT 1)', ('Unknown',))
            rejected(c, table + ' stamp', f'UPDATE "{table}" SET "stamp" = ? WHERE rowid = (SELECT rowid FROM "{table}" LIMIT 1)', (None,))
        print('PASS: exact column names/types + mandatory audited status/stamp on all 10 tables')
        print('PASS: all 10 tables contain seed records; invalid status and missing stamp rejected')

        found_fks = set()
        for table in TABLES:
            for r in c.execute(f'PRAGMA foreign_key_list("{table}")'):
                found_fks.add((table, r[3], r[2], r[4]))
        assert found_fks == EXPECTED_FKS, f'FK mismatch: missing={EXPECTED_FKS-found_fks}, extra={found_fks-EXPECTED_FKS}'
        for label, sql, params in BAD_FK_CASES:
            rejected(c, label, sql, params)
        print('PASS: all 9 exact foreign-key relationships reject orphaned inserts')

        assert c.execute('SELECT COUNT(*) FROM SALES s JOIN CUSTOMER c ON c.custNo=s.custNo JOIN EMPLOYEE e ON e.empNo=s.empNo').fetchone()[0] == 124
        assert c.execute('SELECT COUNT(*) FROM SALESDETAIL d JOIN SALES s ON s.transNo=d.transNo JOIN PRODUCT p ON p.prodCode=d.prodCode').fetchone()[0] == 313
        assert c.execute('SELECT COUNT(*) FROM PAYMENT p JOIN SALES s ON s.transNo=p.transNo').fetchone()[0] == 165
        assert c.execute('SELECT status FROM CUSTOMER WHERE custNo = ?', ('C0001',)).fetchone()[0] == 'Active'
        assert c.execute('PRAGMA foreign_key_check').fetchall() == []
        print('PASS: seed joins, Active default, and foreign_key_check')
        print('SUCCESS: S1-DBA-02 accepted on', db)
    finally:
        c.close()

if __name__ == '__main__':
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else Path('HOPE_Model1.db'))
