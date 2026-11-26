-- S3-DBA-06: targeted SQLite HR lookup indexes.
-- Apply only after S3-DBA-01/03/04. The main runner schema has EMPLOYEE.jobCode.
-- No existing index is dropped or replaced.

-- Covers active employee name-search projections. A leading-wildcard LIKE still
-- scans the active index; this does NOT turn '%term%' into a B-tree seek.
CREATE INDEX idx_employee_active_name_cover
ON EMPLOYEE(lastName, firstName, empNo)
WHERE status = 'Active';

-- Child-side FK indexes used by S3-DBA-04 protection checks. EMPLOYEE.deptCode
-- is already indexed as idx_employee_dept in migration 001.
CREATE INDEX idx_employee_jobcode
ON EMPLOYEE(jobCode);

CREATE INDEX idx_jobhistory_jobcode
ON JOBHISTORY(jobCode);

CREATE INDEX idx_jobhistory_deptcode
ON JOBHISTORY(deptCode);

-- S3-DBA-02 active/as-of lookup and batch ranking. All projected JOBHISTORY
-- fields are in the index, allowing a SQLite covering-index read.
CREATE INDEX idx_jobhistory_active_empno_effdate_cover
ON JOBHISTORY(empNo, effDate DESC, jobCode, deptCode, salary)
WHERE status = 'Active';
