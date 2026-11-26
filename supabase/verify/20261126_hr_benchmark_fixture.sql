-- S3-DBA-06 PostgreSQL synthetic benchmark fixture (psql script).
-- LOCAL/DISPOSABLE TEST DATABASE ONLY. This script inserts 10,000 fake
-- employees and 100,000 fake JOBHISTORY rows inside a transaction, runs ANALYZE
-- and EXPLAIN ANALYZE, then ROLLBACKs every fixture row and statistics change.
-- Never run against production. Run once before and once after migration 013
-- in the SAME disposable test DB to capture comparable plans.
-- No extensions, persistent test rows, credentials, or real personal data.

\set ON_ERROR_STOP on

-- Safety guard: use a disposable database name or set PGAPPNAME to a test marker.
DO $s3_dba06_environment_guard$
BEGIN
  IF current_database() !~* '(local|test|staging|benchmark)'
     AND current_setting('application_name') !~* '(local|test|staging|benchmark)' THEN
    RAISE EXCEPTION 'S3-DBA-06 profiling refused: use a local/test/staging/benchmark database or set PGAPPNAME=s3-dba06-benchmark after verifying the target is non-production';
  END IF;
END
$s3_dba06_environment_guard$;

\timing on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM public."JOB" WHERE "jobCode" LIKE 'ZJ%')
     OR EXISTS (SELECT 1 FROM public."DEPARTMENT" WHERE "deptCode" LIKE 'ZD%')
     OR EXISTS (SELECT 1 FROM public."EMPLOYEE" WHERE "empNo" LIKE 'ZE%') THEN
    RAISE EXCEPTION 'S3-DBA-06 benchmark namespace collision: remove/choose another disposable test database; no rows were changed';
  END IF;
END
$preflight$;

INSERT INTO public."JOB" ("jobCode", "jobDesc", "status", "stamp")
SELECT 'ZJ' || lpad(n::text, 8, '0'), 'Benchmark Job ' || n, 'Active', 'BENCHMARK_FIXTURE'
FROM generate_series(1, 4) AS series(n);

INSERT INTO public."DEPARTMENT" ("deptCode", "deptName", "status", "stamp")
SELECT 'ZD' || lpad(n::text, 8, '0'), 'Benchmark Department ' || n, 'Active', 'BENCHMARK_FIXTURE'
FROM generate_series(1, 4) AS series(n);

WITH employee_source AS (
  SELECT g,
         DATE '2010-01-01' + ((g * 7) % 1825) AS hire_date,
         CASE WHEN g % 20 = 0 THEN 'Inactive' ELSE 'Active' END AS employee_status
  FROM generate_series(1, 10000) AS series(g)
)
INSERT INTO public."EMPLOYEE"
  ("empNo", "lastName", "firstName", "deptCode", "jobCode",
   "dateHired", "dateSeparated", "status", "stamp")
SELECT 'ZE' || lpad(g::text, 8, '0'),
       CASE WHEN g % 100 = 1 THEN 'GarciaBench' || g::text
            ELSE 'SyntheticSurname' || lpad(g::text, 5, '0') END,
       'SyntheticFirst' || lpad(g::text, 5, '0'),
       'ZD' || lpad((((g + 8) % 4) + 1)::text, 8, '0'),
       'ZJ' || lpad((((g + 8) % 4) + 1)::text, 8, '0'),
       hire_date,
       CASE WHEN employee_status = 'Inactive' THEN hire_date + 3651 ELSE NULL END,
       employee_status,
       'BENCHMARK_FIXTURE'
FROM employee_source;

INSERT INTO public."JOBHISTORY"
  ("empNo", "effDate", "jobCode", "salary", "status", "stamp")
SELECT e."empNo",
       e."dateHired" + (h.n * 365),
       'ZJ' || lpad((((g.n + h.n - 1) % 4) + 1)::text, 8, '0'),
       35000 + ((g.n * 13) % 25000) + (h.n * 750),
       CASE WHEN h.n % 5 = 0 THEN 'Inactive' ELSE 'Active' END,
       'BENCHMARK_FIXTURE'
FROM generate_series(1, 10000) AS g(n)
CROSS JOIN generate_series(0, 9) AS h(n)
JOIN public."EMPLOYEE" AS e
  ON e."empNo" = 'ZE' || lpad(g.n::text, 8, '0');

ANALYZE public."EMPLOYEE";
ANALYZE public."JOBHISTORY";
ANALYZE public."JOB";
ANALYZE public."DEPARTMENT";

-- Employee substring search: expect a scan without pg_trgm; do not force an index.
PREPARE hr_bench_substring(text) AS
SELECT "empNo", "lastName", "firstName", "status"
FROM public."EMPLOYEE"
WHERE "status" = 'Active' AND "lastName" LIKE $1;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) EXECUTE hr_bench_substring('%Garcia%');
DEALLOCATE hr_bench_substring;

-- Exact employee primary-key lookup.
PREPARE hr_bench_empno(varchar) AS
SELECT "empNo", "lastName", "firstName", "status"
FROM public."EMPLOYEE" WHERE "empNo" = $1;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) EXECUTE hr_bench_empno('ZE00000001');
DEALLOCATE hr_bench_empno;

-- As-of career lookup. DEPARTMENT is joined via EMPLOYEE.deptCode because
-- PostgreSQL JOBHISTORY has no deptCode; this is current, not historical, dept.
PREPARE hr_bench_asof(varchar, date) AS
SELECT e."empNo", jh."jobCode", j."jobDesc", e."deptCode", d."deptName",
       jh."salary", jh."effDate"
FROM public."EMPLOYEE" AS e
JOIN public."JOBHISTORY" AS jh ON jh."empNo" = e."empNo"
JOIN public."JOB" AS j ON j."jobCode" = jh."jobCode"
LEFT JOIN public."DEPARTMENT" AS d ON d."deptCode" = e."deptCode"
WHERE e."empNo" = $1 AND e."status" = 'Active'
  AND jh."status" = 'Active' AND jh."effDate" <= $2
ORDER BY jh."effDate" DESC LIMIT 1;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) EXECUTE hr_bench_asof('ZE00000001', DATE '2026-11-26');
DEALLOCATE hr_bench_asof;

-- Batch ranking and join across all four HR tables (current department caveat above).
PREPARE hr_bench_batch(date) AS
WITH ranked AS (
  SELECT jh."empNo", jh."jobCode", jh."salary", jh."effDate",
         ROW_NUMBER() OVER (
           PARTITION BY jh."empNo" ORDER BY jh."effDate" DESC, jh."jobCode"
         ) AS rn
  FROM public."JOBHISTORY" AS jh
  WHERE jh."status" = 'Active' AND jh."effDate" <= $1
)
SELECT e."empNo", r."jobCode", j."jobDesc", e."deptCode", d."deptName",
       r."salary", r."effDate"
FROM public."EMPLOYEE" AS e
LEFT JOIN ranked AS r ON r."empNo" = e."empNo" AND r.rn = 1
LEFT JOIN public."JOB" AS j ON j."jobCode" = r."jobCode"
LEFT JOIN public."DEPARTMENT" AS d ON d."deptCode" = e."deptCode"
WHERE e."status" = 'Active'
ORDER BY e."empNo";
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) EXECUTE hr_bench_batch(DATE '2026-11-26');
DEALLOCATE hr_bench_batch;

-- The transaction intentionally removes all synthetic records and ANALYZE changes.
ROLLBACK;
