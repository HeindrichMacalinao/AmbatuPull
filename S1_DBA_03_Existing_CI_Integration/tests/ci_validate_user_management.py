#!/usr/bin/env python3
"""S1-DBA-03 CI checks, using fresh in-memory SQLite databases.

Requires the S1-DBA-02 base migration + historical seed, the S1-DBA-03
migration, and tests/verify_user_management.py from the earlier task.
No production database, external service, credentials, or third-party modules.

Run from anywhere: python -B tests/ci_validate_user_management.py
Nonzero exit status on any failed check (including an SQL execution error).
"""
from __future__ import annotations

import sqlite3
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tests"))
from verify_user_management import behavior, structure  # noqa: E402

BASE = ROOT / "db/migrations/001_hope_base_tables.sql"
HISTORICAL = ROOT / "db/seeds/002_hope_historical_data.sql"
USER = ROOT / "db/migrations/002_user_management_tables.sql"

# Historical counts from the supplied HopeDB_audit.sql, not mock data.
EXPECTED_BASELINE = {
    "CUSTOMER": 82, "PRODUCT": 57, "PRICEHIST": 79,
    "EMPLOYEE": 32, "JOB": 14, "DEPARTMENT": 8,
    "JOBHISTORY": 54, "SALES": 124, "SALESDETAIL": 313,
    "PAYMENT": 165,
}


def run_sql(connection: sqlite3.Connection, file: Path) -> None:
    if not file.is_file():
        raise FileNotFoundError(f"Required migration or seed missing: {file.relative_to(ROOT)}")
    connection.executescript(file.read_text(encoding="utf-8"))


def fresh_database(*, with_history: bool) -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    try:
        connection.execute("PRAGMA foreign_keys = ON")
        if connection.execute("PRAGMA foreign_keys").fetchone() != (1,):
            raise AssertionError("SQLite foreign-key enforcement is disabled")
        # Required order: Task 2 schema -> approved historical seed -> Task 3.
        run_sql(connection, BASE)
        if with_history:
            run_sql(connection, HISTORICAL)
        run_sql(connection, USER)
        return connection
    except BaseException:
        connection.close()
        raise


def check_integrity(connection: sqlite3.Connection) -> None:
    integrity = connection.execute("PRAGMA integrity_check").fetchone()
    if integrity != ("ok",):
        raise AssertionError(f"SQLite integrity_check failed: {integrity}")
    orphans = connection.execute("PRAGMA foreign_key_check").fetchall()
    if orphans:
        raise AssertionError(f"Foreign key violations: {orphans}")


class UserManagementMigrationCI(unittest.TestCase):
    def make_database(self, *, with_history: bool = False) -> sqlite3.Connection:
        conn = fresh_database(with_history=with_history)
        self.addCleanup(conn.close)
        return conn

    def test_01_fresh_schema_and_indexes(self) -> None:
        """Migration works on a fresh database after Task 2 schema only."""
        conn = self.make_database()
        structure(conn)  # exact tables, columns, PKs, 5 FKs, defaults, 2 indexes
        check_integrity(conn)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM app_user").fetchone()[0], 0)

    def test_02_historical_data_integrity(self) -> None:
        """The original approved Task 2 data remains present and consistent."""
        conn = self.make_database(with_history=True)
        structure(conn)
        counts = {
            table: conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            for table in EXPECTED_BASELINE
        }
        self.assertEqual(counts, EXPECTED_BASELINE)
        self.assertEqual(sum(counts.values()), 928)
        self.assertEqual(
            conn.execute("SELECT lastName, firstName FROM EMPLOYEE WHERE empNo='00001'").fetchone(),
            ("Smith", "John"),
        )
        for table in EXPECTED_BASELINE:
            bad = conn.execute(
                f'SELECT COUNT(*) FROM "{table}" WHERE status NOT IN (\'Active\', \'Inactive\') '
                'OR status IS NULL OR stamp IS NULL OR length(trim(stamp)) = 0'
            ).fetchone()[0]
            self.assertEqual(bad, 0, f"Bad audit data in {table}")
        check_integrity(conn)

    def test_03_constraints_and_junction_behavior(self) -> None:
        """Exercise duplicate email, FK rejection, status, cascade and soft disable."""
        conn = self.make_database(with_history=True)
        # Reuse the S1-DBA-03 negative/behavior checks; they roll back test data.
        behavior(conn)
        check_integrity(conn)

    def test_04_idempotent_user_migration(self) -> None:
        """A second application does not fail or create duplicate roles."""
        conn = self.make_database(with_history=True)
        before = {
            table: conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            for table in EXPECTED_BASELINE
        }
        run_sql(conn, USER)
        structure(conn)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM role").fetchone()[0], 3)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM app_user").fetchone()[0], 0)
        after = {
            table: conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            for table in EXPECTED_BASELINE
        }
        self.assertEqual(before, after)
        check_integrity(conn)

    def test_05_negative_control_missing_index_is_detected(self) -> None:
        """Prove CI fails schema validation if a required index is absent."""
        conn = self.make_database()
        conn.execute('DROP INDEX "idx_user_permission_userId"')
        with self.assertRaisesRegex(AssertionError, "Missing index"):
            structure(conn)

    def test_06_negative_control_orphan_is_detected(self) -> None:
        """Prove CI fails integrity validation for a corrupted FK relation."""
        conn = self.make_database()
        conn.execute("PRAGMA foreign_keys = OFF")
        conn.execute(
            "INSERT INTO rights(rightCode, moduleCode, description) VALUES (?, ?, ?)",
            ("CI_INVALID_RIGHT", "NONEXISTENT_MODULE", "Temporary negative control"),
        )
        conn.commit()
        conn.execute("PRAGMA foreign_keys = ON")
        with self.assertRaisesRegex(AssertionError, "Foreign key violations"):
            check_integrity(conn)


if __name__ == "__main__":
    if not __debug__:
        raise SystemExit("CI validation requires Python assertions (do not use -O)")
    unittest.main(verbosity=2)
