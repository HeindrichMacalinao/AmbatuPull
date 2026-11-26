# S3-DBA-06 — HR lookup and career-query performance

## Status and scope

Measured on the local SQLite benchmark fixture only. The source benchmark file was opened read-only; profiling ran on disposable copies. No production/Supabase database, live configuration, or checked-in application database was modified. No extension was enabled. PostgreSQL plans remain pending because this workspace has no local PostgreSQL server/client or authorized staging connection.

The benchmark target is **sub-50 ms** for each query, but this is a target, not a guarantee. See the measured values below; the batch query returns every active employee and is not directly comparable to a single-row lookup.

## Schema and existing indexes reviewed

- SQLite `3.46.1`; Python `3.13.5`; platform `Linux-6.18.57-x86_64-with-glibc2.41`.
- Test data: `10,000` EMPLOYEE rows and `100,000` JOBHISTORY rows, generated deterministically with fake names, dates, salaries, job codes, and department codes.
- Source schema: `migrations/001_init_core_schema.sql`; HR views/indexes: S3-DBA-01; domain triggers: S3-DBA-03; referential-integrity triggers: S3-DBA-04; demo rows: available S3-DBA-05 seed.
- SQLite lookup columns: `EMPLOYEE(empNo PK, lastName, firstName, deptCode, jobCode, status)`; `JOBHISTORY(empNo, jobCode, deptCode, effDate, salary, status; PK empNo/jobCode/effDate)`; `JOB(jobCode PK, jobDesc, status)`; `DEPARTMENT(deptCode PK, deptName, status)`.
- SQLite uses `JOBHISTORY.deptCode`; the PostgreSQL/Supabase schema inspected for this task does **not** have that column. The four-table historical department join is therefore only semantically valid in SQLite. PostgreSQL can join `DEPARTMENT` through `EMPLOYEE.deptCode`, but that is the employee's current department, not a historical as-of department.

### Indexes before profiling

- `EMPLOYEE`: `idx_employee_status_lastname_firstname (status, lastName, firstName; non-unique)`, `idx_employee_status (status; non-unique)`, `idx_employee_dept (deptCode; non-unique)`, `sqlite_autoindex_EMPLOYEE_1 (empNo; unique)`
- `JOBHISTORY`: `idx_jobhistory_empno_effdate_status (empNo, effDate, status; non-unique)`, `sqlite_autoindex_JOBHISTORY_1 (empNo, jobCode, effDate; unique)`
- `JOB`: `idx_job_status_jobcode (status, jobCode; non-unique)`, `sqlite_autoindex_JOB_1 (jobCode; unique)`
- `DEPARTMENT`: `idx_department_status_deptcode (status, deptCode; non-unique)`, `sqlite_autoindex_DEPARTMENT_1 (deptCode; unique)`

### Indexes after tuning (on a separate disposable copy)

- `EMPLOYEE`: `idx_employee_jobcode (jobCode; non-unique)`, `idx_employee_active_name_cover (lastName, firstName, empNo; non-unique ; partial)`, `idx_employee_status_lastname_firstname (status, lastName, firstName; non-unique)`, `idx_employee_status (status; non-unique)`, `idx_employee_dept (deptCode; non-unique)`, `sqlite_autoindex_EMPLOYEE_1 (empNo; unique)`
- `JOBHISTORY`: `idx_jobhistory_active_empno_effdate_cover (empNo, effDate, jobCode, deptCode, salary; non-unique ; partial)`, `idx_jobhistory_deptcode (deptCode; non-unique)`, `idx_jobhistory_jobcode (jobCode; non-unique)`, `idx_jobhistory_empno_effdate_status (empNo, effDate, status; non-unique)`, `sqlite_autoindex_JOBHISTORY_1 (empNo, jobCode, effDate; unique)`
- `JOB`: `idx_job_status_jobcode (status, jobCode; non-unique)`, `sqlite_autoindex_JOB_1 (jobCode; unique)`
- `DEPARTMENT`: `idx_department_status_deptcode (status, deptCode; non-unique)`, `sqlite_autoindex_DEPARTMENT_1 (deptCode; unique)`

### PostgreSQL/Supabase schema and index review (not runtime-profiled)

- `EMPLOYEE`: primary key on `empNo`; S3-DBA-01 index `(status, lastName, firstName)`; foreign-key columns `deptCode` and `jobCode` had no child-side indexes in the inspected migrations.
- `JOBHISTORY`: primary key `(empNo, effDate)` and S3-DBA-01 index `(empNo, effDate, status)`; `jobCode` is a foreign key without its own child-side index. `deptCode` is absent in this PostgreSQL table.
- `JOB`: primary key `jobCode` and existing S3-DBA-01 `(status, jobCode)` index.
- `DEPARTMENT`: primary key `deptCode` and existing S3-DBA-01 `(status, deptCode)` index.
- Migration 013 adds child-side FK indexes and a partial covering active-history index. It was not applied or measured in this workspace.

