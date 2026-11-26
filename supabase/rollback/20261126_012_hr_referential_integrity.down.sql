-- S3-DBA-04 rollback: remove only this ticket's triggers/functions.
-- PostgreSQL baseline foreign keys, records, and earlier migrations stay intact.
BEGIN;
DROP TRIGGER IF EXISTS trg_s3_hrri_history_update ON public."JOBHISTORY";
DROP TRIGGER IF EXISTS trg_s3_hrri_history_insert ON public."JOBHISTORY";
DROP TRIGGER IF EXISTS trg_s3_hrri_employee_insert ON public."EMPLOYEE";
DROP TRIGGER IF EXISTS trg_s3_hrri_employee_restore ON public."EMPLOYEE";
DROP TRIGGER IF EXISTS trg_s3_hrri_employee_delete ON public."EMPLOYEE";
DROP TRIGGER IF EXISTS trg_s3_hrri_dept_deactivate ON public."DEPARTMENT";
DROP TRIGGER IF EXISTS trg_s3_hrri_dept_delete ON public."DEPARTMENT";
DROP TRIGGER IF EXISTS trg_s3_hrri_job_deactivate ON public."JOB";
DROP TRIGGER IF EXISTS trg_s3_hrri_job_delete ON public."JOB";
DROP FUNCTION IF EXISTS public.s3_hrri_guard_jobhistory();
DROP FUNCTION IF EXISTS public.s3_hrri_guard_employee();
DROP FUNCTION IF EXISTS public.s3_hrri_guard_department();
DROP FUNCTION IF EXISTS public.s3_hrri_guard_job();
COMMIT;
