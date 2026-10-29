# S1-DBA-03 — User Management Tables (SQLite)

Task #8 for AmbatuPull. **Depends on S1-DBA-02** (`EMPLOYEE` and the other nine HOPE base tables); **S1-DBA-01** provides the original `Model1.db` simulation data. This increment does not replace or rewrite either earlier task.

## Additions

- `db/migrations/002_user_management_tables.sql`: five new tables, required indexes, constraints and relationship definitions, and exactly three allowed *system role names* (`Superadmin`, `Admin`, `User`). No demo accounts, modules, rights, or permissions are seeded because no approved 36-right catalog was provided.
- `tests/verify_user_management.py`: checks table schemas, indexes, uniqueness, relationship constraints, defaults, soft disable, hard-delete cascade, idempotence and clean baseline.
- `db/verify/verify_user_management.sql`: read-only SQLite inspection.
- `scripts/regenerate_hope.py`: regenerated `HopeERP.db` and `HOPE_Model1.db` now apply the new migration **after** the base tables and historical seed.
- `tests/verify_hope.py`: retains original 928-row source-parity tests while recognizing the additional five tables and SQLite's `sqlite_sequence` internal table.

## Table design and security choices

1. `app_user.userId` is `INTEGER PRIMARY KEY AUTOINCREMENT` (SQLite auto-increment, not PostgreSQL/MySQL syntax). `role` has a default of `User` and both a value CHECK and FK to `role.roleName`. Only the three specified role names are inserted; descriptions remain NULL.
2. `app_user.email` is `VARCHAR(100) COLLATE NOCASE NOT NULL UNIQUE`, and the explicitly requested lookup index is also present. SQLite's `NOCASE` is ASCII-focused; applications should normalize and validate internationalized email addresses before writing them. The schema rejects duplicate emails differing only by ASCII case.
3. `app_user.empNo` is a nullable actual FK to Task 2 `EMPLOYEE.empNo` (declared `VARCHAR(10)` there), with `ON DELETE SET NULL` and `ON UPDATE CASCADE`. Removing an employee does **not** delete their app account. Other Task 2 foreign keys may separately block deleting a historical employee with dependent sales or job history.
4. `rights.moduleCode` is a required FK to `module.moduleCode`, `ON DELETE RESTRICT`. `user_permission` is an FK-enforced many-to-many junction with composite PK `(userId, rightCode)` and `ON DELETE CASCADE` for both parent relationships. An account or right that is **physically deleted** loses its grants. Blocking an account or setting its `status='Inactive'` **does not** delete grants; permission `status='Inactive'` represents soft revocation. Application authorization logic must check account block/status and grant status, outside the scope of this migration.
5. Both user-related `status` columns accept only `Active` or `Inactive` (default `Active`), and both `stamp` columns are required, non-empty, and at most 80 characters. Password hashes are stored as `VARCHAR(255) NOT NULL` without implementing hashing, verifying bcrypt or creating logins. **The application is responsible for generating and checking hashes.** `isBlocked` is an integer-backed SQLite boolean restricted to `0` or `1` with default `0`.
6. SQLite only enforces foreign keys when **each connection** executes `PRAGMA foreign_keys = ON`. The scripts and verification runner enable it. `CREATE TABLE/INDEX IF NOT EXISTS` plus conflict-tolerant seeding of the specified role values makes the migration safe to reapply **to an already compatible schema**; as with any migration, `IF NOT EXISTS` is not a schema reconciliation mechanism for pre-existing incompatible tables. Run with your team's migration framework once it is available.

## Run from project root

```bash
python scripts/regenerate_hope.py
python tests/verify_hope.py
python tests/verify_user_management.py
```

Optional read-only SQL checks, if SQLite CLI is installed:

```bash
sqlite3 HopeERP.db ".read db/verify/verify_hope.sql"
sqlite3 HopeERP.db ".read db/verify/verify_user_management.sql"
```

**Build order:** Task 2 base migration (`001_hope_base_tables.sql`) → Task 2 historical seed (`002_hope_historical_data.sql`) → Task 3 user migration (`002_user_management_tables.sql`). No fictional business data or dummy users are persisted. The clean ERP database has 15 application tables (10 base + 5 new) and SQLite's internal `sqlite_sequence` metadata table; the combined `HOPE_Model1.db` also retains the original simulation tables. `role` holds 3 system role names, while no rights catalog has been invented.

## Repository integration caveat

This package uses the **repository-relative layout of the earlier Task 2 artifacts**. The live AmbatuPull repository migration runner and any `migrations/001_init_core_schema.sql` or `scripts/migrate/index.js` were not accessible for inspection in this environment. If the latest branch has a different authoritative migration directory/runner, register the new SQLite migration there **instead of** duplicating the Task 1 or 2 schema. No GitHub changes have been pushed. Do not upload the containing ZIP folder as a nested repository directory.

See `docs/verification_results_S1_DBA_03.txt` for the actual local test output.
