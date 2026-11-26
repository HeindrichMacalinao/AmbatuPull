-- S3-DBA-05: PARTIAL, NON-PRODUCTION SQLite HR demonstration seed.
-- SOURCE: exact values supplied in ticket, 2026-11-26. Student Guide Figures
-- 16-17 were NOT provided. E-002, E-003, and E-004 JOBHISTORY MUST NOT be
-- fabricated; acceptance criterion 'match Figures 15-22 exactly' is OPEN.
--
-- Applies to BOTH checked SQLite variants (main migration runner and
-- db/migrations historical schema). PostgreSQL/Supabase has a different,
-- incompatible EMPLOYEE/JOBHISTORY schema; see docs/S3_DBA_05.md.
--
-- Never run against production. Keep PRAGMA foreign_keys=ON per connection.
-- Skip identical existing PKs, never overwrite existing records or reset
-- status. A preflight guard FAILS if a known demo ID already has different
-- specified values. No DELETE, TRUNCATE, DROP of application tables.
-- Technical stamp 'SEED S3-DBA-05' identifies a fixture, NOT a real actor/time.

PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;
CREATE TEMP TABLE _s3_dba05_match_guard(ok INTEGER NOT NULL CHECK (ok = 1));

WITH expected(jobCode, jobDesc, status, stamp) AS (VALUES
  ('J-001','Software Engineer','Active','SEED S3-DBA-05'),
  ('J-002','Sales Manager','Active','SEED S3-DBA-05'),
  ('J-003','HR Specialist','Active','SEED S3-DBA-05'),
  ('J-004','Accountant','Inactive','SEED S3-DBA-05')
)
INSERT INTO _s3_dba05_match_guard(ok)
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM expected e JOIN JOB j ON j.jobCode = e.jobCode
  WHERE j.jobDesc IS NOT e.jobDesc OR j.status IS NOT e.status
     OR j.stamp IS NOT e.stamp
) THEN 0 ELSE 1 END;

WITH expected(deptCode, deptName, status, stamp) AS (VALUES
  ('D-001','Engineering','Active','SEED S3-DBA-05'),
  ('D-002','Sales','Active','SEED S3-DBA-05'),
  ('D-003','Human Resources','Active','SEED S3-DBA-05'),
  ('D-004','Finance','Inactive','SEED S3-DBA-05')
)
INSERT INTO _s3_dba05_match_guard(ok)
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM expected e JOIN DEPARTMENT d ON d.deptCode = e.deptCode
  WHERE d.deptName IS NOT e.deptName OR d.status IS NOT e.status
     OR d.stamp IS NOT e.stamp
) THEN 0 ELSE 1 END;

WITH expected(empNo, lastName, firstName, gender, birthDate, hireDate, sepDate, status, stamp) AS (VALUES
  ('E-001','Santos','Maria','F','1990-05-12','2020-03-01',NULL,'Active','SEED S3-DBA-05'),
  ('E-002','Reyes','Juan','M','1988-11-03','2019-07-15',NULL,'Active','SEED S3-DBA-05'),
  ('E-003','Cruz','Ana','F','1995-02-20','2021-01-10',NULL,'Active','SEED S3-DBA-05'),
  ('E-004','Garcia','Pedro','M','1985-08-30','2018-05-01','2025-12-31','Inactive','SEED S3-DBA-05')
)
INSERT INTO _s3_dba05_match_guard(ok)
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM expected e JOIN EMPLOYEE t ON t.empNo = e.empNo
  WHERE t.lastName IS NOT e.lastName OR t.firstName IS NOT e.firstName
     OR t.gender IS NOT e.gender OR t.birthDate IS NOT e.birthDate
     OR t.hireDate IS NOT e.hireDate OR t.sepDate IS NOT e.sepDate
     OR t.status IS NOT e.status OR t.stamp IS NOT e.stamp
) THEN 0 ELSE 1 END;

WITH expected(empNo, jobCode, deptCode, effDate, salary, status, stamp) AS (VALUES
  ('E-001','J-001','D-001','2020-03-01',45000,'Active','SEED S3-DBA-05'),
  ('E-001','J-001','D-001','2023-01-01',52000,'Active','SEED S3-DBA-05')
)
INSERT INTO _s3_dba05_match_guard(ok)
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM expected e JOIN JOBHISTORY h
    ON h.empNo=e.empNo AND h.jobCode=e.jobCode AND h.effDate=e.effDate
  WHERE h.deptCode IS NOT e.deptCode OR h.salary IS NOT e.salary
     OR h.status IS NOT e.status OR h.stamp IS NOT e.stamp
) THEN 0 ELSE 1 END;

DROP TABLE _s3_dba05_match_guard;

INSERT INTO JOB (jobCode, jobDesc, status, stamp) VALUES
 ('J-001','Software Engineer','Active','SEED S3-DBA-05'),
 ('J-002','Sales Manager','Active','SEED S3-DBA-05'),
 ('J-003','HR Specialist','Active','SEED S3-DBA-05'),
 ('J-004','Accountant','Inactive','SEED S3-DBA-05')
ON CONFLICT(jobCode) DO NOTHING;

INSERT INTO DEPARTMENT (deptCode, deptName, status, stamp) VALUES
 ('D-001','Engineering','Active','SEED S3-DBA-05'),
 ('D-002','Sales','Active','SEED S3-DBA-05'),
 ('D-003','Human Resources','Active','SEED S3-DBA-05'),
 ('D-004','Finance','Inactive','SEED S3-DBA-05')
ON CONFLICT(deptCode) DO NOTHING;

-- deptCode/jobCode on the local-runner EMPLOYEE schema are nullable and were
-- not given by the ticket. They are intentionally left NULL, not guessed.
INSERT INTO EMPLOYEE
 (empNo, lastName, firstName, gender, birthDate, hireDate, sepDate, status, stamp)
VALUES
 ('E-001','Santos','Maria','F','1990-05-12','2020-03-01',NULL,'Active','SEED S3-DBA-05'),
 ('E-002','Reyes','Juan','M','1988-11-03','2019-07-15',NULL,'Active','SEED S3-DBA-05'),
 ('E-003','Cruz','Ana','F','1995-02-20','2021-01-10',NULL,'Active','SEED S3-DBA-05'),
 ('E-004','Garcia','Pedro','M','1985-08-30','2018-05-01','2025-12-31','Inactive','SEED S3-DBA-05')
ON CONFLICT(empNo) DO NOTHING;

-- Only the TWO E-001 rows provided in the ticket. Do not fabricate others.
INSERT INTO JOBHISTORY
 (empNo, jobCode, deptCode, effDate, salary, status, stamp)
VALUES
 ('E-001','J-001','D-001','2020-03-01',45000,'Active','SEED S3-DBA-05'),
 ('E-001','J-001','D-001','2023-01-01',52000,'Active','SEED S3-DBA-05')
ON CONFLICT(empNo, jobCode, effDate) DO NOTHING;

COMMIT;
