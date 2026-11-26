-- S3-DBA-06 SQLite plan inspection.
-- LOCAL/DISPOSABLE BENCHMARK DATABASE ONLY. Do not run on production.
-- Run ANALYZE first (or use profile_hr_queries.py, which does this on copies).
-- SQLite CLI supports .parameter; all user values are bound, not concatenated.

.parameter init
.parameter set @likePattern '%Garcia%'
.parameter set @empNo 'E-001'
.parameter set @historyEmpNo 'E-000005'
.parameter set @asOfDate '2026-11-26'
.parameter set @jobCode 'BJOB-01'
.parameter set @deptCode 'BDEP-01'

ANALYZE;

-- Employee substring search. A leading wildcard prevents a B-tree seek.
EXPLAIN QUERY PLAN
SELECT empNo, lastName, firstName, status
FROM EMPLOYEE
WHERE status = 'Active' AND lastName LIKE @likePattern;

-- Exact employee primary-key lookup.
EXPLAIN QUERY PLAN
SELECT empNo, lastName, firstName, status
FROM EMPLOYEE
WHERE empNo = @empNo;

-- Employee career timeline in descending effective-date order.
EXPLAIN QUERY PLAN
SELECT empNo, jobCode, deptCode, salary, effDate, status
FROM JOBHISTORY
WHERE empNo = @historyEmpNo AND status = 'Active'
ORDER BY effDate DESC;

-- S3-DBA-02 current job/salary as of a caller-supplied date.
EXPLAIN QUERY PLAN
SELECT empNo, jobCode, deptCode, salary, effDate
FROM JOBHISTORY
WHERE empNo = @empNo
  AND status = 'Active'
  AND effDate <= @asOfDate
ORDER BY effDate DESC
LIMIT 1;

-- Batch active employee career query; JOBHISTORY.deptCode is historical in SQLite.
EXPLAIN QUERY PLAN
WITH ranked AS (
    SELECT jh.empNo, jh.jobCode, jh.deptCode, jh.salary, jh.effDate,
           ROW_NUMBER() OVER (
               PARTITION BY jh.empNo
               ORDER BY jh.effDate DESC, jh.jobCode
           ) AS rn
    FROM JOBHISTORY AS jh
    WHERE jh.status = 'Active' AND jh.effDate <= @asOfDate
)
SELECT e.empNo, r.jobCode, j.jobDesc, r.deptCode,
       d.deptName, r.salary, r.effDate
FROM v_active_employees AS e
LEFT JOIN ranked AS r ON r.empNo = e.empNo AND r.rn = 1
LEFT JOIN JOB AS j ON j.jobCode = r.jobCode
LEFT JOIN DEPARTMENT AS d ON d.deptCode = r.deptCode
ORDER BY e.empNo;

-- Child-side FK lookups used by S3-DBA-04 guards.
EXPLAIN QUERY PLAN SELECT 1 FROM EMPLOYEE WHERE jobCode = @jobCode LIMIT 1;
EXPLAIN QUERY PLAN SELECT 1 FROM JOBHISTORY WHERE jobCode = @jobCode LIMIT 1;
EXPLAIN QUERY PLAN SELECT 1 FROM JOBHISTORY WHERE deptCode = @deptCode LIMIT 1;
EXPLAIN QUERY PLAN SELECT 1 FROM EMPLOYEE WHERE deptCode = @deptCode LIMIT 1;
