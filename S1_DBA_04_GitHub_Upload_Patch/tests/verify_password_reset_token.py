#!/usr/bin/env python3
"""S1-DBA-04: deterministic SQLite migration and behavior tests, no dependencies.

Run from anywhere:
    python3 -B tests/verify_password_reset_token.py
    python3 -B tests/verify_password_reset_token.py --check-artifacts

Default validates migrations 001 -> historical seed -> 002 -> 003 on a
throwaway clean database. --check-artifacts additionally verifies the two
regenerated integrated DBs. No test user/token is persisted.
"""
from __future__ import annotations

import argparse
import hashlib
import sqlite3
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL_FILES = (
    ROOT / 'db/migrations/001_hope_base_tables.sql',
    ROOT / 'db/seeds/002_hope_historical_data.sql',
    ROOT / 'db/migrations/002_user_management_tables.sql',
    ROOT / 'db/migrations/003_password_reset_token.sql',
)
MIGRATION = SQL_FILES[-1]
EXPECTED_COUNTS = {
    'CUSTOMER': 82, 'PRODUCT': 57, 'PRICEHIST': 79, 'EMPLOYEE': 32,
    'JOB': 14, 'DEPARTMENT': 8, 'JOBHISTORY': 54, 'SALES': 124,
    'SALESDETAIL': 313, 'PAYMENT': 165,
}
EXPECTED_TYPES = {
    'id': 'INTEGER', 'userId': 'INTEGER', 'tokenHash': 'VARCHAR(255)',
    'expiresAt': 'TIMESTAMP', 'isUsed': 'BOOLEAN',
    'createdAt': 'TIMESTAMP', 'usedAt': 'TIMESTAMP',
}


def hash_test_label(label: str) -> str:
    """Deterministic synthetic digest; tests never store usable reset secrets."""
    return hashlib.sha256(('S1-DBA-04 test fixture: ' + label).encode()).hexdigest()


def reject(conn: sqlite3.Connection, why: str, sql: str, args: tuple = ()) -> None:
    conn.execute('SAVEPOINT reject_case')
    try:
        try:
            conn.execute(sql, args)
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError(f'NOT rejected: {why}')
    finally:
        conn.execute('ROLLBACK TO reject_case')
        conn.execute('RELEASE reject_case')


def check_structure(conn: sqlite3.Connection) -> None:
    info = conn.execute('PRAGMA table_info("password_reset_token")').fetchall()
    assert len(info) == 7, f'Expected seven columns, got: {info}'
    columns = {row[1]: row for row in info}
    assert set(columns) == set(EXPECTED_TYPES), f'Wrong columns: {set(columns)}'
    for name, declared_type in EXPECTED_TYPES.items():
        assert columns[name][2].upper() == declared_type, (name, columns[name][2])
    assert columns['id'][5] == 1, 'id must be the primary key'
    assert columns['userId'][3] == 1 and columns['tokenHash'][3] == 1
    for name in ('expiresAt', 'isUsed', 'createdAt'):
        assert columns[name][3] == 1, f'{name} must be NOT NULL'
    assert columns['usedAt'][3] == 0, 'usedAt must be nullable'
    assert 'datetime' in str(columns['expiresAt'][4]).lower()
    assert '+1 hour' in str(columns['expiresAt'][4])
    assert str(columns['isUsed'][4]).upper() in ('0', 'FALSE')
    assert str(columns['createdAt'][4]).upper() == 'CURRENT_TIMESTAMP'
    assert columns['usedAt'][4] is None
    ddl = conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='password_reset_token'").fetchone()[0]
    assert 'AUTOINCREMENT' in ddl.upper(), 'id must auto increment'
    assert 'token' not in {name.lower() for name in columns}, 'Raw token storage is forbidden'

    fks = conn.execute('PRAGMA foreign_key_list("password_reset_token")').fetchall()
    assert len(fks) == 1, f'Expected exactly one FK: {fks}'
    fk = fks[0]
    assert (fk[2], fk[3], fk[4], fk[5], fk[6]) == (
        'app_user', 'userId', 'userId', 'CASCADE', 'CASCADE'
    ), f'User FK must reference app_user.userId with ON DELETE CASCADE: {fk}'

    indexes = {row[1]: row for row in conn.execute('PRAGMA index_list("password_reset_token")')}
    names = (
        ('idx_password_reset_token_tokenHash', ['tokenHash']),
        ('idx_password_reset_token_user_state_expiry', ['userId', 'isUsed', 'expiresAt']),
    )
    for name, expected_fields in names:
        assert name in indexes, f'Missing index {name}'
        actual_fields = [row[2] for row in conn.execute(f'PRAGMA index_info("{name}")')]
        assert actual_fields == expected_fields, f'{name}: {actual_fields}'
    assert indexes['idx_password_reset_token_tokenHash'][2] == 1, 'hash lookup must be unique'
    assert conn.execute('PRAGMA foreign_keys').fetchone() == (1,)
    assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
    assert conn.execute('PRAGMA integrity_check').fetchone() == ('ok',)