## Test conditions and method

- Both copies were file-backed SQLite databases on the same local filesystem, with a 64 MiB SQLite page cache and in-memory temp storage.
- `ANALYZE` was run on each copy before measuring; it was rerun after the new indexes were created.
- Plans use `EXPLAIN QUERY PLAN`. Timings use Python `time.perf_counter_ns()` around parameterized `execute(...).fetchall()`, after 3 warm-up runs. Values are warm-cache local measurements, not production SLAs. Median and p95 are reported.
- Employee search pattern is passed as a bound parameter (`%Garcia%`); employee ID and dates are also bound parameters.
- No `EXPLAIN ANALYZE` is available in SQLite. No PostgreSQL `EXPLAIN ANALYZE` was run.

## Before/after timings

| Query | Before median (ms) | After median (ms) | Before p95 (ms) | After p95 (ms) | Rows |
|---|---:|---:|---:|---:|---:|
| Employee substring search (LIKE %Garcia%) | 1.090 | 0.547 | 1.338 | 0.823 | 100 |
| Employee exact primary-key lookup (empNo = E-001) | 0.003 | 0.003 | 0.004 | 0.003 | 1 |
| Active JOBHISTORY timeline sorted by effDate DESC | 0.010 | 0.008 | 0.021 | 0.010 | 8 |
| Current job/salary as-of lookup for E-001 | 0.004 | 0.003 | 0.004 | 0.004 | 1 |
| Batch active employee career join (EMPLOYEE/JOBHISTORY/JOB/DEPARTMENT) | 157.070 | 120.475 | 205.794 | 125.136 | 9,499 |

### 50 ms target assessment

The four selective lookups measured below all met the 50 ms target in this local run (maximum median 0.547 ms). The batch query did **not** meet the target: median 120.475 ms, p95 125.136 ms, returning 9,499 active employee rows.

## SQLite execution-plan evidence

### Employee substring search (LIKE %Garcia%)
**Before:**
```text
SEARCH EMPLOYEE USING INDEX idx_employee_status (status=?)
```
**After:**
```text
SCAN EMPLOYEE USING COVERING INDEX idx_employee_active_name_cover
```
### Employee exact primary-key lookup (empNo = E-001)
**Before:**
```text
SEARCH EMPLOYEE USING INDEX sqlite_autoindex_EMPLOYEE_1 (empNo=?)
```
**After:**
```text
SEARCH EMPLOYEE USING INDEX sqlite_autoindex_EMPLOYEE_1 (empNo=?)
```
### Active JOBHISTORY timeline sorted by effDate DESC
**Before:**
```text
SEARCH JOBHISTORY USING INDEX idx_jobhistory_empno_effdate_status (empNo=?)
```
**After:**
```text
SEARCH JOBHISTORY USING COVERING INDEX idx_jobhistory_active_empno_effdate_cover (empNo=?)
```
### Current job/salary as-of lookup for E-001
**Before:**
```text
SEARCH JOBHISTORY USING INDEX idx_jobhistory_empno_effdate_status (empNo=? AND effDate<?)
```
**After:**
```text
SEARCH JOBHISTORY USING COVERING INDEX idx_jobhistory_active_empno_effdate_cover (empNo=? AND effDate<?)
```
### Batch active employee career join (EMPLOYEE/JOBHISTORY/JOB/DEPARTMENT)
**Before:**
```text
MATERIALIZE ranked
CO-ROUTINE (subquery-4)
SCAN jh USING INDEX idx_jobhistory_empno_effdate_status
USE TEMP B-TREE FOR LAST 2 TERMS OF ORDER BY
SCAN (subquery-4)
SEARCH EMPLOYEE USING INDEX idx_employee_status (status=?)
BLOOM FILTER ON r (empNo=? AND rn=?)
SEARCH r USING AUTOMATIC PARTIAL COVERING INDEX (empNo=? AND rn=?) LEFT-JOIN
SEARCH j USING INDEX sqlite_autoindex_JOB_1 (jobCode=?) LEFT-JOIN
SEARCH d USING INDEX sqlite_autoindex_DEPARTMENT_1 (deptCode=?) LEFT-JOIN
USE TEMP B-TREE FOR ORDER BY
```
**After:**
```text
MATERIALIZE ranked
CO-ROUTINE (subquery-4)
SCAN jh USING COVERING INDEX idx_jobhistory_active_empno_effdate_cover
SCAN (subquery-4)
SCAN EMPLOYEE USING INDEX sqlite_autoindex_EMPLOYEE_1
BLOOM FILTER ON r (empNo=? AND rn=?)
SEARCH r USING AUTOMATIC PARTIAL COVERING INDEX (empNo=? AND rn=?) LEFT-JOIN
SEARCH j USING INDEX sqlite_autoindex_JOB_1 (jobCode=?) LEFT-JOIN
SEARCH d USING INDEX sqlite_autoindex_DEPARTMENT_1 (deptCode=?) LEFT-JOIN
```

