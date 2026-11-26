-- S3-DBA-06 rollback: remove only indexes created by migration 011.
DROP INDEX IF EXISTS idx_employee_active_name_cover;
DROP INDEX IF EXISTS idx_employee_jobcode;
DROP INDEX IF EXISTS idx_jobhistory_jobcode;
DROP INDEX IF EXISTS idx_jobhistory_deptcode;
DROP INDEX IF EXISTS idx_jobhistory_active_empno_effdate_cover;
