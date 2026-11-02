# S1-DBA-04 — Password Reset Token Table

**Issue:** [HeindrichMacalinao/AmbatuPull #9](https://github.com/HeindrichMacalinao/AmbatuPull/issues/9)  
**Scope:** SQLite database migration only; no password reset endpoint, email transport, or token generation implementation.

## Summary / problem

The S1-DBA-03 schema contains the `app_user` table but no place to record password-reset requests. Issue #9 requires hashed reset tokens with expiry timestamps and a one-time-use flag. This is a missing schema capability, not an identified bug in the application's authentication code.

## Solution

`db/migrations/003_password_reset_token.sql` adds a new `password_reset_token` table after the S1-DBA-03 migration. It does **not** alter the original ten HOPE ERP tables or their historical records.

| Column | SQLite declaration | Purpose |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | SQLite-compatible auto-incrementing identifier |
| `userId` | `INTEGER NOT NULL` | References `app_user.userId` with `ON DELETE CASCADE` |
| `tokenHash` | `VARCHAR(255) NOT NULL` | Stores **only the 64-character, lowercase SHA-256 hex digest** of a high-entropy reset token |
| `expiresAt` | `TIMESTAMP NOT NULL DEFAULT (datetime('now', '+1 hour'))` | One-hour UTC default expiry |
| `isUsed` | `BOOLEAN NOT NULL DEFAULT 0` | 0=pending, 1=used or invalidated |
| `createdAt` | `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` | UTC creation time |
| `usedAt` | `TIMESTAMP NULL` | Actual redemption time, NULL when not redeemed |

Additional SQLite `CHECK` constraints enforce the hash's hex shape, 0/1 used values, parseable timestamps, and `expiresAt > createdAt`. SQLite uses flexible storage types, so the explicit constraints are intentional. The schema does not prove that an application correctly generated or hashed a token; that is the calling application's responsibility.

The requested indexes are:

- `idx_password_reset_token_tokenHash` on `(tokenHash)`, **UNIQUE** so duplicate hashes cannot ambiguously identify multiple reset requests.
- `idx_password_reset_token_user_state_expiry` on `(userId, isUsed, expiresAt)` for locating a user's pending tokens.

The migration uses `IF NOT EXISTS` and may be reapplied to the *same compatible* schema. It is not a general-purpose schema-reconciliation tool; tests detect missing/wrong schema objects.

## Applying the migration

**Migration order:**

1. `db/migrations/001_hope_base_tables.sql` (includes `EMPLOYEE`)
2. `db/seeds/002_hope_historical_data.sql` (historical data in this integrated package)
3. `db/migrations/002_user_management_tables.sql` (creates `app_user`)
4. `db/migrations/003_password_reset_token.sql` (this task)

If the repository's authoritative migration runner has its own registration/configuration, register the fourth step there. This project ZIP contains a Python regeneration script, but the live GitHub repository's current runner was not accessible for verification.

To regenerate and test in this package (from the repository root):

```sh
python3 -B scripts/regenerate_hope.py
python3 -B tests/verify_hope.py
python3 -B tests/verify_user_management.py
python3 -B tests/verify_password_reset_token.py --check-artifacts
```

The password-reset test also works against a throwaway fresh database without regenerating committed DB files:

```sh
python3 -B tests/verify_password_reset_token.py
```

**Existing CI:** Append that last command as a step after the existing migration validation in the team's GitHub Actions job. Do **not** create a second CI workflow without checking the current one.

```yaml
- name: Validate S1-DBA-04 password reset token schema
  run: python3 -B tests/verify_password_reset_token.py
```

## Correct status and redemption semantics

The database must not store plaintext token values. The application should generate a cryptographically random, high-entropy token and store the SHA-256 hex digest; the user receives only the raw token. For lookup, hash the token supplied by the user and compare against `tokenHash` with a parameterized query. Keep the reset token confidential throughout the request.

A token is **active** only when `isUsed=0 AND expiresAt > CURRENT_TIMESTAMP`. An expired token is one with `isUsed=0 AND expiresAt <= CURRENT_TIMESTAMP`. A spent/revoked token has `isUsed=1`, regardless of expiry.

```sql
-- Atomic, race-resistant redemption. Require exactly ONE affected row.
UPDATE password_reset_token
   SET isUsed = 1, usedAt = CURRENT_TIMESTAMP
 WHERE tokenHash = ?
   AND isUsed = 0
   AND expiresAt > CURRENT_TIMESTAMP;
```

A second redemption of the same token updates **zero rows**. Applications must check the affected-row count and coordinate the password update in the **same database transaction**; this task does not implement or verify that application transaction. Note that the schema itself does not block a caller from performing an unsafe unguarded UPDATE; correct queries and authorization are required at application level.

To invalidate a user's previous unredeemed tokens when a new token is requested, use a transaction and update the old pending rows before inserting the new digest:

```sql
BEGIN IMMEDIATE;
UPDATE password_reset_token
   SET isUsed = 1
 WHERE userId = ? AND isUsed = 0 AND expiresAt > CURRENT_TIMESTAMP;
INSERT INTO password_reset_token (userId, tokenHash) VALUES (?, ?);
COMMIT;
```

For invalidations, `usedAt` remains NULL because no redemption occurred; `isUsed=1` also denotes revocation. The new token and revoked old tokens must be updated atomically to avoid races. SQLite `PRAGMA foreign_keys=ON` is connection-scoped and must be enabled by the application's database connection.

## Tests / acceptance coverage

`tests/verify_password_reset_token.py` tests a **fresh** database on every run, with no Docker or Python packages. Optional `--check-artifacts` also tests the two integrated database files. Checks include:

- Seven required columns with SQLite defaults, types, not-null flags, and auto-increment ID.
- Foreign key to `app_user.userId` and cascading deletion.
- Exact order of both indexes and unique hashed-token lookup.
- Raw-string/invalid digest rejection, duplicate digest rejection, and timestamp/flag constraints.
- Default expiry exactly one hour after `createdAt`.
- Atomic redemption succeeds once, fails for replay and expiration, and differentiates active/expired/used rows.
- Previous pending tokens can be marked invalid without falsely setting `usedAt`.
- Database foreign key and integrity checks, migration idempotence, missing-index failure detection.
- Preservation of **928 historical HOPE ERP records** from S1-DBA-02, plus the original Model1 simulation structure/data in the integrated DB.
- Test fixtures are wrapped in savepoints and rolled back; no sample users or reset tokens are shipped.

## Assumptions / caveats

- **SQLite**, not MySQL/PostgreSQL, is the database dialect in the previous activities. `INTEGER PRIMARY KEY AUTOINCREMENT` is the correct SQLite translation of `INT AUTO_INCREMENT PRIMARY KEY`.
- SHA-256 hash must come from a **securely random** token generated by the application; the migration does not generate or hash a user-facing token.
- Timestamp defaults are SQLite UTC text timestamps, compared consistently with `CURRENT_TIMESTAMP`. Passing non-UTC text or offset-formatted timestamps from the application without normalization can lead to incorrect lexical status comparisons. Store UTC timestamps in `YYYY-MM-DD HH:MM:SS` or use a documented normalization strategy.
- A 1-hour **default** is required, but explicit expiresAt values can vary as long as they occur after createdAt; the issue does not demand an exact one-hour maximum for overridden values.
- No live GitHub code checkout was possible in this environment. This patch is based on the integrated Activities 1–3 source files previously produced in this conversation. Integrate its file paths into the repository's actual branch/migration runner and verify GitHub Actions before merging.
