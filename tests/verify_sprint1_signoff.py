#!/usr/bin/env python3
"""Verify that the Sprint 1 sign-off report reflects executable evidence."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "docs/testing/sprint-1-signoff.md"
TRIAGE = ROOT / "docs/testing/defect-triage.md"


def main() -> None:
    report = REPORT.read_text(encoding="utf-8")
    triage = TRIAGE.read_text(encoding="utf-8")

    for required in (
        "S1-TST-06",
        "npm test",
        "npm run test:auth",
        "npm run test:user-management",
        "npm run test:permission-matrix",
        "npm run test:smoke",
        "No production sign-off granted",
        "BASE_URL",
    ):
        assert required in report, required

    for required in ("Triage disposition", "no auth routes", "BLOCKED"):
        assert required in triage, required

    assert "Critical" in report and "High" in report
    print("PASS: Sprint 1 sign-off and defect-triage evidence contract")


if __name__ == "__main__":
    main()
