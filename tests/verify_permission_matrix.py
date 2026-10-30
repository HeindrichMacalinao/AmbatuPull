#!/usr/bin/env python3
"""Verify the complete 36-right permission matrix and fixture consistency."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MATRIX = ROOT / "docs/testing/permission-matrix.md"
SEED = ROOT / "docs/testing/01_test_roles_and_rights.sql"
RESULTS = ROOT / "docs/testing/results/permission-matrix-test-results.md"

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
    matrix = MATRIX.read_text(encoding="utf-8")
    seed = SEED.read_text(encoding="utf-8")
    results = RESULTS.read_text(encoding="utf-8")

    assert matrix.count("**Total: 36 unique rights.**") == 1
    for right in RIGHTS:
        assert matrix.count(f"`{right}`") >= 1, right
        assert seed.count(f"('{right}'") == 1, right

    seeded = re.findall(r"\('([a-z]+\.[a-z]+)',\s*'([a-z_]+)'", seed)
    assert [right for right, _ in seeded] == RIGHTS
    assert len(set(seeded)) == 36
    assert "All" in matrix and "None" in matrix
    assert "customer.delete" in matrix
    assert "403" in matrix
    assert "audit" in matrix.lower()

    for case in ("TC-RIGHT-001", "TC-RIGHT-002", "TC-RIGHT-003"):
        assert case in results
    print("PASS: 36-right matrix, seed catalogue, All/None, deny, and audit contract")


if __name__ == "__main__":
    main()

