-- S3-DBA-01: SQLite read-only verification (SQLite shell / sqlite3 CLI).
-- Check each view's columns against the corresponding table using PRAGMA table_info.
SELECT 'employees' AS object, count(*) AS visible_rows FROM v_active_employees;
SELECT 'jobs' AS object, count(*) AS visible_rows FROM v_active_jobs;
SELECT 'departments' AS object, count(*) AS visible_rows FROM v_active_departments;
SELECT 'jobhistory' AS object, count(*) AS visible_rows FROM v_active_jobhistory;

-- Each query must return 0 rows.
SELECT * FROM v_active_employees WHERE status <> 'Active';
SELECT * FROM v_active_jobs WHERE status <> 'Active';
SELECT * FROM v_active_departments WHERE status <> 'Active';
SELECT * FROM v_active_jobhistory WHERE status <> 'Active';

-- Inspect indexes and representative plans. Small tables may choose scans;
-- plan selection is not a performance guarantee. Avoid EXPLAIN ANALYZE on prod.
PRAGMA index_list('EMPLOYEE');
PRAGMA index_list('JOB');
PRAGMA index_list('DEPARTMENT');
PRAGMA index_list('JOBHISTORY');
EXPLAIN QUERY PLAN SELECT empNo FROM v_active_employees ORDER BY lastName, firstName;
EXPLAIN QUERY PLAN SELECT jobCode FROM v_active_jobs ORDER BY jobCode;
EXPLAIN QUERY PLAN SELECT deptCode FROM v_active_departments ORDER BY deptCode;
EXPLAIN QUERY PLAN SELECT empNo, effDate FROM v_active_jobhistory
                    WHERE empNo = '00001' ORDER BY effDate;
PRAGMA foreign_key_check;
PRAGMA integrity_check;
