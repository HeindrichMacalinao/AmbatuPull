-- S3-DBA-06 rollback: remove only indexes introduced by migration 013.
BEGIN;
DROP INDEX public.idx_employee_deptcode;
DROP INDEX public.idx_employee_jobcode;
DROP INDEX public.idx_jobhistory_jobcode;
DROP INDEX public.idx_jobhistory_active_empno_effdate_cover;
COMMIT;
