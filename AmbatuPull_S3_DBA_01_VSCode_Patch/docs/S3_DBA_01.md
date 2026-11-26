# S3-DBA-01 — Active HR Views and Indexes

## Basis and preflight

Reviewed the available `AmbatuPull-main.zip` source (November 12 snapshot) and the prior S2-DBA-01 through S2-DBA-05 patches; the live GitHub branch was not accessible. The repository contains two SQLite schemas and a Supabase/PostgreSQL schema. Both SQLite schemas and the PostgreSQL migration define all four tables (`EMPLOYEE`, `JOB`, `DEPARTMENT`, `JOBHISTORY`) and `status` on each. All requested index columns are present.

The SQLite HR schemas **differ in non-indexed columns**: for example, the local-runner EMPLOYEE has `deptCode`/`jobCode` and `hireDate`, while the historical `db/migrations/` EMPLOYEE has `birthDate` and `hireDate`; the Supabase EMPLOYEE has `midName` and `dateHired`. `SELECT *` deliberately follows the actual table columns in each environment. Before deployment, compare these archived migrations against your **current** branch; adapt the numbering if other migrations have since been added.

Existing indexes: `idx_employee_status` on `EMPLOYEE(status)` in the local-runner schema, plus primary-key indexes on `JOB(jobCode)`, `DEPARTMENT(deptCode)` and `JOBHISTORY(...)`. No existing index covers `(status,lastName,firstName)`, `(status,jobCode)`, `(status,deptCode)` or `(empNo,effDate,status)` in the reviewed schemas. The new employee composite index has `status` as a leading prefix and **may make `idx_employee_status` redundant**. We intentionally leave the old index intact to avoid altering existing code/rollback semantics; consider removing it only in a separately reviewed change after checking query plans and write overhead.

## Files and migration ordering

| Environment | Up | Down |
|---|---|---|
| SQLite local runner | `migrations/008_active_hr_views_indexes.sql` | `migrations/008_active_hr_views_indexes.down.sql` |
| SQLite historical/generated asset | `db/migrations/009_active_hr_views_indexes.sql` | No separate runner; the corresponding local SQLite down file removes the same eight objects |
| Supabase/PostgreSQL >= 15 | `supabase/migrations/20261126_009_active_hr_views_indexes.sql` | `supabase/rollback/20261126_009_active_hr_views_indexes.down.sql` (manual only) |

All migrations create exactly four active-only views and four named composite indexes. No table or data is modified. **Up files use `CREATE`, not `CREATE IF NOT EXISTS`, so a conflicting pre-existing object is an error, not an object the down migration might later delete accidentally.** The local-runner schema had migrations through `007_...`; `db/migrations` through `008_...`; Supabase through `20261118_008_...` in the reviewed S2 patches.

The asset regeneration script `scripts/regenerate_hope.py` now invokes `db/migrations/009_active_hr_views_indexes.sql` after the S2-DBA-04 migration. This script **rebuilds** SQLite database artifacts and must only be run with intentional backups; it is not necessary to test this ticket.

## SQLite verification

From the repository root:

```bash
python3 -B tests/verify_active_hr_views.py
```

The test creates disposable SQLite databases, installs each known schema variant and the matching S3 migration, inserts distinct active/inactive fixture records, verifies all columns and active filtering, validates index names/columns, checks four `EXPLAIN QUERY PLAN` queries, runs **up/down/up**, and checks data counts, foreign keys and integrity. It additionally exercises `node scripts/migrate/index.js up/down/up/status` on a disposable SQLite file if Node.js is installed. No actual customer or HR data is changed.

Manual local runner test on a **disposable** DB with the core schema already installed:

```bash
node scripts/migrate/index.js up --db=/tmp/s3_dba_01_test.db --dir=./migrations
node scripts/migrate/index.js down --steps=1 --db=/tmp/s3_dba_01_test.db --dir=./migrations
node scripts/migrate/index.js up --db=/tmp/s3_dba_01_test.db --dir=./migrations
```

Run `db/verify/verify_active_hr_views.sql` with `sqlite3` (shell) when the views have been installed. Actual index choice depends on data shape, statistics, selectivity and query predicates. On the disposable test schemas, all four representative `EXPLAIN QUERY PLAN` queries selected the expected new indexes; this is *not* a production performance benchmark.

## Supabase/PostgreSQL security review (deployment gated)

**Requires PostgreSQL 15+** for `WITH (security_invoker = true)`. Confirm the actual version (`SHOW server_version_num`) and test the migration against a staging copy before deploying. The repository has a Supabase PostgreSQL schema, not a MySQL schema.

- `security_invoker = true` makes underlying table privileges and any RLS policies apply as the calling DB role. It **does not create RLS policies** on the base tables, and it does not automatically restrict users to the application role named `User`.
- Application `role`/`app_user` records are **not** PostgreSQL roles; there is no verified mapping from them to `anon` / `authenticated` or any database role. Therefore, this migration grants **no** new access to `anon` / `authenticated`; it explicitly revokes all rights on the new views from `PUBLIC`, `anon`, `authenticated`. Configure app-level read-only access through authenticated server endpoints and verified authorization; if distinct database roles exist, grant SELECT only after their identity and table/RLS permissions are reviewed. Do not grant UPDATE/INSERT/DELETE on the views (PostgreSQL may make simple views automatically updatable).
- `SELECT *` exposes HR details beyond what a normal User list needs: EMPLOYEE may contain birth/hire/separation dates and other personal data; JOBHISTORY includes `salary`. **Get approval to replace the all-column views with a narrow allowlisted projection** before any direct client access. Keeping `SELECT *` meets the issue specification but these views must be internal/admin-only unless reviewed.
- Do not expose `service_role` keys or use client-controlled role headers as authorization. Invoker-security does not help when all requests are executed with the same privileged DB role.
- No production writes, indexes or migration commands were executed. The PostgreSQL migration and rollback are **prepared, not tested on a PostgreSQL server**. Plan a maintenance window for indexes on large tables: ordinary `CREATE INDEX` may hold write-blocking locks; switch to a reviewed nontransactional `CREATE INDEX CONCURRENTLY` procedure if needed. Disk and write amplification cost should be measured on staging.

For staging SQL verification, execute `supabase/verify/20261126_active_hr_views_indexes.sql` **after** applying the migration. It queries system metadata and uses `EXPLAIN` (not `EXPLAIN ANALYZE`). Confirm the results are correct and the views cannot be selected by an unauthorized role; ensure an authorized role is SELECT-only. The supplied rollback SQL lives outside `supabase/migrations/` so it cannot accidentally be treated as a forward migration.

## Assumptions and limitations

- Migration numbers are based on the latest available S2 patches, **not** the live branch.
- No Supabase credentials are present; production PostgreSQL version, active RLS policies, actual grants, query traffic and index plans were **not** verified.
- `SELECT *` varies with the actual schema, by design. Future schema changes may require view recreation on PostgreSQL, particularly when adding/dropping columns.
- The provided application ZIP did not contain an authenticated HR User-role data access layer to change safely. No API/query routes were modified or permissions expanded.
