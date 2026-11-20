#!/usr/bin/env python3
"""Verify the Sprint 2 quality sign-off report and its evidence contract."""
from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "docs/testing/sprint-2-signoff.md"


def main() -> None:
    report = REPORT.read_text(encoding="utf-8")

    for required in (
        "S2-TST-06",
        "Scope:** Sprint 2 delivery issues #100-#123",
        "24/24 = 100%",
        "Open Critical/High defects in scope:** 0",
        "npm test",
        "npm run test:customer",
        "tests/s2-tst-02-product-price-acceptance.test.cjs",
        "tests/s2-tst-03-soft-delete-restore-acceptance.test.cjs",
        "tests/s2-tst-04-permission-matrix-acceptance.test.cjs",
        "tests/s2-tst-05-sprint1-regression.test.cjs",
        "Runtime test cases executed in this environment:** 0",
        "no production sign-off is granted",
        "Final disposition:",
    ):
        assert required in report, required

    for evidence in (
        "tests/verify_active_views.py",
        "tests/verify_domain_constraints.py",
        "tests/verify_customer_product_restrict.py",
        "tests/verify_sprint2_demo_seed.py",
    ):
        assert (ROOT / evidence).is_file(), evidence

    assert report.count("| #100-#105 |") == 1
    assert report.count("| #106-#110 |") == 1
    assert report.count("| #111-#118 |") == 1
    assert report.count("| #119-#123 |") == 1
    print("PASS: Sprint 2 quality sign-off evidence contract")


if __name__ == "__main__":
    main()
