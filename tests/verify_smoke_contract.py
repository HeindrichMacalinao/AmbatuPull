#!/usr/bin/env python3
"""Verify the Sprint 1 smoke-suite contract and fixture dependencies."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SMOKE = ROOT / "tests/smoke.test.js"
FIXTURE = ROOT / "docs/testing/02_test_accounts.sql"
RESULTS = ROOT / "docs/testing/results/smoke-test-results.md"


def main() -> None:
    smoke = SMOKE.read_text(encoding="utf-8")
    fixture = FIXTURE.read_text(encoding="utf-8")
    results = RESULTS.read_text(encoding="utf-8")

    assert smoke.count("test(") == 3
    for path in ("/api/auth/login", "/dashboard"):
        assert path in smoke
    assert "test_superadmin@hope.com" in fixture
    assert "test_user.norights@hope.com" in fixture
    assert "test_blocked@hope.com" in fixture
    assert "set-cookie" in smoke
    assert re.search(r"blocked", smoke, re.IGNORECASE)
    assert "under 30 seconds" in results
    for case in ("SMOKE-001", "SMOKE-002", "SMOKE-003"):
        assert case in results
    print("PASS: smoke login, dashboard navigation, and blocked-account contract")


if __name__ == "__main__":
    main()

