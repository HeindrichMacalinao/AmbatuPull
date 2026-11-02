# S1-DBA-05 — Initial access catalog and secure Superadmin setup

**Issue:** [HeindrichMacalinao/AmbatuPull #10](https://github.com/HeindrichMacalinao/AmbatuPull/issues/10)  
**Scope:** SQLite catalog seed for the five modules / 36 rights listed in the supplied issue image; five named Superadmin accounts initialized with real credentials through a separate trusted operator step.

## Root cause / objective

S1-DBA-03 created `module`, `rights`, and `app_user` tables but deliberately left them unpopulated because the 36-right source list, verified email addresses, and secure initial credentials were not supplied. S1-DBA-05 now supplies the exact rights list and identifies five Superadmin team handles.

This is a **missing initial data/configuration requirement**, not evidence of a confirmed exploitable application vulnerability. Database rows alone cannot establish that the application's authorization checks work.

## Changes

- `db/seeds/003_initial_access_catalog.sql`: inserts five modules (`customer`, `product`, `human_resources`, `sales`, `reports`) and the complete 36-right catalog. Rights per module: **3 / 6 / 13 / 7 / 7**. Inserts are idempotent on the same schema/data; seed does not overwrite conflicts, and validation detects mismatches.
- `scripts/regenerate_hope.py`: integrates the catalog after the S1-DBA-02, -03, -04 steps. Both rebuilt SQLite artifacts contain the catalog and retain all **928** approved historical HOPE records. It now refuses to overwrite databases with initialized users, grants, or reset tokens.
- `scripts/seed_superadmins.py`: trusted, opt-in provisioning for the five handles: **AlexGavarra, Chrollofuru, Tysennn, YthanOrogo, HeindrichMacalinao**. Requires each person's verified first/last name, email, and precomputed *application-compatible* bcrypt or Argon2id password hash supplied in a private JSON file **outside Git**. Validates all records before an atomic transaction. Never uses plaintext passwords, fake email addresses, default credentials, or silent privilege promotion.
- `tests/verify_initial_access.py`: verifies exact module and rights catalog, FK integrity, preserved historical source records, idempotence, drift detection, safe account provisioning, duplicate/conflict handling, file permissions, and destructive-rebuild protection.
- `tests/verify_user_management.py`: Task 3 regression now tolerates the approved module/right catalog, while asserting transactional fixtures never modify existing data.

## Database application order

1. `db/migrations/001_hope_base_tables.sql`
2. `db/seeds/002_hope_historical_data.sql`
3. `db/migrations/002_user_management_tables.sql`
4. `db/migrations/003_password_reset_token.sql`
5. **`db/seeds/003_initial_access_catalog.sql`**
6. **Secure account initialization**, only in a private deployment/test database, after verifying the app's chosen hash format.

Important: insert scripts into the team's authoritative migration/seed runner if it differs from the provided `scripts/regenerate_hope.py` implementation. This ZIP cannot establish how the live repository's Node migration runner works.

## Deterministic CI verification (no secrets)

From repo root:

```bash
python3 -B scripts/regenerate_hope.py
python3 -B tests/verify_initial_access.py --check-artifacts
python3 -B tests/verify_hope.py
python3 -B tests/verify_user_management.py
python3 -B tests/verify_password_reset_token.py --check-artifacts
python3 -B tests/ci_validate_user_management.py
```

Add to the existing GitHub Actions job after Python setup and database migrations:

```yaml
- name: Verify S1-DBA-05 module/rights seed
  run: python3 -B tests/verify_initial_access.py
```

The GitHub Actions runner **must not contain real team passwords or real hash files** for this seed validation. Tests use synthetic format-shaped strings on temporary databases, never production credentials.

## Provisioning real Superadmin accounts — private operator step

The screenshot supplies team *handles* but does not provide confirmed emails, first/last names, or authentic password hashes. Inserting guessed identities or repository-committed credentials would be inappropriate. The catalog is seeded automatically; real accounts are intentionally NOT committed to either database artifact.

1. On a trusted test/deployment machine, create a **private copy** of the seeded database outside the repository, e.g. `cp HopeERP.db /secure/local/hope-team.db`. Ensure it is accessible only to authorized operators; never commit the initialized DB. On Windows, use the relevant ACL protections.
2. Have each teammate provide their verified first and last name, email, and an **encoded hash produced by the application's approved password-hashing method**. The script accepts bcrypt with work factor at least 12 or Argon2id with minimum parameters. The application's login implementation must use and verify the same format; the script cannot verify that compatibility by itself. Do not put plaintext passwords into the JSON file.
3. Construct `/secure/local/initial-admins.json` as a JSON array of **exactly five** objects, one per required handle:

```json
[
  {
    "handle": "Chrollofuru",
    "firstName": "<verified-first-name>",
    "lastName": "<verified-last-name>",
    "email": "<verified-team-email>",
    "passwordHash": "<real-encoded-bcrypt-or-argon2id-hash>"
  }
]
```

The above is a **field-layout illustration only**, not a complete accepted file. Include all five handles named above and replace every placeholder with verified values. Never use the example as credentials.

4. On Linux/macOS secure the JSON file with `chmod 600 /secure/local/initial-admins.json`. Ensure private database file/parent directory access is restricted too.
5. From the project root run:

```bash
python3 -B scripts/seed_superadmins.py \
  --db /secure/local/hope-team.db \
  --accounts-file /secure/local/initial-admins.json
```

Provisioning fails if any account already exists with conflicting identity, hash, role, block state, or status. It is atomic and idempotent for exactly matching accounts; it does not elevate preexisting regular users. No secrets are printed.

6. Confirm all five account rows have `role='Superadmin'`, `isBlocked=0`, and `status='Active'`, and verify actual login and access in an approved test environment using the real app. The `app_user` table **does not include a separate handle/username column**, so the handles serve only as a secure provisioning checklist, not as database login identifiers. Login may use email if that is what the application supports.
7. After onboarding, delete the temporary secret JSON file through your organization's secure secret-retention procedure. Do not commit private DBs, exported hashes, emails, reset tokens or invite secrets to GitHub.

**Do not rerun the destructive database regeneration script against an initialized database.** The script now refuses to overwrite databases containing users, grants, or reset tokens. Instead, migrate the live database using your authoritative migration runner.

## Security and residual risks

- The screenshot specifies **role=Superadmin** for team users, but does not define the application authorization function. Creating these rows does **not** validate that a Superadmin has access to every right at runtime. Authorization and Data Privacy Act gatekeeping, especially `jobhistory.view`, require separate tests in the application service.
- No plaintext, shared, or test passwords are stored in source or distributed SQLite artifacts. No fake personal identifiers are created.
- Hash validation is format/work-factor validation only, not proof that a digest is a valid password or compatible with the current application's verifier. The repo's live authentication code was not available here.
- All database connections must enable `PRAGMA foreign_keys=ON`. Module/right membership is a database catalog, not an authorization engine.
- The repository's public live branch was not retrieved in this environment. File paths reflect the provided integrated Activities 1–4 project, not an independently reviewed GitHub branch. Validate integration with the team's Node migrations and CI before merge.

## Acceptance assessment

- **Five modules seeded:** done and locally tested.
- **Exact 36 rights seeded:** done and locally tested.
- **Five Superadmin accounts:** secure provisioning implementation and isolated test verified, but **production/real testing remains pending verified identity/hash inputs and application access checks**. These are deliberately not included in the committed database artifacts.
