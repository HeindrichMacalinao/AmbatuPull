#!/usr/bin/env python3
"""Verify the Sprint 1 QA plan and fixture contracts without a live AUT."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / "docs/testing/sprint-1-test-plan.md"
ROLES = ROOT / "docs/testing/01_test_roles_and_rights.sql"
ACCOUNTS = ROOT / "docs/testing/02_test_accounts.sql"
CLEANUP = ROOT / "docs/testing/99_cleanup_test_data.sql"

RIGHTS = [
    "customer.view", "customer.create", "customer.delete",
    "product.view", "product.create", "product.edit", "product.delete",
    "product.import", "product.export",
    "hr.view", "hr.create", "hr.edit", "hr.delete", "hr.block", "hr.roles",
    "hr.rights", "hr.attendance", "hr.leave", "hr.payroll", "hr.documents",
    "hr.export", "hr.audit",
    "sales.view", "sales.create", "sales.edit", "sales.delete", "sales.refund",
    "sales.export", "sales.discount",
    "reports.view", "reports.sales", "reports.inventory", "reports.hr",
    "reports.financial", "reports.export", "reports.audit",
]


def main() -> None:
    for path in (PLAN, ROLES, ACCOUNTS, CLEANUP):
        assert path.is_file(), f"Missing QA artifact: {path}"

    plan = PLAN.read_text(encoding="utf-8")
    assert "TC-AUTH-001" in plan and "TC-RBAC-008" in plan
    assert "last-active-Superadmin" in plan
    assert "36-rights catalogue" in plan

    roles = ROLES.read_text(encoding="utf-8")
    seeded_rights = re.findall(r"\('([a-z]+\.[a-z]+)',\s*'([a-z]+)'", roles)
    assert len(seeded_rights) == 36
    assert [right for right, _ in seeded_rights] == RIGHTS
    assert {module for _, module in seeded_rights} == {
        "customer", "product", "hr", "sales", "reports"
    }

    accounts = ACCOUNTS.read_text(encoding="utf-8")
    emails = re.findall(r"'(test_[^']+@hope\.com)'", accounts)
    assert len(set(emails)) == 8
    assert "passwordHash" in accounts and "isBlocked" in accounts
    assert "$2b$12$" in accounts

    cleanup = CLEANUP.read_text(encoding="utf-8")
    assert 'email LIKE \'test_%\'' in cleanup
    assert 'DELETE FROM app_user' in cleanup
    assert 'DELETE FROM user_permission' in cleanup
    assert '"rightCode"' in cleanup and '"roleName"' in cleanup

    print("PASS: Sprint 1 QA plan, 36 rights, 8 accounts, and cleanup contract")


if __name__ == "__main__":
    main()
