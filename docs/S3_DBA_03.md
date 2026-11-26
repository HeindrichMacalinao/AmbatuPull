# S3-DBA-03 — HR business-rule constraints

## What was inspected

This patch was prepared from the user-provided `AmbatuPull-main.zip` plus previously supplied S2 and S3-DBA-01/02 patch files. It was **not** compared with a live GitHub branch. Verify numbering against the current branch before merging.

The project has two supported SQLite schema paths:

- `migrations/001_init_core_schema.sql` is applied by `scripts/migrate/index.js` (SQLite, Node.js); its `EMPLOYEE` has `gender CHAR(1)` already limited to `M/F/O`, `hireDate NOT NULL`, nullable `birthDate`/`sepDate`; `JOBHISTORY.salary` is nullable and already `CHECK (salary >= 0)`, while `effDate` is `NOT NULL` and part of its PK.
- `db/migrations/001_hope_base_tables.sql` is used by `scripts/regenerate_hope.py`; employee dates and gender are nullable, `JOBHISTORY.salary` is nullable without a check; `effDate` is explicitly `NOT NULL` and in its PK.
- Supabase `supabase/migrations/20261108_001_core_erp_schema.sql` instead defines `EMPLOYEE.dateHired`, `EMPLOYEE.dateSeparated`, **no** `gender` or `birthDate`, and `JOBHISTORY.salary NOT NULL CHECK (salary >= 0)` plus `effDate NOT NULL`.

## Policy assumptions pending product owner confirmation

1. **Gender values**: allow `M`, `F`, `O` (the existing SQLite app schema already allows `O` for its other/non-binary value). Do **not** introduce a new gender code without a schema decision. Nullable gender remains nullable where allowed.
2. **Salary**: `salary >= 0` (zero is valid); preserve the existing nullable salary column in SQLite. The ticket's alternative `salary > 0` is not applied.
3. **Nulls**: retain column nullability; `gender`, `birthDate`, `sepDate`, and in the historical SQLite variant `hireDate`, may be NULL; salary may be NULL in both SQLite variants. An absent `birthDate` or `hireDate` prevents checking the birth/hire order; a non-NULL `sepDate` requires a non-NULL `hireDate`.
4. **Dates**: SQLite uses TEXT date values with the canonical `YYYY-MM-DD` representation. Validation checks the exact pattern and round-trips through `date(value, '+0 days')`, rejecting invalid calendar dates. PostgreSQL uses actual DATE columns, so format validation is not needed.

**Important PostgreSQL limitation:** The committed Supabase schema does **not** have `EMPLOYEE.gender` or `EMPLOYEE.birthDate`. The SQL migration only enforces rules for columns actually present, with explicit `RAISE NOTICE` messages for missing columns. Gender and birth-before-hire **remain unenforced in the PostgreSQL schema until an approved schema change is supplied**. It intentionally does not invent new HR columns. If Supabase has a different schema from the snapshot, verify the metadata before applying.

## Files

- `migrations/009_employee_jobhistory_domain_constraints.sql` — SQLite runner up.
- `migrations/009_employee_jobhistory_domain_constraints.down.sql` — SQLite runner down.
- `db/migrations/010_employee_jobhistory_domain_constraints.sql` — alternate/historical SQLite schema up.
- `db/migrations/010_employee_jobhistory_domain_constraints.down.sql` — alternate/historical SQLite schema down.
- `supabase/migrations/20261126_011_hr_domain_constraints.sql` — PostgreSQL migration (`NOT VALID` plus `VALIDATE` on supported columns).
- `supabase/rollback/20261126_011_hr_domain_constraints.down.sql` — PostgreSQL rollback.
- `db/verify/preflight_hr_constraints.sql` — read-only pre-migration audit; two counts, both must be 0.
- `db/verify/verify_hr_constraints.sql` — read-only schema/data checks.
- `supabase/verify/20261126_hr_domain_constraints.sql` — read-only PG preflight and constraint inspection.
- `tests/verify_hr_constraints.py` — test failures/successes, up/down/up, Node runner, historical copies.

## Why SQLite triggers, not table rebuild

SQLite cannot directly `ALTER TABLE ADD CHECK` on an existing column. Rebuilding the two tables would be risky because of HR foreign keys, `v_active_employees` / `v_active_jobhistory` views, indexes, and different schema variants. Four `BEFORE INSERT/UPDATE` triggers reject invalid new values without changing earlier data. The migration checks existing records first using a temporary CHECK assertion; it aborts if incompatible data exists. The down script drops only these four trigger names and leaves existing constraints and data intact.

The triggers enforce:

- `gender`: NULL or `M/F/O`.
- Dates: when non-NULL, valid canonical ISO text. `sepDate` must be NULL or >= `hireDate`, with a required hire date if separated; `birthDate` must precede `hireDate` when both are present.
- `salary`: NULL (per existing schema) or numeric >= 0; negative and nonnumeric amounts rejected.
- `JOBHISTORY.effDate`: already NOT NULL; when present, must be a valid canonical date.

## Pre-migration checks (no data changes)

Run in your SQLite CLI or through Python `sqlite3`:

```bash
python3 - <<'PY'
import sqlite3
from pathlib import Path
conn = sqlite3.connect('HopeERP.db')
for sql in Path('db/verify/preflight_hr_constraints.sql').read_text().split(';'):
    if sql.strip():
        rows = conn.execute(sql).fetchall()
        if rows: print(rows)
conn.close()
PY
```

For PostgreSQL, run `supabase/verify/20261126_hr_domain_constraints.sql` against a **staging copy** and inspect schema availability. Never dump employee or salary records into logs.

## Test SQLite up → down → up without touching production

```bash
python3 -B tests/verify_hr_constraints.py
python3 -B tests/verify_active_hr_views.py
node --test tests/employee-position-as-of.test.cjs
```

All of these use in-memory or disposable databases, and test fixtures are discarded. For manual migration runner verification, first build an isolated database with prior migrations, then run:

```bash
node scripts/migrate/index.js up --db=./data/hr_staging.db
node scripts/migrate/index.js down --db=./data/hr_staging.db
node scripts/migrate/index.js up --db=./data/hr_staging.db
```

**Do not use production data files with `down` or apply migrations before checking the latest branch.** The `db/migrations/` version is consumed by the historical DB generator, not by the Node runner; avoid executing both versions against one database.

## Security and operational notes

- Treat data-preflight failures as blockers. Do not auto-fix invalid employee records.
- Validate fields server-side at API input boundaries as well, returning stable user-friendly errors rather than raw SQLite/PostgreSQL exceptions. The database remains the final enforcement layer.
- Do not leak salary or employee personal data through logs, public views, error responses, or Supabase grants. Audit prior S3-DBA-01 all-column HR views before allowing ordinary users to query them.
- PostgreSQL adds new named checks only where missing and needed (separation date and optional gender/birth), using `NOT VALID` followed by `VALIDATE`; validation failures roll back atomically. Existing PostgreSQL salary >=0 and effDate NOT NULL rules are preserved unchanged. Run during approved maintenance if a large table may lock or scan for a noticeable duration.
- Roll back only if approved and only by the corresponding down migration. PostgreSQL rollback removes only named `_s3` constraints; SQLite rollback removes only the four new triggers.
- The PostgreSQL migration was **not executed** in Supabase; staging validation remains required. Do not run against live production without authorization and backup.
