-- S3-DBA-01: active HR views and indexes (SQLite migration runner).
-- Confirmed against the repository's core ERP schema; no table rebuilds/data changes.
-- Intentional CREATE without IF NOT EXISTS: fail rather than silently adopt an
-- existing object which the paired down migration might later drop.
CREATE VIEW v_active_employees AS
SELECT * FROM EMPLOYEE WHERE status = 'Active';

CREATE VIEW v_active_jobs AS
SELECT * FROM JOB WHERE status = 'Active';

CREATE VIEW v_active_departments AS
SELECT * FROM DEPARTMENT WHERE status = 'Active';

CREATE VIEW v_active_jobhistory AS
SELECT * FROM JOBHISTORY WHERE status = 'Active';

CREATE INDEX idx_employee_status_lastname_firstname
ON EMPLOYEE(status, lastName, firstName);

CREATE INDEX idx_job_status_jobcode
ON JOB(status, jobCode);

CREATE INDEX idx_department_status_deptcode
ON DEPARTMENT(status, deptCode);

CREATE INDEX idx_jobhistory_empno_effdate_status
ON JOBHISTORY(empNo, effDate, status);
