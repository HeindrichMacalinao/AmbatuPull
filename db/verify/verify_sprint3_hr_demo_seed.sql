-- S3-DBA-05 read-only verification for SQLite (run after partial demo seed).
-- Expected: jobs=4, departments=4, employees=4, history=2.
-- E-002/E-003/E-004 history is absent until Figures 16-17 are supplied.
SELECT 'jobs' AS category, COUNT(*) AS found FROM JOB WHERE jobCode IN ('J-001','J-002','J-003','J-004');
SELECT 'departments' AS category, COUNT(*) AS found FROM DEPARTMENT WHERE deptCode IN ('D-001','D-002','D-003','D-004');
SELECT 'employees' AS category, COUNT(*) AS found FROM EMPLOYEE WHERE empNo IN ('E-001','E-002','E-003','E-004');
SELECT 'E-001 history' AS category, COUNT(*) AS found FROM JOBHISTORY WHERE empNo = 'E-001';
SELECT empNo, sepDate, status FROM EMPLOYEE WHERE empNo = 'E-004';
-- Expected: zero rows from active employee view for E-004.
SELECT empNo FROM v_active_employees WHERE empNo = 'E-004';
-- Expected E-001 current salary: 52000 at 2026-11-26, 45000 at 2022-12-31.
SELECT salary FROM JOBHISTORY
 WHERE empNo = 'E-001' AND status = 'Active' AND effDate <= '2026-11-26'
 ORDER BY effDate DESC LIMIT 1;
SELECT salary FROM JOBHISTORY
 WHERE empNo = 'E-001' AND status = 'Active' AND effDate <= '2022-12-31'
 ORDER BY effDate DESC LIMIT 1;
PRAGMA foreign_key_check;
PRAGMA integrity_check;
