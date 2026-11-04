#!/usr/bin/env python3
"""Verify deterministic authentication fixtures and reset-token schema contracts."""
from __future__ import annotations

import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations/002_create_user_management.sql"
FIXTURE = ROOT / "docs/testing/02_test_accounts.sql"
RESULTS = ROOT / "docs/testing/results/auth-test-results.md"


def main() -> None:
    migration = MIGRATION.read_text(encoding="utf-8")
    fixture = FIXTURE.read_text(encoding="utf-8")
    results = RESULTS.read_text(encoding="utf-8")

    assert "CREATE TABLE IF NOT EXISTS password_reset_token" in migration
    for column in ("tokenHash", "expiresAt", "isUsed", "usedAt"):
        assert re.search(rf"\b{column}\b", migration), column
    assert "tokenHash VARCHAR(255)" in migration
    assert "ON DELETE CASCADE" in migration

    hashes = re.findall(r"\$2b\$12\$[A-Za-z0-9./]{53}", fixture)
    assert len(hashes) >= 8
    assert all(len(value) == 60 for value in hashes)
    assert "passwordHash" in fixture
    assert "password_hash" not in fixture
    assert "NewQaPassword!123" not in fixture

    connection = sqlite3.connect(":memory:")
    try:
        connection.executescript(
            """
            CREATE TABLE app_user (userId INTEGER PRIMARY KEY);
            """
        )
        reset_start = migration.index(
            "CREATE TABLE IF NOT EXISTS password_reset_token"
        )
        reset_end = migration.index("-- Performance Indexes", reset_start)
        connection.executescript(migration[reset_start:reset_end])
        columns = {
            row[1] for row in connection.execute(
                'PRAGMA table_info("password_reset_token")'
            )
        }
        assert {"tokenHash", "expiresAt", "isUsed", "usedAt"} <= columns
    finally:
        connection.close()

    assert "TC-REG-01" in results
    assert "TC-AUTH-04" in results
    assert "TC-RST-04" in results
    print("PASS: authentication fixture, reset-token schema, and result contract")


if __name__ == "__main__":
    main()
