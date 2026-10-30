# Integrate S1-DBA-03 with the team's EXISTING GitHub Actions CI

Based on the posted CI task description, your team already runs Node.js 22, Python 3.x, `npm test`, and migration reset/status commands without Docker. Do NOT overwrite that workflow and do NOT add a duplicate standalone CI workflow merely for this task.

## Changes to make

1. Add `tests/ci_validate_user_management.py` from this patch into your repository's existing `tests/` directory.
2. Open the existing workflow under `.github/workflows/` (e.g. `ci.yml`; the screenshot doesn't reveal the actual filename).
3. **In the existing CI job**, after your existing migration validation step, add:

   ```yaml
   - name: Validate S1-DBA-03 user management migration
     run: python3 -B tests/ci_validate_user_management.py
   ```

4. Keep the existing checkout, Node.js 22 setup, Python setup, `npm ci` / `npm install`, `npm test`, and migration reset/status checks **unchanged**. The test uses only the Python standard library and SQLite; no Docker, extra pip packages, secrets, or cloud DB.
5. Commit the two changes to your Task 3 branch. Open the pull request; verify the **existing** CI workflow runs and passes in GitHub Actions. Do not report hosted CI success until the action is actually green.

## Required prior files (must exist in same branch)

- `db/migrations/001_hope_base_tables.sql` (Task 2)
- `db/seeds/002_hope_historical_data.sql` (Task 2)
- `db/migrations/002_user_management_tables.sql` (Task 3)
- `tests/verify_user_management.py` (Task 3)

If the existing branch uses different paths, adjust the Python script to match. If Tasks 1–3 are not present in this branch, merge/carry them forward first.

## What this validates

- Fresh SQLite database: applies Task 2 base schema, then Task 3 migration; checks five new tables, required columns, PKs/FKs, role/default/status constraints, and both required explicit indexes.
- Historical SQLite database: loads the approved Task 2 seed, applies Task 3, verifies all 928 original HOPE records and audit fields, and checks SQLite integrity and FK consistency.
- Enforces email case-insensitive uniqueness; rejects invalid constraints and orphaned relationships; confirms permission cascade deletion, composite key, and soft-disable behavior.
- Verifies idempotent reapplication, and has negative controls detecting a dropped index and an FK orphan.
- Python `unittest` exits nonzero on failed checks; GitHub Actions fails the job by default.

The script creates disposable in-memory SQLite databases. It does **not** run or replace your Node migration runner: the team's existing runner's pending-status check remains responsible for that. It does not modify committed `.db` files.

No application authorization or password hashing is tested or implemented.

## Run locally at repository root

```bash
python3 -B tests/ci_validate_user_management.py
```

Expected output: `Ran 6 tests` and `OK`.

**IMPORTANT:** The image is a GitHub issue/PR description, not the actual `.github/workflows/*.yml` code. Until the real workflow is inspected, this is an add-on instruction rather than an in-place modification of your team's real CI configuration.