def create_user(conn: sqlite3.Connection, email: str) -> int:
    cur = conn.execute('''INSERT INTO app_user
        (firstName,lastName,email,passwordHash,stamp) VALUES (?,?,?,?,?)''',
        ('CI', 'Fixture', email, 'TEST_ONLY_NOT_A_REAL_PASSWORD_HASH', 'ADD test'))
    assert cur.lastrowid is not None
    return int(cur.lastrowid)


def insert_token(conn: sqlite3.Connection, uid: int, name: str, **override) -> int:
    fields = {'userId': uid, 'tokenHash': hash_test_label(name), **override}
    columns = ','.join('"' + name + '"' for name in fields)
    placeholders = ','.join('?' for _ in fields)
    cur = conn.execute(f'INSERT INTO password_reset_token ({columns}) VALUES ({placeholders})', tuple(fields.values()))
    assert cur.lastrowid is not None
    return int(cur.lastrowid)


def check_behavior(conn: sqlite3.Connection) -> None:
    # Tests operate in one SAVEPOINT and roll back ALL inserted fixtures.
    before_count = conn.execute('SELECT COUNT(*) FROM password_reset_token').fetchone()[0]
    assert before_count == 0, 'Migration must not seed reset tokens'
    conn.execute('SAVEPOINT reset_test')
    try:
        uid = create_user(conn, 's1-dba-04@example.invalid')
        other = create_user(conn, 's1-dba-04-other@example.invalid')
        reject(conn, 'orphan user FK',
               'INSERT INTO password_reset_token (userId, tokenHash) VALUES (?,?)',
               (987654321, hash_test_label('orphan')))
        reject(conn, 'null userId',
               'INSERT INTO password_reset_token (userId, tokenHash) VALUES (?,?)',
               (None, hash_test_label('null-user')))
        reject(conn, 'null tokenHash',
               'INSERT INTO password_reset_token (userId, tokenHash) VALUES (?,?)',
               (uid, None))
        reject(conn, 'raw plaintext token',
               'INSERT INTO password_reset_token (userId, tokenHash) VALUES (?,?)',
               (uid, 'plaintext-reset-token'))
        reject(conn, 'uppercase digest',
               'INSERT INTO password_reset_token (userId, tokenHash) VALUES (?,?)',
               (uid, hash_test_label('uppercase').upper()))
        reject(conn, 'digest with non-hex characters',
               'INSERT INTO password_reset_token (userId, tokenHash) VALUES (?,?)',
               (uid, 'g' * 64))
        reject(conn, 'bad isUsed flag',
               'INSERT INTO password_reset_token (userId, tokenHash, isUsed) VALUES (?,?,?)',
               (uid, hash_test_label('bad-flag'), 2))
        reject(conn, 'null isUsed flag',
               'INSERT INTO password_reset_token (userId, tokenHash, isUsed) VALUES (?,?,?)',
               (uid, hash_test_label('null-flag'), None))
        reject(conn, 'unparseable expiration',
               'INSERT INTO password_reset_token (userId, tokenHash, expiresAt) VALUES (?,?,?)',
               (uid, hash_test_label('bad-expiry'), 'not-a-date'))
        reject(conn, 'unparseable createdAt',
               'INSERT INTO password_reset_token (userId, tokenHash, createdAt) VALUES (?,?,?)',
               (uid, hash_test_label('bad-creation'), 'not-a-date'))
        reject(conn, 'expiration before creation',
               '''INSERT INTO password_reset_token
                  (userId, tokenHash, createdAt, expiresAt) VALUES (?,?,?,?)''',
               (uid, hash_test_label('backwards'), '2030-01-01 10:00:00', '2030-01-01 09:00:00'))
        reject(conn, 'expiration equal to creation',
               '''INSERT INTO password_reset_token
                  (userId, tokenHash, createdAt, expiresAt) VALUES (?,?,?,?)''',
               (uid, hash_test_label('equal'), '2030-01-01 10:00:00', '2030-01-01 10:00:00'))
        reject(conn, 'bad usedAt',
               'INSERT INTO password_reset_token (userId, tokenHash, usedAt) VALUES (?,?,?)',
               (uid, hash_test_label('bad-used'), 'nonsense'))
        print('PASS: foreign keys, required columns, SHA-256 digest format, flag/date constraints')

        first = insert_token(conn, uid, 'first')
        row = conn.execute('''SELECT createdAt, expiresAt, isUsed, usedAt
                              FROM password_reset_token WHERE id=?''', (first,)).fetchone()
        created_at, expires_at, used, used_at = row
        assert (datetime.fromisoformat(expires_at) - datetime.fromisoformat(created_at)) == timedelta(hours=1)
        assert used == 0 and used_at is None
        reject(conn, 'duplicate hashed token',
               'INSERT INTO password_reset_token (userId, tokenHash) VALUES (?,?)',
               (other, hash_test_label('first')))
        print('PASS: exactly +1 hour default expiry, false/NULL defaults, unique digest lookup')

        # The application redeems via ONE guarded statement, not SELECT then UPDATE.
        redemption = '''UPDATE password_reset_token
            SET isUsed=1, usedAt=CURRENT_TIMESTAMP
            WHERE tokenHash=? AND isUsed=0 AND expiresAt>CURRENT_TIMESTAMP'''
        assert conn.execute(redemption, (hash_test_label('wrong'),)).rowcount == 0
        assert conn.execute(redemption, (hash_test_label('first'),)).rowcount == 1
        assert conn.execute(redemption, (hash_test_label('first'),)).rowcount == 0
        assert conn.execute('''SELECT isUsed, usedAt IS NOT NULL
                               FROM password_reset_token WHERE id=?''', (first,)).fetchone() == (1, 1)
        print('PASS: first redemption updates exactly one row; replay updates zero')

        expired = insert_token(conn, uid, 'expired', createdAt='2020-01-01 00:00:00',
                               expiresAt='2020-01-01 01:00:00')
        assert conn.execute(redemption, (hash_test_label('expired'),)).rowcount == 0
        assert conn.execute('SELECT isUsed FROM password_reset_token WHERE id=?', (expired,)).fetchone() == (0,)
        new = insert_token(conn, other, 'new')
        old = insert_token(conn, other, 'old')
        # Invalidating a pending token does not claim the token was redeemed.
        assert conn.execute('''UPDATE password_reset_token SET isUsed=1
            WHERE userId=? AND isUsed=0 AND expiresAt>CURRENT_TIMESTAMP AND id=?''',
            (other, old)).rowcount == 1
        status_sql = '''SELECT CASE
            WHEN isUsed=1 THEN 'used'
            WHEN expiresAt<=CURRENT_TIMESTAMP THEN 'expired'
            ELSE 'active' END FROM password_reset_token WHERE id=?'''
        assert conn.execute(status_sql, (first,)).fetchone() == ('used',)
        assert conn.execute(status_sql, (expired,)).fetchone() == ('expired',)
        assert conn.execute(status_sql, (new,)).fetchone() == ('active',)
        assert conn.execute(status_sql, (old,)).fetchone() == ('used',)
        assert conn.execute('SELECT usedAt FROM password_reset_token WHERE id=?', (old,)).fetchone() == (None,)
        print('PASS: active/expired/used classification and pending-token invalidation')

        # Deleting an account removes all its reset tokens, but not other users'.
        assert conn.execute('DELETE FROM app_user WHERE userId=?', (other,)).rowcount == 1
        assert conn.execute('SELECT COUNT(*) FROM password_reset_token WHERE userId=?', (other,)).fetchone() == (0,)
        assert conn.execute('SELECT COUNT(*) FROM password_reset_token WHERE userId=?', (uid,)).fetchone() == (2,)
        assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
        print('PASS: ON DELETE CASCADE removes only the deleted user’s reset tokens')
    finally:
        conn.execute('ROLLBACK TO reset_test')
        conn.execute('RELEASE reset_test')
    assert conn.execute('SELECT COUNT(*) FROM password_reset_token').fetchone()[0] == before_count
    assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
    assert conn.execute('PRAGMA integrity_check').fetchone() == ('ok',)
    print('PASS: all fixture records rolled back; SQLite integrity remains OK')


