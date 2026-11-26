# S3-DBA-04 — Referential Integrity & Child-Record Protection

## Sources and schema inspection

Built against the supplied AmbatuPull project snapshot and S3-DBA-01 through 03 changes, **not** a live GitHub checkout or live Supabase database. Confirm migration numbers and latest schema on your feature branch. The project has **three non-identical schema variants**:

| Behavior | Main SQLite (`migrations/001`) | Historical SQLite (`db/migrations/001`) | Supabase PG (`20261108_001`) |
|---|---|---|---|
| JOBHISTORY → JOB | RESTRICT | NO ACTION | RESTRICT |
| JOBHISTORY → DEPARTMENT | SET NULL | NO ACTION | **No `deptCode` column** |
| JOBHISTORY → EMPLOYEE | **CASCADE** | NO ACTION | RESTRICT |
| SALES → EMPLOYEE | RESTRICT | NO ACTION | **No `empNo` column** |
| EMPLOYEE → JOB / DEPARTMENT | SET NULL | **No such columns** | RESTRICT |

All supplied relationships were inspected. No table was rebuilt and **no existing foreign key was removed, weakened, or replaced**. Triggers supply the deletion protection where the main SQLite schema's CASCADE or SET NULL behavior would otherwise destroy historical links. SQLite `PRAGMA foreign_keys=ON` is required **for every connection**, not merely during migration.

The two supplied historical SQLite databases contain 32 employees, 14 jobs, eight departments, 54 job-history records, and 124 sales records each. All checked HR orphan and active-parent-violation counts were **zero**. Migrations have transactional preflights that reject incompatible pre-existing records without rewriting them.

## Confirmed policy choices (request owner confirmation before production)

1. **Active history** means *every* `JOBHISTORY.status='Active'` row, regardless of current employee status or dates. It is not limited to the latest effective date.
2. **Parent hard delete** is disallowed for **any** job history, including inactive history. In the main SQLite schema it also rejects jobs/departments referenced by an employee, avoiding `ON DELETE SET NULL` information loss. This is stricter than only checking active history and maintains historical integrity.
3. **Parent soft delete** is prohibited for active job history references and, where a current employee job/department pointer exists, for active employee references.
4. **Employee soft delete** updates `EMPLOYEE.status` only. It never modifies or deletes `JOBHISTORY`/`SALES`.
5. **Employee restore:** In the main SQLite and PostgreSQL schema, validate the employee's directly referenced current job and department as Active. Main SQLite permits NULL current references because the existing columns are nullable. In the historical SQLite variant, `EMPLOYEE` has no job/department references, so the trigger validates *every record tied at the latest effective date* in `JOBHISTORY` (including inactive records). Ties are not arbitrarily resolved. Employees without history can be restored. These are conservative, documented adaptations, not equivalent source schemas.
6. **Active JOBHISTORY writes:** Inserts or updates must refer to an Active job; SQLite also checks an Active department when `deptCode` is not NULL. The PostgreSQL schema does not represent historical department assignments.

## Files

- `migrations/010_hr_referential_integrity.sql` and `.down.sql`: main SQLite up/down, nine triggers.
- `db/migrations/011_hr_referential_integrity.sql` and `.down.sql`: historical SQLite up/down, eight triggers.
- `supabase/migrations/20261126_012_hr_referential_integrity.sql`: PostgreSQL up, trigger functions and guards.
- `supabase/rollback/20261126_012_hr_referential_integrity.down.sql`: PG rollback.
- `db/verify/verify_hr_referential_integrity.sql`: SQLite read-only checks and rollback-only soft-delete example.
- `supabase/verify/20261126_hr_referential_integrity.sql`: read-only Supabase metadata/data check.
- `tests/verify_hr_referential_integrity.py`: negative and positive tests on disposable SQLite databases, historical asset clones, SQL script, actual Node runner.
- `docs/S3_DBA_04_PR_DESCRIPTION.md`: PR-ready summary.

## Preflight queries (must return zero)

Run **read-only** on an authorized staging copy. The verification SQL contains these and additional checks:

