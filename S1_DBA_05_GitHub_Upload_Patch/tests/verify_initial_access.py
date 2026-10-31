#!/usr/bin/env python3
"""S1-DBA-05 deterministic DB seed and protected Superadmin setup tests.

Run: python3 -B tests/verify_initial_access.py [--check-artifacts]
No live passwords, reset tokens, network services, or production data changes.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from seed_superadmins import HANDLES, SetupError, load_accounts, provision  # noqa: E402
from regenerate_hope import rebuild  # noqa: E402

BASE = ROOT / 'db/migrations/001_hope_base_tables.sql'
HISTORY = ROOT / 'db/seeds/002_hope_historical_data.sql'
USERS = ROOT / 'db/migrations/002_user_management_tables.sql'
RESET = ROOT / 'db/migrations/003_password_reset_token.sql'
SEED = ROOT / 'db/seeds/003_initial_access_catalog.sql'
FILES = (BASE, HISTORY, USERS, RESET, SEED)

MODULES = {
    'customer': 'Customer', 'product': 'Product',
    'human_resources': 'Human Resources', 'sales': 'Sales', 'reports': 'Reports',
}
RIGHTS = {
    'customer': {
        'customer.add': 'Add Customer',
        'customer.edit': 'Edit Customer',
        'customer.delete': 'Delete Customer (Soft delete)',
    },
    'product': {
        'product.add': 'Add Product', 'product.edit': 'Edit Product',
        'product.delete': 'Delete Product', 'price.add': 'Add Price',
        'price.edit': 'Edit Price', 'price.delete': 'Delete Price',
    },
    'human_resources': {
        'job.add': 'Add Job', 'job.edit': 'Edit Job',
        'job.delete': 'Delete Job', 'dept.add': 'Add Department',
        'dept.edit': 'Edit Department', 'dept.delete': 'Delete Department',
        'emp.add': 'Add Employee', 'emp.edit': 'Edit Employee',
        'emp.delete': 'Delete Employee',
        'jobhistory.view': 'View Job History (Data Privacy Act gatekeeper)',
        'jobhistory.add': 'Add Job History',
        'jobhistory.edit': 'Edit Job History',
        'jobhistory.delete': 'Delete Job History',
    },
    'sales': {
        'sale.add': 'Add Sale', 'sale.edit': 'Edit Sale',
        'sale.delete': 'Delete Sale', 'saledetail.view': 'View Sale Detail',
        'saledetail.add': 'Add Sale Detail',
        'saledetail.edit': 'Edit Sale Detail',
        'saledetail.delete': 'Delete Sale Detail',
    },
    'reports': {
        'report.top_customers': 'Top Customers Report',
        'report.product_master': 'Product Master Report',
        'report.top_products': 'Top Products Report',
        'report.active_emp': 'Active Employees Report',
        'report.all_emp': 'All Employees Report',
        'report.emp_job_history': 'Employee Job History Report',
        'report.top_sales': 'Top Sales Report',
    },
}
EXPECTED_RIGHTS = {(code, module, description) for module, rights in RIGHTS.items()
                   for code, description in rights.items()}
assert {module: len(rights) for module, rights in RIGHTS.items()} == {
    'customer': 3, 'product': 6, 'human_resources': 13, 'sales': 7, 'reports': 7
}
assert len(EXPECTED_RIGHTS) == 36
HISTORICAL_COUNTS = {
    'CUSTOMER': 82, 'PRODUCT': 57, 'PRICEHIST': 79, 'EMPLOYEE': 32,
    'JOB': 14, 'DEPARTMENT': 8, 'JOBHISTORY': 54, 'SALES': 124,
    'SALESDETAIL': 313, 'PAYMENT': 165,
}


def apply_sql(conn: sqlite3.Connection, path: Path) -> None:
    conn.executescript(path.read_text(encoding='utf-8'))


def check_catalog(conn: sqlite3.Connection) -> None:
    modules = dict(conn.execute('SELECT moduleCode, moduleName FROM module'))
    assert modules == MODULES, (modules, MODULES)
    rights = set(conn.execute('SELECT rightCode, moduleCode, description FROM rights'))
    assert rights == EXPECTED_RIGHTS, f'36-right catalog mismatch: extra={rights-EXPECTED_RIGHTS}; missing={EXPECTED_RIGHTS-rights}'
    assert conn.execute('SELECT COUNT(*) FROM role WHERE roleName=?', ('Superadmin',)).fetchone() == (1,)
    assert conn.execute('PRAGMA foreign_keys').fetchone() == (1,)
    assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
    assert conn.execute('PRAGMA integrity_check').fetchone() == ('ok',)


def example_test_accounts() -> list[dict[str, str]]:
    # Deliberately non-authentic Argon2id FORMAT EXAMPLES. No real credentials,
    # passwords or production account details are held in repository/tests.
    return [{
        'handle': handle,
        'firstName': handle,
        'lastName': 'TestOnly',
        'email': f'ci-{i}@example.invalid',
        'passwordHash': f'$argon2id$v=19$m=65536,t=3,p=1$TESTSALT{i:02d}A$TESTDIGEST{i:02d}B',
    } for i, handle in enumerate(sorted(HANDLES), start=1)]


class InitialAccessSeedTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory(prefix='s1-dba-05-')
        self.addCleanup(self.directory.cleanup)
        self.db = Path(self.directory.name) / 'fresh.db'
        self.conn = sqlite3.connect(self.db)
        self.addCleanup(self.conn.close)
        self.conn.execute('PRAGMA foreign_keys=ON')
        for sql in FILES:
            apply_sql(self.conn, sql)

    def account_file(self, accounts: list[dict[str, str]]) -> Path:
        path = Path(self.directory.name) / 'owner-only.json'
        path.write_text(json.dumps(accounts), encoding='utf-8')
        if os.name == 'posix':
            path.chmod(0o600)
        return path

    def test_01_exact_modules_and_rights(self) -> None:
        check_catalog(self.conn)
        self.assertEqual(
            {name: len(rights) for name, rights in RIGHTS.items()},
            {'customer': 3, 'product': 6, 'human_resources': 13, 'sales': 7, 'reports': 7},
        )
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM app_user').fetchone(), (0,))
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM user_permission').fetchone(), (0,))
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM password_reset_token').fetchone(), (0,))

    def test_02_idempotence_and_source_integrity(self) -> None:
        before = {name: self.conn.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
                  for name in HISTORICAL_COUNTS}
        self.assertEqual(before, HISTORICAL_COUNTS)
        self.assertEqual(sum(before.values()), 928)
        apply_sql(self.conn, SEED)
        check_catalog(self.conn)
        after = {name: self.conn.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
                 for name in HISTORICAL_COUNTS}
        self.assertEqual(before, after)

    def test_03_foreign_keys_and_catalog_drift_detection(self) -> None:
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute('INSERT INTO rights VALUES (?,?,?)', ('invalid.code', 'other', 'Orphan'))
        try:
            self.conn.execute("UPDATE rights SET description='Tampered' WHERE rightCode='customer.add'")
            with self.assertRaisesRegex(AssertionError, 'catalog mismatch'):
                check_catalog(self.conn)
            # Idempotent seed never overwrites unauthorized existing rights.
            apply_sql(self.conn, SEED)
            with self.assertRaisesRegex(AssertionError, 'catalog mismatch'):
                check_catalog(self.conn)
        finally:
            # Restore the isolated test database after simulating drift.
            self.conn.execute("UPDATE rights SET description='Add Customer' WHERE rightCode='customer.add'")
            self.conn.commit()
        check_catalog(self.conn)

    def test_04_provision_five_superadmins_without_plaintext(self) -> None:
        accounts = example_test_accounts()
        config = self.account_file(accounts)
        verified = load_accounts(config)
        self.assertEqual({a['handle'] for a in verified}, HANDLES)
        self.assertEqual(provision(self.db, verified), (5, 0))
        self.assertEqual(provision(self.db, verified), (0, 5))
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM app_user WHERE role='Superadmin' AND isBlocked=0 AND status='Active'").fetchone(), (5,))
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM user_permission').fetchone(), (0,))
        self.assertEqual(self.conn.execute('PRAGMA foreign_key_check').fetchall(), [])
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM password_reset_token').fetchone(), (0,))
        check_catalog(self.conn)

    def test_05_invalid_or_unsafe_account_configuration(self) -> None:
        accounts = example_test_accounts()
        bad_cases = []
        for replacement in (
            {'passwordHash': 'plain-text-password'},
            {'passwordHash': '$2b$04$' + 'A' * 53},
            {'passwordHash': accounts[0]['passwordHash']},
            {'handle': 'UnknownAccount'},
            {'email': 'bad-email'},
            {'firstName': ' '},
        ):
            altered = [dict(a) for a in accounts]
            altered[1].update(replacement)
            bad_cases.append(altered)
        for altered in bad_cases:
            config = self.account_file(altered)
            with self.assertRaises(SetupError):
                load_accounts(config)
        with self.assertRaises(SetupError):
            load_accounts(self.account_file(accounts[:-1]))
        if os.name == 'posix':
            config = self.account_file(accounts)
            config.chmod(0o644)
            with self.assertRaisesRegex(SetupError, 'chmod 600'):
                load_accounts(config)

    def test_06_conflict_rolls_back_without_privilege_escalation(self) -> None:
        accounts = example_test_accounts()
        # A conflicting non-privileged user must not be silently promoted.
        self.conn.execute('''INSERT INTO app_user
            (firstName,lastName,email,passwordHash,role,stamp)
            VALUES (?,?,?,?,?,?)''',
            (accounts[-1]['firstName'], accounts[-1]['lastName'], accounts[-1]['email'],
             accounts[-1]['passwordHash'], 'User', 'TEST ONLY'))
        self.conn.commit()
        with self.assertRaisesRegex(SetupError, 'conflicting existing account'):
            provision(self.db, load_accounts(self.account_file(accounts)))
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM app_user').fetchone(), (1,))
        self.assertEqual(self.conn.execute("SELECT role FROM app_user WHERE email=?", (accounts[-1]['email'],)).fetchone(), ('User',))
        self.assertEqual(self.conn.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_07_detect_missing_catalog_entry(self) -> None:
        self.conn.execute("DELETE FROM rights WHERE rightCode='report.top_sales'")
        self.conn.commit()
        with self.assertRaises(AssertionError):
            check_catalog(self.conn)
        with self.assertRaisesRegex(SetupError, 'catalog seed'):
            provision(self.db, load_accounts(self.account_file(example_test_accounts())))

    def test_08_regeneration_cannot_destroy_initialized_accounts(self) -> None:
        accounts = load_accounts(self.account_file(example_test_accounts()))
        provision(self.db, accounts)
        with self.assertRaisesRegex(RuntimeError, 'Refusing to overwrite'):
            rebuild(self.db, None)
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM app_user').fetchone(), (5,))

    def test_09_provisioning_refuses_tracked_database(self) -> None:
        accounts = load_accounts(self.account_file(example_test_accounts()))
        with self.assertRaisesRegex(SetupError, 'outside the Git repository'):
            provision(ROOT / 'HopeERP.db', accounts)


def check_artifacts() -> None:
    for database in ('HopeERP.db', 'HOPE_Model1.db'):
        path = ROOT / database
        assert path.is_file(), f'Missing {path}'
        conn = sqlite3.connect(path)
        try:
            conn.execute('PRAGMA foreign_keys=ON')
            check_catalog(conn)
            assert conn.execute('SELECT COUNT(*) FROM password_reset_token').fetchone() == (0,)
            for name, count in HISTORICAL_COUNTS.items():
                assert conn.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone() == (count,), name
            print(f'PASS: integrated artifact {database}: five modules, 36 rights, historical data intact')
        finally:
            conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-artifacts', action='store_true')
    args = parser.parse_args()
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(InitialAccessSeedTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
    if args.check_artifacts:
        check_artifacts()
    print('ALL S1-DBA-05 SEED VERIFICATIONS PASSED')


if __name__ == '__main__':
    main()