def check_baseline(conn: sqlite3.Connection) -> None:
    for name, expected in EXPECTED_COUNTS.items():
        got = conn.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
        assert got == expected, (name, got, expected)
    assert conn.execute('SELECT COUNT(*) FROM role').fetchone() == (3,)
    assert conn.execute('SELECT COUNT(*) FROM password_reset_token').fetchone() == (0,)
    print('PASS: 928 historical HOPE records, three roles, and no seeded reset tokens')


def check_mutation_detection(conn: sqlite3.Connection) -> None:
    conn.execute('SAVEPOINT mutation_check')
    try:
        conn.execute('DROP INDEX idx_password_reset_token_user_state_expiry')
        try:
            check_structure(conn)
        except AssertionError as error:
            assert 'Missing index' in str(error), error
        else:
            raise AssertionError('A missing index DID NOT make the validator fail')
        print('PASS: schema validator rejects missing mandatory index')
    finally:
        conn.execute('ROLLBACK TO mutation_check')
        conn.execute('RELEASE mutation_check')
    check_structure(conn)


def open_db(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute('PRAGMA foreign_keys=ON')
    assert conn.execute('PRAGMA foreign_keys').fetchone() == (1,)
    return conn


def verify_built(path: Path) -> None:
    assert path.is_file(), f'Missing {path}; first run python scripts/regenerate_hope.py'
    print(f'\n--- Verify integrated {path.name} ---')
    conn = open_db(path)
    try:
        check_structure(conn)
        check_baseline(conn)
        check_behavior(conn)
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-artifacts', action='store_true',
                        help='also inspect both integrated on-disk database artifacts')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='s1-dba-04-') as directory:
        path = Path(directory) / 'fresh.db'
        print('--- Fresh migration on a disposable SQLite database ---')
        conn = open_db(path)
        try:
            for sql_file in SQL_FILES:
                assert sql_file.is_file(), f'Missing migration/seed: {sql_file}'
                conn.executescript(sql_file.read_text(encoding='utf-8'))
            check_structure(conn)
            check_baseline(conn)
            check_behavior(conn)
            conn.executescript(MIGRATION.read_text(encoding='utf-8'))
            check_structure(conn)
            check_baseline(conn)
            print('PASS: migration safely reapplies without changing data/indexes')
            check_mutation_detection(conn)
        finally:
            conn.close()
    if args.check_artifacts:
        for name in ('HopeERP.db', 'HOPE_Model1.db'):
            verify_built(ROOT / name)
    print('\nALL S1-DBA-04 TESTS PASSED')


if __name__ == '__main__':
    main()
