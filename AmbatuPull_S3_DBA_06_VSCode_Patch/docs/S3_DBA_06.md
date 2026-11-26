# S3-DBA-06 — HR lookup and career-query performance tuning

## Scope

This ticket profiles employee search, employee primary-key lookup, active JobHistory timelines, as-of salary lookup, and the batch employee/job-history/job/department join. It adds only indexes supported by the inspected query shapes. No application query behavior, grants, RLS policy, or authorization logic is changed.

## Schema findings

- Local SQLite runner schema: `migrations/001_init_core_schema.sql`; `EMPLOYEE` has `empNo`, `lastName`, `firstName`, `deptCode`, `jobCode`, `status`; `JOBHISTORY` has `empNo`, `jobCode`, `deptCode`, `effDate`, `salary`, `status`.
- Historical SQLite schema: `db/migrations/001_hope_base_tables.sql`; `EMPLOYEE` has no current `deptCode`/`jobCode`, but `JOBHISTORY` includes historical `deptCode`.
- Supabase PostgreSQL schema: `EMPLOYEE` has current `deptCode`/`jobCode`; `JOBHISTORY` has no `deptCode`. A four-table join through `EMPLOYEE.deptCode` therefore reports the **current** department, not the department as of a historical `effDate`.
- Existing S3-DBA-01 indexes are retained. The SQLite runner already has `idx_employee_dept`; the PostgreSQL schema did not have indexes on `EMPLOYEE.deptCode`/`jobCode` or `JOBHISTORY.jobCode`.
- The repository snapshot did not contain a live HR employee-search route/query implementation. Security review therefore covers the ticket query shapes and the S3-DBA-02 helper contract, not an unobserved production endpoint.

## Indexes added

### SQLite runner (`migrations/011_hr_lookup_performance_indexes.sql`)

- `idx_employee_active_name_cover`: partial covering index on `(lastName, firstName, empNo) WHERE status='Active'`. It can scan the active employee projection without table lookups, but **cannot seek** for `LIKE '%term%'`.
- `idx_employee_jobcode`: child-side index used by S3-DBA-04 employee/job reference checks.
- `idx_jobhistory_jobcode` and `idx_jobhistory_deptcode`: child-side indexes for Job and Department reference/soft-delete checks.
- `idx_jobhistory_active_empno_effdate_cover`: partial covering index on `(empNo, effDate DESC, jobCode, deptCode, salary) WHERE status='Active'`. It supports the S3-DBA-02 as-of predicate and history ordering.

### Historical SQLite (`db/migrations/012_hr_lookup_performance_indexes.sql`)

Same indexes except `idx_employee_jobcode`, because that schema has no `EMPLOYEE.jobCode` column.

### PostgreSQL/Supabase (`supabase/migrations/20261126_013_hr_lookup_performance_indexes.sql`)

- `idx_employee_deptcode`, `idx_employee_jobcode`, and `idx_jobhistory_jobcode` support child-side FK checks; PostgreSQL does not automatically index referencing columns.
- `idx_jobhistory_active_empno_effdate_cover` is a partial index on `(empNo, effDate DESC, jobCode) INCLUDE (salary) WHERE status='Active'`.
- `INCLUDE` enables index-only scans when PostgreSQL visibility-map coverage allows it. Heap fetches remain possible.
- No index is added for `JOBHISTORY.deptCode` because that column is absent from the committed PostgreSQL schema.

Down migrations remove only indexes introduced by this ticket. Existing indexes and data are untouched.

## Search and extension decision

A normal B-tree cannot efficiently search a leading-wildcard predicate such as `LIKE '%Garcia%'`. The SQLite partial covering index reduces row lookups by scanning a narrower active-only index; it does not convert substring search into an index seek. PostgreSQL `pg_trgm`/GIN and SQLite FTS5 trigram are potential future options, but **neither extension/virtual table is enabled in this patch**. Explicit approval is required before adding either.

## Local SQLite benchmark

The benchmark generator creates a new database from the local runner migrations, applies the available S3-DBA-05 demo seed, then adds deterministic synthetic records to reach 10,000 employees and 100,000 JobHistory rows. It uses allowed gender/status values, valid ISO dates, nonnegative salaries, and active parent jobs/departments. The generator refuses to overwrite an existing file and requires `--confirm-non-production`.

The profiler opens that file read-only and profiles disposable before/after copies. It runs `ANALYZE` on each copy, captures `EXPLAIN QUERY PLAN`, and measures warm-cache execution time. It never changes the input benchmark DB or checked-in DBs. Actual plans and timings are recorded in [`docs/database/sprint-3-performance.md`](database/sprint-3-performance.md).

## PostgreSQL benchmark fixture

`supabase/verify/20261126_hr_benchmark_fixture.sql` uses `generate_series` to insert 10,000 fake employees and 100,000 fake JobHistory rows in one transaction, runs `ANALYZE` and `EXPLAIN (ANALYZE, BUFFERS)`, then rolls back. It uses actual PostgreSQL columns and current `EMPLOYEE.deptCode`; it does not fabricate `JOBHISTORY.deptCode`, gender, or birthDate. The SQL has a non-production environment guard and must be run with psql on a local/test/staging/benchmark database only.

PostgreSQL profiling was **not executed** in this workspace because no local PostgreSQL server/client or authorized staging connection was available. Do not treat the migration as PostgreSQL-runtime-validated until the fixture and plans have been run on staging.

## Run steps

From the repository root:

```bash
python3 -B scripts/benchmark/generate_hr_benchmark.py \
  --output ./data/hr_s3_dba06_benchmark.sqlite \
  --employees 10000 --history-rows 100000 --confirm-non-production

python3 -B scripts/benchmark/profile_hr_queries.py \
  --database ./data/hr_s3_dba06_benchmark.sqlite --confirm-non-production

python3 -B tests/verify_hr_lookup_performance.py
```

For PostgreSQL, first run the fixture on a disposable database before migration 013, apply the migration there, then rerun the fixture to capture after plans. Example in Bash:

```bash
PGAPPNAME=s3-dba06-benchmark psql "$DATABASE_URL" \
  -f supabase/verify/20261126_hr_benchmark_fixture.sql
```

Use a test/staging-only `DATABASE_URL`; never point this command at production. `PGAPPNAME` is a safety marker, not a credential. The fixture rolls back all inserted records. The standalone `supabase/verify/20261126_hr_lookup_performance.sql` profiles a populated disposable test database.

## Security and operational notes

- Search patterns, employee IDs, and as-of dates are bound parameters in the Python/SQLite scripts and PostgreSQL `PREPARE` statements.
- No new grants, RLS policies, security-definer functions, or broader data scopes are introduced.
- Salary remains sensitive. Continue to enforce the S3-DBA-02 server-side `jobhistory.view` permission before returning salary data; never expose raw EXPLAIN output or salary rows to browser clients.
- New indexes consume storage and add write/update/delete cost. Existing indexes were not removed even where they overlap.
- PostgreSQL `CREATE INDEX` is transactional here and can take locks during build. Use staging first; on large production tables, use a separately approved `CREATE INDEX CONCURRENTLY` deployment plan if supported by the migration process.
- No sequential scan was forced off. Full scans of large result sets or a leading-wildcard search may be the correct planner choice.
