#!/usr/bin/env python3
"""Verify the Next.js forgot-password and reset-password route contracts."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORGOT_ROUTE = ROOT / "src/app/api/auth/forgot-password/route.ts"
RESET_ROUTE = ROOT / "src/app/api/auth/reset-password/route.ts"
DATABASE = ROOT / "src/lib/erp-db.ts"


def main() -> None:
    forgot = FORGOT_ROUTE.read_text(encoding="utf-8")
    reset = RESET_ROUTE.read_text(encoding="utf-8")
    database = DATABASE.read_text(encoding="utf-8")

    assert "requestPasswordReset(email)" in forgot
    assert "If the provided email is registered" in forgot
    assert "debugToken: process.env.NODE_ENV !== 'production' ? token : undefined" in forgot
    assert "completePasswordReset(token, password)" in reset
    assert "Passwords do not match" in reset
    assert "password_reset_token" in database
    assert "crypto.createHash('sha256')" in database
    assert "BEGIN IMMEDIATE" in database
    assert "ROLLBACK" in database
    assert "if (invalidation.error) throw invalidation.error;" in database
    assert "if (insertion.error) throw insertion.error;" in database
    recovery = database.split("export async function requestPasswordReset", 1)[1]
    assert "catch {}" not in recovery

    print("PASS: forgot-password/reset-password routes and durable token writes")


if __name__ == "__main__":
    main()
