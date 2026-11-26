-- S3-DBA-06 PostgreSQL/Supabase plan inspection.
-- LOCAL/DISPOSABLE TEST DATABASE ONLY. EXPLAIN ANALYZE executes SELECTs.
-- Never run this file on production. Seed a synthetic fixture and ANALYZE first.
-- All runtime search keys/dates are bound through PREPARE/EXECUTE.

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


ANALYZE public."EMPLOYEE";
ANALYZE public."JOBHISTORY";
ANALYZE public."JOB";
ANALYZE public."DEPARTMENT";

PREPARE hr_employee_substring(text) AS
SELECT "empNo", "lastName", "firstName", "status"
FROM public."EMPLOYEE"
WHERE "status" = 'Active' AND "lastName" LIKE $1;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) EXECUTE hr_employee_substring('%Garcia%');
DEALLOCATE hr_employee_substring;

PREPARE hr_employee_by_id(varchar) AS
SELECT "empNo", "lastName", "firstName", "status"
FROM public."EMPLOYEE"
WHERE "empNo" = $1;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) EXECUTE hr_employee_by_id('ZE00000001');
DEALLOCATE hr_employee_by_id;

PREPARE hr_history_timeline(varchar) AS
SELECT "empNo", "jobCode", "salary", "effDate", "status"
FROM public."JOBHISTORY"
WHERE "empNo" = $1 AND "status" = 'Active'
ORDER BY "effDate" DESC;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) EXECUTE hr_history_timeline('ZE00000001');
DEALLOCATE hr_history_timeline;

-- PostgreSQL schema has no JOBHISTORY.deptCode. This joins DEPARTMENT through
-- EMPLOYEE.deptCode, which is the CURRENT department, not historical as-of dept.
PREPARE hr_history_asof(varchar, date) AS
SELECT e."empNo", jh."jobCode", j."jobDesc", e."deptCode", d."deptName",
       jh."salary", jh."effDate"
FROM public."EMPLOYEE" AS e
JOIN public."JOBHISTORY" AS jh ON jh."empNo" = e."empNo"
JOIN public."JOB" AS j ON j."jobCode" = jh."jobCode"
LEFT JOIN public."DEPARTMENT" AS d ON d."deptCode" = e."deptCode"
WHERE e."empNo" = $1
  AND e."status" = 'Active'
  AND jh."status" = 'Active'
  AND jh."effDate" <= $2
ORDER BY jh."effDate" DESC
LIMIT 1;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) EXECUTE hr_history_asof('ZE00000001', DATE '2026-11-26');
DEALLOCATE hr_history_asof;

-- Batch equivalent: window ranking by employee; current dept only due to schema gap.
PREPARE hr_batch_positions(date) AS
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
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) EXECUTE hr_batch_positions(DATE '2026-11-26');
DEALLOCATE hr_batch_positions;

-- Child-side FK lookups protected by the new indexes.
PREPARE hr_employee_job_fk(varchar) AS SELECT 1 FROM public."EMPLOYEE" WHERE "jobCode" = $1 LIMIT 1;
EXPLAIN (ANALYZE, BUFFERS) EXECUTE hr_employee_job_fk('ZJ00000001');
DEALLOCATE hr_employee_job_fk;
PREPARE hr_employee_dept_fk(varchar) AS SELECT 1 FROM public."EMPLOYEE" WHERE "deptCode" = $1 LIMIT 1;
EXPLAIN (ANALYZE, BUFFERS) EXECUTE hr_employee_dept_fk('ZD00000001');
DEALLOCATE hr_employee_dept_fk;
PREPARE hr_history_job_fk(varchar) AS SELECT 1 FROM public."JOBHISTORY" WHERE "jobCode" = $1 LIMIT 1;
EXPLAIN (ANALYZE, BUFFERS) EXECUTE hr_history_job_fk('ZJ00000001');
DEALLOCATE hr_history_job_fk;

-- Do not set enable_seqscan=off. A sequential scan is correct when it is cheaper.
