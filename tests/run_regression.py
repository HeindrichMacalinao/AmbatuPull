#!/usr/bin/env python3
"""Run the Sprint 1 deterministic and HTTP contract regression suites."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

COMMANDS = [
    ("QA fixtures", [sys.executable, "tests/verify_qa_fixtures.py"]),
    ("Authentication contract", [sys.executable, "tests/verify_auth_contract.py"]),
    ("User management contract", [sys.executable, "tests/verify_user_management_contract.py"]),
    ("Permission matrix contract", [sys.executable, "tests/verify_permission_matrix.py"]),
    ("Smoke contract", [sys.executable, "tests/verify_smoke_contract.py"]),
    ("Authentication HTTP suite", ["node", "--test", "tests/auth-flow.test.js"]),
    ("User management HTTP suite", ["node", "--test", "tests/user-management.test.js"]),
    ("Permission matrix HTTP suite", ["node", "--test", "tests/permission-matrix.test.js"]),
    ("Smoke HTTP suite", ["node", "--test", "tests/smoke.test.js"]),
]


def main() -> int:
    failures = []
    for label, command in COMMANDS:
        print(f"\n== {label} ==")
        result = subprocess.run(command, cwd=ROOT, check=False)
        if result.returncode:
            failures.append(label)

    if failures:
        print(f"\nFAIL: regression suites: {', '.join(failures)}")
        return 1
    print("\nPASS: all deterministic and HTTP contract suites completed")
    print("HTTP suites may report skipped cases when BASE_URL is unset.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