### Child-side foreign-key / trigger lookups

#### EMPLOYEE child FK: jobCode
**Before:**
```text
SCAN EMPLOYEE
```
**After:**
```text
SEARCH EMPLOYEE USING COVERING INDEX idx_employee_jobcode (jobCode=?)
```
#### JOBHISTORY child FK: jobCode
**Before:**
```text
SCAN JOBHISTORY USING COVERING INDEX sqlite_autoindex_JOBHISTORY_1
```
**After:**
```text
SEARCH JOBHISTORY USING COVERING INDEX idx_jobhistory_jobcode (jobCode=?)
```
#### JOBHISTORY child FK: deptCode
**Before:**
```text
SCAN JOBHISTORY
```
**After:**
```text
SEARCH JOBHISTORY USING COVERING INDEX idx_jobhistory_deptcode (deptCode=?)
```
#### EMPLOYEE child FK: deptCode (existing index)
**Before:**
```text
SEARCH EMPLOYEE USING COVERING INDEX idx_employee_dept (deptCode=?)
```
**After:**
```text
SEARCH EMPLOYEE USING COVERING INDEX idx_employee_dept (deptCode=?)
```

## Findings and recommendations

1. `EMPLOYEE.empNo` is a primary key and exact lookup uses its existing primary-key index. No duplicate empNo index was added.
2. The existing `(status,lastName,firstName)` B-tree cannot seek into a leading-wildcard pattern (`LIKE '%Garcia%'`). The SQLite active-name covering index may reduce row lookups for the active projection, but still scans matching active index entries; it is not a substring-search index. PostgreSQL `pg_trgm` and SQLite FTS5 trigram remain optional follow-ups and were **not enabled** pending explicit approval.
3. The new partial covering `JOBHISTORY` index targets the S3-DBA-02 predicate (`empNo`, `status='Active'`, `effDate <= asOfDate`, `ORDER BY effDate DESC`) and carries the columns needed for the history projection. SQLite selected it for the selective as-of lookup in the after plan.
4. Child-side indexes on `JOBHISTORY.jobCode` and `JOBHISTORY.deptCode`, plus `EMPLOYEE.jobCode`, support S3-DBA-04 parent delete/deactivation checks. `EMPLOYEE.deptCode` was already indexed in the SQLite runner schema; no duplicate was added.
5. The batch window query still processes a large share of the history rows and returns thousands of rows. A 50 ms goal is workload-, hardware-, cache-, and output-size-dependent; do not force index use or promise it without a representative deployment benchmark.
6. Follow-up for the batch target: benchmark a per-active-employee top-1 lookup (`LEFT JOIN LATERAL` in PostgreSQL, or a carefully tested correlated lookup in SQLite) using the new `(empNo, effDate DESC)` access path. This can avoid ranking every history row, but must preserve the no-history LEFT JOIN behavior and same-date tie policy. It is a query rewrite and was not included in this index-only ticket.

## Migration trade-offs and rollback

- New indexes consume disk and add write/update/delete cost. The partial history index stores only active history; FK indexes cover all referenced rows.
- Existing S3-DBA-01 indexes are intentionally retained; no index is dropped as part of this task.
- SQLite up/down: `migrations/011_hr_lookup_performance_indexes.sql` and `.down.sql`; alternate historical schema: `db/migrations/012_hr_lookup_performance_indexes.sql` and `.down.sql`.
- PostgreSQL up/down: `supabase/migrations/20261126_013_hr_lookup_performance_indexes.sql` and `supabase/rollback/20261126_013_hr_lookup_performance_indexes.down.sql`. The PG migration was not executed in this workspace. Standard `CREATE INDEX` takes a table lock during build; schedule on staging/maintenance window or use an approved concurrent-index deployment procedure if the migration framework supports non-transactional statements.
- Rollback removes only indexes created by S3-DBA-06. It does not remove prior indexes, views, data, or constraints.

## PostgreSQL verification status

Not run: no local PostgreSQL binaries or authorized staging connection were available in this workspace. Use `supabase/verify/20261126_hr_lookup_performance.sql` and `supabase/verify/20261126_hr_benchmark_fixture.sql` on a disposable PostgreSQL database. Run `ANALYZE` before `EXPLAIN (ANALYZE, BUFFERS)`. Do not run those scripts on production.

## Security review

- SQL in the benchmark scripts binds search patterns, employee IDs, and as-of dates; no untrusted input is concatenated into SQL.
- No query changes application authorization or tenant/data scope. The S3-DBA-02 salary helper's server-side `jobhistory.view` authorization requirement remains applicable.
- Salary is sensitive; keep these plans, fixture data, and reports in test environments. Do not expose raw salary rows or EXPLAIN output to browser users.
- The repository snapshot has no implemented HR employee-search route/query path to inspect. The report therefore reviews the ticket query shapes and the S3-DBA-02 helper contract, not an unobserved production UI query.
