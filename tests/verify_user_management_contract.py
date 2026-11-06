#!/usr/bin/env python3
"""Verify user-management fixtures and database safeguards for issue #27."""
from __future__ import annotations

import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations/002_create_user_management.sql"
FIXTURE = ROOT / "docs/testing/02_test_accounts.sql"
RESULTS = ROOT / "docs/testing/results/user-management-test-results.md"


def main() -> None:
    migration = MIGRATION.read_text(encoding="utf-8")
    fixture = FIXTURE.read_text(encoding="utf-8")
    results = RESULTS.read_text(encoding="utf-8")

    assert "isBlocked BOOLEAN NOT NULL DEFAULT 0" in migration
    assert "status VARCHAR(8) NOT NULL DEFAULT 'Active'" in migration
    assert "stamp VARCHAR(80) NOT NULL" in migration
    assert "FOREIGN KEY (role)" in migration
    assert "password_reset_token" in migration

    accounts = re.findall(r"'(test_[^']+@hope\.com)'", fixture)
    assert set(accounts) >= {
        "test_superadmin@hope.com",
        "test_superadmin.second@hope.com",
        "test_admin@hope.com",
        "test_admin.peer@hope.com",
        "test_user@hope.com",
        "test_blocked@hope.com",
        "test_deleted@hope.com",
    }
    assert "'Superadmin'" in fixture and "'Admin'" in fixture and "'User'" in fixture
    assert "isBlocked" in fixture and "Inactive" in fixture

    connection = sqlite3.connect(":memory:")
    try:
        connection.executescript(
            """
            CREATE TABLE role (roleName TEXT PRIMARY KEY);
            INSERT INTO role VALUES ('Superadmin'), ('Admin'), ('User');
            CREATE TABLE EMPLOYEE (empNo TEXT PRIMARY KEY);
            """
        )
        start = migration.index("CREATE TABLE IF NOT EXISTS app_user")
        end = migration.index("-- 5. USER_PERMISSION", start)
        connection.executescript(migration[start:end])
        cols = {
            row[1] for row in connection.execute('PRAGMA table_info("app_user")')
        }
        assert {"role", "isBlocked", "status", "stamp"} <= cols
        connection.execute(
            """
            INSERT INTO app_user
              (firstName, lastName, email, passwordHash, role, stamp)
            VALUES ('A', 'User', 'a@example.invalid', 'hash', 'User', 'ADD test')
            """
        )
        user_id = connection.execute(
            "SELECT userId FROM app_user WHERE email='a@example.invalid'"
        ).fetchone()[0]
        for value in ("Admin", "Superadmin"):
            connection.execute(
                "UPDATE app_user SET role=? WHERE userId=?", (value, user_id)
            )
        connection.execute(
            "UPDATE app_user SET isBlocked=1, status='Inactive' WHERE userId=?",
            (user_id,),
        )
        assert connection.execute(
            "SELECT role, isBlocked, status FROM app_user WHERE userId=?",
            (user_id,),
        ).fetchone() == ("Superadmin", 1, "Inactive")
    finally:
        connection.close()

    for case in (
        "TC-UM-01", "TC-UM-02", "TC-UM-03", "TC-BLK-01",
        "TC-BLK-02", "TC-BLK-03", "TC-SA-01",
    ):
        assert case in results
    print("PASS: user-management role, blocking, audit, and safeguard contract")


if __name__ == "__main__":
    main()
