-- S3-DBA-04 SQLite verification: safe for a disposable test database.
-- Run with: sqlite3 -bail path/to/test.db < db/verify/verify_hr_referential_integrity.sql
-- The destructive negative cases cannot be caught inside portable SQLite SQL;
-- run tests/verify_hr_referential_integrity.py for expected-failure assertions.
-- Every UPDATE below is rolled back; no records are intentionally persisted.
PRAGMA foreign_keys=ON;
SELECT 'foreign_key_violations' AS check_name, count(*) AS expected_zero
  FROM pragma_foreign_key_check;
SELECT 'orphan_history_job', count(*) AS expected_zero
  FROM JOBHISTORY h LEFT JOIN JOB j ON j.jobCode=h.jobCode WHERE j.jobCode IS NULL;
SELECT 'orphan_history_department', count(*) AS expected_zero
  FROM JOBHISTORY h LEFT JOIN DEPARTMENT d ON d.deptCode=h.deptCode
 WHERE h.deptCode IS NOT NULL AND d.deptCode IS NULL;
SELECT 'orphan_history_employee', count(*) AS expected_zero
  FROM JOBHISTORY h LEFT JOIN EMPLOYEE e ON e.empNo=h.empNo WHERE e.empNo IS NULL;
SELECT 'orphan_sales_employee', count(*) AS expected_zero
  FROM SALES s LEFT JOIN EMPLOYEE e ON e.empNo=s.empNo
 WHERE s.empNo IS NOT NULL AND e.empNo IS NULL;
SELECT 'active_history_with_inactive_job', count(*) AS expected_zero
  FROM JOBHISTORY h JOIN JOB j ON j.jobCode=h.jobCode
 WHERE h.status='Active' AND j.status <> 'Active';
SELECT 'active_history_with_inactive_department', count(*) AS expected_zero
  FROM JOBHISTORY h JOIN DEPARTMENT d ON d.deptCode=h.deptCode
 WHERE h.status='Active' AND d.status <> 'Active';
SELECT name AS installed_guard FROM sqlite_master
 WHERE type='trigger' AND name LIKE 'trg_s3_hrri_%' ORDER BY name;

BEGIN IMMEDIATE;
CREATE TEMP TABLE _hrri_before AS
  SELECT e.empNo AS emp, e.status AS old_status,
         (SELECT count(*) FROM JOBHISTORY WHERE empNo=e.empNo) AS history_count
  FROM EMPLOYEE e
 WHERE e.empNo=(SELECT h.empNo FROM JOBHISTORY h JOIN EMPLOYEE e2 ON e2.empNo=h.empNo
                 WHERE e2.status='Active' LIMIT 1);
UPDATE EMPLOYEE SET status='Inactive'
 WHERE empNo=(SELECT emp FROM _hrri_before);
SELECT 'soft_delete_preserves_history' AS check_name, count(*) AS expected_one_or_zero
  FROM _hrri_before b JOIN EMPLOYEE e ON e.empNo=b.emp
 WHERE e.status='Inactive' AND
       b.history_count=(SELECT count(*) FROM JOBHISTORY WHERE empNo=b.emp);
DROP TABLE _hrri_before;
ROLLBACK;
-- Expected rejected destructive operations (exercised by the Python harness):
-- DELETE FROM JOB WHERE jobCode=(SELECT jobCode FROM JOBHISTORY LIMIT 1);
-- DELETE FROM DEPARTMENT WHERE deptCode=(SELECT deptCode FROM JOBHISTORY WHERE deptCode IS NOT NULL LIMIT 1);
-- DELETE FROM EMPLOYEE WHERE empNo=(SELECT empNo FROM JOBHISTORY LIMIT 1);
-- UPDATE JOB SET status='Inactive' WHERE jobCode=(SELECT jobCode FROM JOBHISTORY WHERE status='Active' LIMIT 1);
