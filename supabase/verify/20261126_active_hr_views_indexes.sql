-- S3-DBA-01 PostgreSQL read-only verification; run as authorized DBA in staging.
SHOW server_version_num; -- must be >= 150000
SELECT schemaname, viewname, definition FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('v_active_employees','v_active_jobs',
                   'v_active_departments','v_active_jobhistory')
ORDER BY viewname;
SELECT c.relname, c.reloptions
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v'
  AND c.relname IN ('v_active_employees','v_active_jobs',
                    'v_active_departments','v_active_jobhistory');
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_employee_status_lastname_firstname',
                    'idx_job_status_jobcode',
                    'idx_department_status_deptcode',
                    'idx_jobhistory_empno_effdate_status');
SELECT count(*) FROM public.v_active_employees WHERE "status" <> 'Active';
SELECT count(*) FROM public.v_active_jobs WHERE "status" <> 'Active';
SELECT count(*) FROM public.v_active_departments WHERE "status" <> 'Active';
SELECT count(*) FROM public.v_active_jobhistory WHERE "status" <> 'Active';
-- EXPLAIN without ANALYZE does not execute queries; index use depends on stats.
EXPLAIN SELECT "empNo" FROM public.v_active_employees
        ORDER BY "lastName", "firstName";
EXPLAIN SELECT "jobCode" FROM public.v_active_jobs ORDER BY "jobCode";
EXPLAIN SELECT "deptCode" FROM public.v_active_departments ORDER BY "deptCode";
EXPLAIN SELECT "empNo", "effDate" FROM public.v_active_jobhistory
        WHERE "empNo" = '00001' ORDER BY "effDate";