```sql
-- SQLite schema variants
SELECT COUNT(*) AS orphan_history_jobs FROM JOBHISTORY h
LEFT JOIN JOB j ON j.jobCode=h.jobCode WHERE j.jobCode IS NULL;
SELECT COUNT(*) AS orphan_history_departments FROM JOBHISTORY h
LEFT JOIN DEPARTMENT d ON d.deptCode=h.deptCode
WHERE h.deptCode IS NOT NULL AND d.deptCode IS NULL;
SELECT COUNT(*) AS orphan_history_employees FROM JOBHISTORY h
LEFT JOIN EMPLOYEE e ON e.empNo=h.empNo WHERE e.empNo IS NULL;
SELECT COUNT(*) AS orphan_sales_employees FROM SALES s
LEFT JOIN EMPLOYEE e ON e.empNo=s.empNo WHERE s.empNo IS NOT NULL AND e.empNo IS NULL;
SELECT COUNT(*) AS active_history_inactive_job FROM JOBHISTORY h
JOIN JOB j ON j.jobCode=h.jobCode WHERE h.status='Active' AND j.status<>'Active';
SELECT COUNT(*) AS active_history_inactive_dept FROM JOBHISTORY h
JOIN DEPARTMENT d ON d.deptCode=h.deptCode
WHERE h.status='Active' AND d.status<>'Active';
```

For Supabase (which has **no** history department or sales employee column), use `supabase/verify/20261126_hr_referential_integrity.sql` and inspect its structural warnings before applying the migration. Do not add fictitious columns or assume the local schema matches the live Supabase schema.

## SQLite testing and migration cycle

```bash
python3 -B tests/verify_hr_referential_integrity.py
python3 -B tests/verify_hr_constraints.py
python3 -B tests/verify_active_hr_views.py
node --test tests/employee-position-as-of.test.cjs
```

The first command runs `up/down/up` against both SQLite schema variants and separately calls the **actual Node migration runner** on a temporary DB. It tests expected hard-delete and invalid-status exceptions, unaffected history/sales, FK integrity, rejected active history with inactive parents, restoration conditions, and an idempotent *tracked* migration cycle. It never edits the checked-in `.db` files.

For manual verification against an already-migrated **disposable** SQLite DB:

```bash
sqlite3 -bail ./data/test_only.db < db/verify/verify_hr_referential_integrity.sql
```

The SQLite verification SQL cannot catch an *expected* FK exception by itself; the Python harness performs and asserts those negative cases. The SQL file's status update is rolled back. For a manual Node up/down/up, do **not** use production data:

```bash
node scripts/migrate/index.js up --db=./data/s3_hr_disposable.db
node scripts/migrate/index.js down --db=./data/s3_hr_disposable.db
node scripts/migrate/index.js up --db=./data/s3_hr_disposable.db
```

Never run both `migrations/010` and `db/migrations/011` on the same database. The former belongs to the Node runner, the latter to the historical SQLite asset schema.

## PostgreSQL operational risks and remaining gaps

- Existing PostgreSQL FKs already restrict hard deletes for `JOBHISTORY.empNo`, `JOBHISTORY.jobCode`, and `EMPLOYEE.jobCode/deptCode` (verified from **committed schema**, not the live DB). Guard triggers supply descriptive errors and soft-delete safety.
- The committed PG schema has **no `SALES.empNo`**. Therefore there is no sales-to-employee FK to verify or enforce in that schema. The employee-delete function checks `SALES.empNo` if an approved future schema adds it, but a real FK must also be added in that future migration for race-free guarantees.
- The committed PG schema has **no `JOBHISTORY.deptCode`**. Direct historical department protection is impossible. The PG migration protects current `EMPLOYEE.deptCode` (including active-employee deactivation), but **does not satisfy the historical-department acceptance condition**. Get schema/product-owner approval before addressing the missing relationship.
- PG trigger functions run `SECURITY DEFINER` with fixed `pg_catalog, pg_temp` search path and schema-qualified table references. They intentionally examine child rows independent of caller RLS so checks cannot be bypassed by a caller who cannot SELECT them. Review each function owner for least privilege, restrict who can ALTER TABLE / DISABLE TRIGGER, and ensure no untrusted roles can write the referenced tables without the triggers.
- PG checks take `FOR SHARE` locks on parent rows when inserting/updating active history or activating employee references. This reduces assignment/deactivation races; verify concurrent transactions and retry handling at the application layer in staging. Do not expose raw SQL error messages to end users.
- No privileges, policies, RLS settings, API endpoints, or application-level role checks are changed. Application routes should still authorize HR writes and provide user-friendly errors.
- **PostgreSQL migration and rollback have not been executed on a PG server.** Only static inspection of the committed PG schema is available. Deploy to a staging clone with backups, test concurrency, then review security roles and operational impact before production.
- `down` removes only S3-DBA-04 triggers/functions; it does not drop or rewrite any parent/child rows or constraints. Test staging rollback before merging.

## Test scope and limitations

Verified locally with SQLite, Node 22, and Python 3. PostgreSQL live/staging validation and full project `npm test` success are **not claimed**. The supplied snapshot's `npm test` references `tests/verify_user_registration_time.py`, which is absent in the available archive; that unrelated pre-existing break remains.
