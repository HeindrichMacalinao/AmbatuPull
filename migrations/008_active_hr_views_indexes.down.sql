-- S3-DBA-01 rollback: remove only the eight objects introduced in migration 008.
-- Never drop/rebuild EMPLOYEE, JOB, DEPARTMENT or JOBHISTORY.
DROP VIEW v_active_employees;
DROP VIEW v_active_jobs;
DROP VIEW v_active_departments;
DROP VIEW v_active_jobhistory;

DROP INDEX idx_employee_status_lastname_firstname;
DROP INDEX idx_job_status_jobcode;
DROP INDEX idx_department_status_deptcode;
DROP INDEX idx_jobhistory_empno_effdate_status;
