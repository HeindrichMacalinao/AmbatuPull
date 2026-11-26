-- S3-DBA-06: historical/alternate SQLite schema variant.
-- EMPLOYEE in db/migrations/001 has no current jobCode/deptCode columns;
-- JOBHISTORY does have both historical jobCode and deptCode.
BEGIN TRANSACTION;

CREATE INDEX idx_employee_active_name_cover
ON EMPLOYEE(lastName, firstName, empNo)
WHERE status = 'Active';

CREATE INDEX idx_jobhistory_jobcode
ON JOBHISTORY(jobCode);

CREATE INDEX idx_jobhistory_deptcode
ON JOBHISTORY(deptCode);

CREATE INDEX idx_jobhistory_active_empno_effdate_cover
ON JOBHISTORY(empNo, effDate DESC, jobCode, deptCode, salary)
WHERE status = 'Active';

COMMIT;
