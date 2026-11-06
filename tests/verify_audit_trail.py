#!/usr/bin/env python3
"""S1-DBA-06 SQLite end-to-end audit tests; no third-party dependencies.

Run: python3 -B tests/verify_audit_trail.py [--check-artifacts]
Creates only throwaway in-memory data; never seeds a live user or password.
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from audit_sqlite import bind_audit_actor  # noqa: E402

FILES = (
    'db/migrations/001_hope_base_tables.sql',
    'db/seeds/002_hope_historical_data.sql',
    'db/migrations/002_user_management_tables.sql',
    'db/migrations/003_password_reset_token.sql',
    'db/seeds/003_initial_access_catalog.sql',
    'db/migrations/004_audit_trail.sql',
)


def prepared(*, actor='auditor-test', recursive=True) -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.execute('PRAGMA foreign_keys = ON')
    for f in FILES:
        conn.executescript((ROOT / f).read_text(encoding='utf-8'))
    if actor is not None:
        bind_audit_actor(conn, actor)
    conn.execute(f'PRAGMA recursive_triggers = {int(recursive)}')
    return conn


def user(conn: sqlite3.Connection, email='audit-test@example.invalid') -> int:
    # Placeholder only, no functional password or reusable secret.
    conn.execute('''INSERT INTO app_user (firstName,lastName,email,passwordHash,stamp)
                    VALUES ('Audit','Fixture',?,'TEST_HASH_NOT_A_CREDENTIAL','PENDING')''', (email,))
    return conn.execute('SELECT userId FROM app_user WHERE email=?', (email,)).fetchone()[0]


def logs(conn: sqlite3.Connection, table='user_permission') -> list[tuple]:
    return conn.execute('''SELECT performedBy,action,tableName,recordId,details,timestamp
                           FROM audit_log WHERE tableName=? ORDER BY id''', (table,)).fetchall()


class AuditTrailTests(unittest.TestCase):
    def setUp(self):
        self.conn = prepared()
    def tearDown(self):
        self.conn.close()

    def test_01_schema_and_required_indexes(self):
        conn=self.conn
        cols = {r[1]:r for r in conn.execute('PRAGMA table_info(audit_log)')}
        self.assertEqual(set(cols), {'id','performedBy','action','tableName','recordId','details','timestamp'})
        self.assertEqual(cols['id'][5],1)
        for name in ('performedBy','action','tableName','recordId','timestamp'):
            self.assertEqual(cols[name][3],1)
        self.assertIn('CURRENT_TIMESTAMP', str(cols['timestamp'][4]).upper())
        indexes = {r[1] for r in conn.execute('PRAGMA index_list(audit_log)')}
        self.assertTrue({'idx_audit_log_record_time','idx_audit_log_actor_time'} <= indexes)
        names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='trigger'")}
        self.assertTrue({'trg_app_user_audit_insert','trg_app_user_audit_update',
                         'trg_app_user_audit_delete','trg_user_permission_audit_insert',
                         'trg_user_permission_audit_update','trg_user_permission_audit_delete',
                         'trg_audit_log_no_delete','trg_audit_log_no_update'} <= names)
        self.assertEqual(conn.execute('SELECT COUNT(*) FROM audit_log').fetchone()[0], 0)
        self.assertEqual(conn.execute('PRAGMA foreign_key_check').fetchall(), [])
        self.assertEqual(conn.execute('PRAGMA integrity_check').fetchone(), ('ok',))

    def test_02_grant_revoke_reactivate_actor_and_stamp(self):
        conn=self.conn
        uid = user(conn)
        conn.execute('INSERT INTO user_permission(userId,rightCode,status,stamp) VALUES (?,?,?,?)',
                     (uid,'customer.add','Active','FAKE REQUEST STAMP'))
        stamp = conn.execute('SELECT stamp FROM user_permission WHERE userId=?', (uid,)).fetchone()[0]
        self.assertRegex(stamp, r'^RIGHTS_UPDATED auditor-test \d{4}-\d\d-\d\d \d\d:\d\d:\d\d$')
        self.assertEqual(len(logs(conn)), 1)
        self.assertEqual(logs(conn)[0][0:4], ('auditor-test','RIGHTS_UPDATED','user_permission',str(uid)))
        self.assertEqual(json.loads(logs(conn)[0][4]),
                         {'before':None,'after':{'userId':uid,'rightCode':'customer.add','status':'Active'}})
        conn.execute("UPDATE user_permission SET status='Inactive' WHERE userId=?",(uid,))
        self.assertEqual(json.loads(logs(conn)[1][4])['after']['status'],'Inactive')
        self.assertEqual(json.loads(logs(conn)[1][4])['before']['status'],'Active')
        conn.execute("UPDATE user_permission SET status='Active' WHERE userId=?",(uid,))
        self.assertEqual(json.loads(logs(conn)[2][4])['after']['status'],'Active')
        conn.execute('DELETE FROM user_permission WHERE userId=?',(uid,))
        self.assertIsNone(json.loads(logs(conn)[3][4])['after'])
        self.assertEqual(len(logs(conn)),4)

    def test_03_actor_context_mandatory_fail_closed(self):
        conn = prepared(actor=None)
        try:
            with self.assertRaises(sqlite3.OperationalError):
                user(conn)
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM app_user').fetchone(),(0,))
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM audit_log').fetchone(),(0,))
            # Rights-catalog modifications must also reject no context.
            with self.assertRaises(sqlite3.OperationalError):
                conn.execute("UPDATE rights SET description='CHANGED' WHERE rightCode='customer.add'")
        finally:
            conn.close()
        bind_audit_actor(self.conn,'operator-99')
        uid = user(self.conn,'other-actor@example.invalid')
        self.assertEqual(logs(self.conn,'app_user')[-1][0],'operator-99')
        self.assertEqual(self.conn.execute('SELECT stamp FROM app_user WHERE userId=?',(uid,)).fetchone()[0].split()[1],'operator-99')
        with self.assertRaises(ValueError):
            bind_audit_actor(self.conn, 'actor\nspoof')

    def test_04_user_actions_and_password_safety(self):
        c=self.conn
        uid=user(c)
        c.execute('UPDATE app_user SET firstName=? WHERE userId=?',('Changed',uid))
        c.execute('UPDATE app_user SET isBlocked=1 WHERE userId=?',(uid,))
        c.execute('UPDATE app_user SET isBlocked=0 WHERE userId=?',(uid,))
        c.execute("UPDATE app_user SET status='Inactive' WHERE userId=?",(uid,))
        c.execute("UPDATE app_user SET status='Active' WHERE userId=?",(uid,))
        c.execute("UPDATE app_user SET passwordHash='SENSITIVE_NEW_HASH' WHERE userId=?",(uid,))
        c.execute('DELETE FROM app_user WHERE userId=?',(uid,))
        entries=logs(c,'app_user')
        self.assertEqual([e[1] for e in entries],
                         ['CREATED','EDITED','BLOCKED','UNBLOCKED','DELETED','RESTORED','EDITED','DELETED'])
        self.assertTrue(json.loads(entries[-2][4])['passwordHashChanged'])
        self.assertNotIn('SENSITIVE_NEW_HASH',repr(entries))
        self.assertNotIn('TEST_HASH_NOT_A_CREDENTIAL',repr(entries))
        self.assertTrue(all(re.fullmatch(r'\d{4}-\d\d-\d\d \d\d:\d\d:\d\d', e[5]) for e in entries))
        self.assertEqual(json.loads(entries[-1][4])['after'],None)

    def test_05_catalog_and_fk_cascade(self):
        c=self.conn
        uid=user(c)
        c.execute("INSERT INTO rights(rightCode,moduleCode,description) VALUES ('test.audit','customer','test')")
        c.execute('INSERT INTO user_permission(userId,rightCode,stamp) VALUES (?,?,?)',(uid,'test.audit','PENDING'))
        c.execute("UPDATE rights SET description='edited' WHERE rightCode='test.audit'")
        c.execute("DELETE FROM rights WHERE rightCode='test.audit'")
        self.assertEqual([e[1] for e in logs(c,'rights')],['CREATED','EDITED','DELETED'])
        self.assertEqual([e[1] for e in logs(c)],['RIGHTS_UPDATED','RIGHTS_UPDATED'])
        self.assertIsNone(json.loads(logs(c)[-1][4])['after'])
        c.execute('INSERT INTO user_permission(userId,rightCode,stamp) VALUES (?,?,?)', (uid,'customer.add','PENDING'))
        c.execute('DELETE FROM app_user WHERE userId=?',(uid,))
        self.assertEqual(len(logs(c)),4)
        self.assertEqual(c.execute('PRAGMA foreign_key_check').fetchall(),[])

    def test_06_atomic_rollback_and_append_only_history(self):
        c=self.conn
        before=c.execute('SELECT COUNT(*) FROM audit_log').fetchone()[0]
        c.execute('SAVEPOINT audit_tx')
        uid=user(c)
        c.execute('INSERT INTO user_permission(userId,rightCode,stamp) VALUES (?,?,?)',(uid,'customer.add','PENDING'))
        c.execute('ROLLBACK TO audit_tx')
        c.execute('RELEASE audit_tx')
        self.assertEqual(c.execute('SELECT COUNT(*) FROM audit_log').fetchone()[0],before)
        self.assertEqual(c.execute('SELECT COUNT(*) FROM app_user').fetchone()[0],0)
        uid=user(c)
        with self.assertRaises(sqlite3.IntegrityError):
            c.execute("UPDATE audit_log SET action='EDITED'")
        with self.assertRaises(sqlite3.IntegrityError):
            c.execute('DELETE FROM audit_log')
        with self.assertRaises(sqlite3.IntegrityError):
            c.execute("INSERT INTO audit_log(performedBy,action,tableName,recordId) VALUES ('spoof','EDITED','app_user','1')")
        self.assertEqual(c.execute('SELECT COUNT(*) FROM audit_log').fetchone(),(1,))

    def test_07_explicit_stamp_write_is_attributed(self):
        c=self.conn
        uid=user(c)
        c.execute('INSERT INTO user_permission(userId,rightCode,stamp) VALUES (?,?,?)',(uid,'customer.add','PENDING'))
        baseline=len(logs(c))
        c.execute("UPDATE user_permission SET stamp='FORGED' WHERE userId=?",(uid,))
        self.assertEqual(len(logs(c)), baseline+1)
        self.assertIn('RIGHTS_UPDATED auditor-test', c.execute('SELECT stamp FROM user_permission WHERE userId=?',(uid,)).fetchone()[0])
        c.execute("UPDATE app_user SET stamp='FORGED' WHERE userId=?",(uid,))
        self.assertEqual([e[1] for e in logs(c,'app_user')], ['CREATED','EDITED'])
        self.assertIn('EDITED auditor-test', c.execute('SELECT stamp FROM app_user WHERE userId=?',(uid,)).fetchone()[0])

    def test_08_repeatable_migration_and_artifacts(self):
        c=self.conn
        c.executescript((ROOT/FILES[-1]).read_text(encoding='utf-8'))
        self.assertEqual(c.execute('SELECT COUNT(*) FROM audit_log').fetchone(),(0,))
        uid=user(c)
        self.assertEqual(len(logs(c,'app_user')),1)
        c.execute('PRAGMA recursive_triggers=OFF')
        c.execute('UPDATE app_user SET isBlocked=1 WHERE userId=?',(uid,))
        self.assertEqual(len(logs(c,'app_user')),2)
        self.assertEqual(c.execute('PRAGMA integrity_check').fetchone(),('ok',))


def check_artifacts():
    for name in ('HopeERP.db','HOPE_Model1.db'):
        conn=sqlite3.connect(ROOT/name)
        try:
            self_cols={r[1] for r in conn.execute('PRAGMA table_info(audit_log)')}
            assert 'performedBy' in self_cols, f'{name}: audit_log missing'
            assert conn.execute('SELECT COUNT(*) FROM audit_log').fetchone() == (0,), f'{name}: unexpectedly has audit rows'
            assert conn.execute('PRAGMA integrity_check').fetchone() == ('ok',)
            assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
            assert conn.execute('SELECT COUNT(*) FROM rights').fetchone() == (36,)
            print('PASS artifact:',name)
        finally:conn.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-artifacts',action='store_true')
    args=parser.parse_args()
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(AuditTrailTests))
    if not result.wasSuccessful():
        raise SystemExit(1)
    if args.check_artifacts:
        check_artifacts()
    print('S1-DBA-06: ALL AUDIT TESTS PASSED')


if __name__ == '__main__':
    main()
