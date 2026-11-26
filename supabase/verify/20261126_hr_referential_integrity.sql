-- S3-DBA-04 Supabase / PostgreSQL read-only inspection, no writes.
-- DB schema differs from SQLite: JOBHISTORY has no deptCode and SALES has no empNo.
BEGIN READ ONLY;
SELECT 'orphan_history_job' AS check_name, count(*) AS expected_zero
FROM public."JOBHISTORY" h LEFT JOIN public."JOB" j ON j."jobCode"=h."jobCode"
WHERE j."jobCode" IS NULL;
SELECT 'orphan_history_employee' AS check_name, count(*) AS expected_zero
FROM public."JOBHISTORY" h LEFT JOIN public."EMPLOYEE" e ON e."empNo"=h."empNo"
WHERE e."empNo" IS NULL;
SELECT 'active_history_inactive_job' AS check_name, count(*) AS expected_zero
FROM public."JOBHISTORY" h JOIN public."JOB" j ON j."jobCode"=h."jobCode"
WHERE h."status"='Active' AND j."status"<>'Active';
SELECT 'active_employee_inactive_dept' AS check_name, count(*) AS expected_zero
FROM public."EMPLOYEE" e JOIN public."DEPARTMENT" d ON d."deptCode"=e."deptCode"
WHERE e."status"='Active' AND d."status"<>'Active';
SELECT t.tgname AS installed_guard, c.relname AS table_name
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND t.tgname LIKE 'trg_s3_hrri_%' AND NOT t.tgisinternal
ORDER BY table_name, installed_guard;
SELECT tc.table_name, kcu.column_name, ccu.table_name AS parent_table, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name=kcu.constraint_name AND tc.constraint_schema=kcu.constraint_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name=rc.constraint_name AND tc.constraint_schema=rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name=ccu.constraint_name AND tc.constraint_schema=ccu.constraint_schema
WHERE tc.table_schema='public' AND tc.table_name IN ('JOBHISTORY','SALES','EMPLOYEE')
  AND tc.constraint_type='FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;
ROLLBACK;
-- Use staging-only tests for expected failures, with SAVEPOINT recovery for PG:
-- BEGIN; SAVEPOINT negative; DELETE FROM public."JOB" WHERE ...;
-- ROLLBACK TO SAVEPOINT negative; ROLLBACK;
