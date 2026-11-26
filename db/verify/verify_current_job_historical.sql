-- S3-DBA-02 historical SQLite schema fallback: JOBHISTORY has no deptCode:
-- showing EMPLOYEE's current dept instead would fabricate an as-of value.
WITH ranked AS (
  SELECT jh.empNo, jh.jobCode, jh.salary, jh.effDate,
         ROW_NUMBER() OVER (PARTITION BY jh.empNo
           ORDER BY jh.effDate DESC, jh.jobCode) AS rn
  FROM JOBHISTORY jh
  WHERE jh.status = 'Active' AND jh.effDate <= :asOfDate
)
SELECT e.empNo, r.jobCode, j.jobDesc, NULL AS deptCode,
       NULL AS deptName, r.salary, r.effDate
FROM EMPLOYEE e
LEFT JOIN ranked r ON r.empNo = e.empNo AND r.rn = 1
LEFT JOIN JOB j ON j.jobCode = r.jobCode
WHERE e.status = 'Active' AND e.empNo = :empNo;
