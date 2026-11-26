-- Manual PostgreSQL rollback only; keep OUTSIDE supabase/migrations/.
-- Do not run as another forward migration.
BEGIN;
DROP VIEW public.v_active_employees;
DROP VIEW public.v_active_jobs;
DROP VIEW public.v_active_departments;
DROP VIEW public.v_active_jobhistory;
DROP INDEX public.idx_employee_status_lastname_firstname;
DROP INDEX public.idx_job_status_jobcode;
DROP INDEX public.idx_department_status_deptcode;
DROP INDEX public.idx_jobhistory_empno_effdate_status;
COMMIT;
