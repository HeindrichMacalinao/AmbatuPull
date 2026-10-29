#!/usr/bin/env python3
"""S1-DBA-03: automated SQLite schema, security constraints and FK checks.

Run from repository root: python tests/verify_user_management.py
Runs transactional negative/behavior tests against BOTH rebuilt databases.
Never leaves demo accounts, rights, or permissions behind.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / 'db/migrations/002_user_management_tables.sql'
TABLES = {'app_user', 'role', 'module', 'rights', 'user_permission'}
EXPECTED_COLS = {
    'app_user': {'userId': 'INTEGER', 'firstName': 'VARCHAR(50)',
        'lastName': 'VARCHAR(50)', 'email': 'VARCHAR(100)',
        'passwordHash': 'VARCHAR(255)', 'role': 'VARCHAR(20)',
        'isBlocked': 'BOOLEAN', 'empNo': 'VARCHAR(10)',
        'status': 'VARCHAR(8)', 'stamp': 'VARCHAR(80)'},
    'role': {'roleName': 'VARCHAR(20)', 'description': 'TEXT'},
    'module': {'moduleCode': 'VARCHAR(30)', 'moduleName': 'VARCHAR(50)'},
    'rights': {'rightCode': 'VARCHAR(50)', 'moduleCode': 'VARCHAR(30)',
        'description': 'VARCHAR(150)'},
    'user_permission': {'userId': 'INTEGER', 'rightCode': 'VARCHAR(50)',
        'status': 'VARCHAR(8)', 'stamp': 'VARCHAR(80)'},
}
EXPECTED_PKS = {
    'app_user': ('userId',), 'role': ('roleName',), 'module': ('moduleCode',),
    'rights': ('rightCode',), 'user_permission': ('userId', 'rightCode'),
}
EXPECTED_FKS = {
    ('app_user', 'role', 'role', 'roleName', 'RESTRICT'),
    ('app_user', 'empNo', 'EMPLOYEE', 'empNo', 'SET NULL'),
    ('rights', 'moduleCode', 'module', 'moduleCode', 'RESTRICT'),
    ('user_permission', 'userId', 'app_user', 'userId', 'CASCADE'),
    ('user_permission', 'rightCode', 'rights', 'rightCode', 'CASCADE'),
}


def reject(conn: sqlite3.Connection, label: str, sql: str, args=()) -> None:
    conn.execute('SAVEPOINT reject_case')
    try:
        conn.execute(sql, args)
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError(f'Constraint not enforced: {label}')
    finally:
        conn.execute('ROLLBACK TO reject_case')
        conn.execute('RELEASE reject_case')


def structure(conn: sqlite3.Connection) -> None:
    actual = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert TABLES <= actual, f'Missing S1-DBA-03 tables: {TABLES - actual}'
    for table, expected_cols in EXPECTED_COLS.items():
        info = conn.execute(f'PRAGMA table_info("{table}")').fetchall()
        cols = {row[1]: row for row in info}
        assert set(cols) == set(expected_cols), (table, cols.keys())
        for column, typ in expected_cols.items():
            assert cols[column][2].upper() == typ, f'{table}.{column} wrong type'
        pk = tuple(row[1] for row in sorted(info, key=lambda r: r[5]) if row[5])
        assert pk == EXPECTED_PKS[table], f'{table} wrong PK: {pk}'
    for table in ('app_user', 'user_permission'):
        cols = {r[1]: r for r in conn.execute(f'PRAGMA table_info("{table}")')}
        assert cols['status'][3] == 1 and cols['status'][4] == "'Active'"
        assert cols['stamp'][3] == 1
    user = {r[1]: r for r in conn.execute('PRAGMA table_info("app_user")')}
    assert user['role'][3] == 1 and user['role'][4] == "'User'"
    assert user['isBlocked'][3] == 1 and str(user['isBlocked'][4]) in ('0', 'FALSE')
    assert user['email'][3] == 1 and user['passwordHash'][3] == 1
    assert user['empNo'][3] == 0
    actual_fk = set()
    for table in TABLES:
        for row in conn.execute(f'PRAGMA foreign_key_list("{table}")'):
            actual_fk.add((table, row[3], row[2], row[4], row[6]))
    assert actual_fk == EXPECTED_FKS, f'FK mismatch: {actual_fk ^ EXPECTED_FKS}'
    for table, index_name, column in (
        ('app_user', 'idx_app_user_email', 'email'),
        ('user_permission', 'idx_user_permission_userId', 'userId'),
    ):
        indexes = {r[1] for r in conn.execute(f'PRAGMA index_list("{table}")')}
        assert index_name in indexes, f'Missing index: {index_name}'
        fields = [r[2] for r in conn.execute(f'PRAGMA index_info("{index_name}")')]
        assert fields == [column], f'{index_name}: {fields}'
    for (role_name,) in conn.execute('SELECT roleName FROM "role"'):
        assert role_name in ('User', 'Admin', 'Superadmin')
    assert conn.execute('SELECT COUNT(*) FROM "role"').fetchone()[0] == 3
    print('PASS: five user-management tables, exact columns/PKs and 5 FKs')
    print('PASS: role/default/status/audit constraints and both requested indexes')


def behavior(conn: sqlite3.Connection) -> None:
    assert conn.execute('PRAGMA foreign_keys').fetchone()[0] == 1
    # Verify the migration DOES NOT fabricate accounts, modules or grants.
    for table in ('app_user', 'module', 'rights', 'user_permission'):
        assert conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0] == 0, table
    assert conn.execute('SELECT empNo FROM EMPLOYEE WHERE empNo = ?', ('00001',)).fetchone() == ('00001',)
    # All negative tests operate inside a single rolled-back transaction.
    conn.execute('SAVEPOINT test_s1dba03')
    try:
        conn.execute('''INSERT INTO "app_user"
            ("firstName","lastName","email","passwordHash","empNo","stamp")
            VALUES (?,?,?,?,?,?)''',
            ('Test', 'User', 'test@example.invalid', 'TEST_PLACEHOLDER_NOT_A_HASH', '00001', 'ADD test'))
        uid = conn.execute('SELECT userId FROM app_user WHERE email = ?', ('test@example.invalid',)).fetchone()[0]
        user_state = conn.execute('SELECT role,isBlocked,status,empNo FROM app_user WHERE userId=?',(uid,)).fetchone()
        assert user_state == ('User', 0, 'Active', '00001'), user_state
        reject(conn, 'exact duplicate email', '''INSERT INTO app_user (firstName,lastName,email,passwordHash,stamp)
            VALUES ('X','Y','test@example.invalid','x','test')''')
        reject(conn, 'case-insensitive duplicate email', '''INSERT INTO app_user (firstName,lastName,email,passwordHash,stamp)
            VALUES ('X','Y','TEST@EXAMPLE.INVALID','x','test')''')
        reject(conn, 'invalid role', 'UPDATE app_user SET role=? WHERE userId=?', ('Root',uid))
        reject(conn, 'invalid block value', 'UPDATE app_user SET isBlocked=2 WHERE userId=?', (uid,))
        reject(conn, 'invalid status', "UPDATE app_user SET status='Archived' WHERE userId=?", (uid,))
        reject(conn, 'null stamp', 'UPDATE app_user SET stamp=NULL WHERE userId=?', (uid,))
        reject(conn, 'empty stamp', "UPDATE app_user SET stamp=' ' WHERE userId=?", (uid,))
        reject(conn, 'null passwordHash', 'UPDATE app_user SET passwordHash=NULL WHERE userId=?', (uid,))
        reject(conn, 'orphan employee', 'UPDATE app_user SET empNo=? WHERE userId=?', ('MISSING',uid))
        reject(conn, 'missing role', 'DELETE FROM role WHERE roleName=?', ('User',))
        print('PASS: case-insensitive email uniqueness, valid employee FK, restricted values/stamp')

        reject(conn, 'rights orphan module', '''INSERT INTO rights (rightCode,moduleCode,description)
            VALUES ('TEST_R','MISSING','Temporary')''')
        conn.execute('INSERT INTO module(moduleCode,moduleName) VALUES (?,?)', ('TEST_MOD','Temporary'))
        conn.execute('INSERT INTO rights(rightCode,moduleCode,description) VALUES (?,?,?)',
                     ('TEST_R','TEST_MOD','Temporary'))
        reject(conn, 'orphan user permission', '''INSERT INTO user_permission(userId,rightCode,stamp)
            VALUES (999999999,'TEST_R','test')''')
        reject(conn, 'orphan rights permission', 'INSERT INTO user_permission(userId,rightCode,stamp) VALUES (?,?,?)',
               (uid, 'MISSING', 'test'))
        conn.execute('INSERT INTO user_permission(userId,rightCode,stamp) VALUES (?,?,?)', (uid,'TEST_R','ADD test'))
        reject(conn, 'duplicate grant', 'INSERT INTO user_permission(userId,rightCode,stamp) VALUES (?,?,?)',
               (uid,'TEST_R','test'))
        reject(conn, 'invalid permission status', "UPDATE user_permission SET status='Revoked'")
        reject(conn, 'permission null stamp', 'UPDATE user_permission SET stamp=NULL')
        # Documented soft-delete behavior: account disable/permission revoke retains grant.
        conn.execute("UPDATE app_user SET isBlocked=1,status='Inactive' WHERE userId=?", (uid,))
        conn.execute("UPDATE user_permission SET status='Inactive' WHERE userId=?", (uid,))
        assert conn.execute('SELECT status FROM user_permission WHERE userId=?',(uid,)).fetchone() == ('Inactive',)
        # Delete right => grant cascades; parent module may not be deleted while right exists.
        reject(conn, 'module delete restricted', "DELETE FROM module WHERE moduleCode='TEST_MOD'")
        conn.execute("DELETE FROM rights WHERE rightCode='TEST_R'")
        assert conn.execute('SELECT COUNT(*) FROM user_permission WHERE userId=?',(uid,)).fetchone()[0] == 0
        # Delete account => grant cascades independently.
        conn.execute('INSERT INTO rights(rightCode,moduleCode,description) VALUES (?,?,?)',
                     ('TEST_R2','TEST_MOD','Temporary'))
        conn.execute('INSERT INTO user_permission(userId,rightCode,stamp) VALUES (?,?,?)',
                     (uid, 'TEST_R2', 'ADD test'))
        conn.execute('DELETE FROM app_user WHERE userId=?',(uid,))
        assert conn.execute('SELECT COUNT(*) FROM user_permission WHERE userId=?',(uid,)).fetchone()[0] == 0
        # Employee unlink semantics, with no modifications to existing historical employees.
        conn.execute('INSERT INTO EMPLOYEE(empNo,lastName,firstName,stamp) VALUES (?,?,?,?)',
                     ('TMP_EMP_03','Temporary','Worker','ADD test'))
        conn.execute('INSERT INTO app_user(firstName,lastName,email,passwordHash,empNo,stamp) VALUES (?,?,?,?,?,?)',
                     ('X','Y','temp@example.invalid','TEST_PLACEHOLDER_NOT_A_HASH','TMP_EMP_03','ADD test'))
        conn.execute("DELETE FROM EMPLOYEE WHERE empNo='TMP_EMP_03'")
        assert conn.execute("SELECT empNo FROM app_user WHERE email='temp@example.invalid'").fetchone() == (None,)
        print('PASS: junction ON DELETE CASCADE for account and rights; restricted module delete')
        print('PASS: soft-disable retains grants; EMPLOYEE deletion sets nullable empNo to NULL')
    finally:
        conn.execute('ROLLBACK TO test_s1dba03')
        conn.execute('RELEASE test_s1dba03')
    for table in ('app_user', 'module', 'rights', 'user_permission'):
        assert conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0] == 0
    print('PASS: no demonstration accounts/permissions persisted')


def verify(path: Path) -> None:
    print(f'\n--- {path.name} ---')
    conn = sqlite3.connect(path)
    try:
        conn.execute('PRAGMA foreign_keys = ON')
        assert conn.execute('PRAGMA foreign_keys').fetchone()[0] == 1
        assert conn.execute('PRAGMA integrity_check').fetchone() == ('ok',)
        assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
        structure(conn)
        behavior(conn)
        assert conn.execute('PRAGMA integrity_check').fetchone() == ('ok',)
        assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
        print('PASS: SQLite integrity and FK checks')
        # Re-applying must not add duplicates, alter account data or fail.
        conn.executescript(MIGRATION.read_text(encoding='utf-8'))
        structure(conn)
        assert conn.execute('SELECT COUNT(*) FROM app_user').fetchone()[0] == 0
        assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
        print('PASS: idempotent reapplication')
        print(f'SUCCESS: {path.name}')
    finally:
        conn.close()


def main() -> None:
    paths = [ROOT/'HopeERP.db', ROOT/'HOPE_Model1.db']
    for path in paths:
        if not path.exists():
            raise FileNotFoundError(f'Generate {path.name} first with scripts/regenerate_hope.py')
        verify(path)
    print('\nALL S1-DBA-03 VERIFICATIONS PASSED: both databases')


if __name__ == '__main__':
    main()
