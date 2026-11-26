-- S3-DBA-02 local SQLite main-schema verification template.
-- Run with SQLite named binds :empNo and :asOfDate (YYYY-MM-DD).
-- This main schema has JOBHISTORY.deptCode. On the historical SQLite
-- schema use verify_current_job_historical.sql instead.
-- A client calling this SQL must enforce HR salary authorization.

WITH ranked AS (
  SELECT jh.empNo, jh.jobCode, jh.deptCode, jh.salary, jh.effDate,
         ROW_NUMBER() OVER (PARTITION BY jh.empNo
           ORDER BY jh.effDate DESC, jh.jobCode) AS rn
  FROM JOBHISTORY jh
  WHERE jh.status = 'Active' AND jh.effDate <= :asOfDate
)
SELECT e.empNo, r.jobCode, j.jobDesc, r.deptCode,
       d.deptName, r.salary, r.effDate
FROM EMPLOYEE e
LEFT JOIN ranked r ON r.empNo = e.empNo AND r.rn = 1
LEFT JOIN JOB j ON j.jobCode = r.jobCode
LEFT JOIN DEPARTMENT d ON d.deptCode = r.deptCode
WHERE e.status = 'Active' AND e.empNo = :empNo;

-- Check that this uses the indexed employee/date access path when the
-- query is selective; the SQLite query planner can vary by fixture size.
EXPLAIN QUERY PLAN
SELECT jh.empNo, jh.effDate FROM JOBHISTORY jh
WHERE jh.empNo = :empNo AND jh.status = 'Active'
  AND jh.effDate <= :asOfDate
ORDER BY jh.effDate DESC LIMIT 1;
