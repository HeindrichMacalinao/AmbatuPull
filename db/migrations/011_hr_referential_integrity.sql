-- S3-DBA-04 SQLite: use triggers to guard soft-deletes and protect FK gaps.
-- Any status=Active JOBHISTORY row is active even if employee is Inactive.
-- Hard-deletes reject ANY history, including inactive history, to avoid orphaning.
-- Existing child FKs are retained without table rebuild; enforce PRAGMA foreign_keys=ON
-- on EACH connection. Root schema has EMPLOYEE->JOB/DEPARTMENT SET NULL and
-- EMPLOYEE->JOBHISTORY CASCADE; these guards prevent destructive side effects.
-- Driver wraps UP migration in an atomic transaction (no BEGIN/COMMIT here).

CREATE TEMP TABLE _s3_dba04_preflight(ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO _s3_dba04_preflight(ok)
SELECT CASE WHEN EXISTS (
    SELECT 1 FROM JOBHISTORY h LEFT JOIN JOB j ON j.jobCode=h.jobCode
    WHERE j.jobCode IS NULL OR (h.status='Active' AND j.status<>'Active')
) OR EXISTS (
    SELECT 1 FROM JOBHISTORY h LEFT JOIN DEPARTMENT d ON d.deptCode=h.deptCode
    WHERE (h.deptCode IS NOT NULL AND d.deptCode IS NULL)
       OR (h.status='Active' AND h.deptCode IS NOT NULL AND d.status<>'Active')
) OR EXISTS (
    SELECT 1 FROM JOBHISTORY h LEFT JOIN EMPLOYEE e ON e.empNo=h.empNo
    WHERE e.empNo IS NULL
) OR EXISTS (
    SELECT 1 FROM SALES s LEFT JOIN EMPLOYEE e ON e.empNo=s.empNo
    WHERE s.empNo IS NOT NULL AND e.empNo IS NULL
) THEN 0 ELSE 1 END;
DROP TABLE _s3_dba04_preflight;

CREATE TRIGGER trg_s3_hrri_job_delete
BEFORE DELETE ON JOB

BEGIN
    SELECT CASE WHEN EXISTS (SELECT 1 FROM JOBHISTORY WHERE jobCode=OLD.jobCode) THEN RAISE(ABORT, 'S3-DBA-04: JOB has job history; hard delete denied') END;
END; -- Preserve END; terminator for Node migration runner.

CREATE TRIGGER trg_s3_hrri_job_deactivate
BEFORE UPDATE OF status ON JOB
WHEN OLD.status='Active' AND NEW.status='Inactive'
BEGIN
    SELECT CASE WHEN EXISTS (SELECT 1 FROM JOBHISTORY WHERE jobCode=OLD.jobCode AND status='Active') THEN RAISE(ABORT, 'S3-DBA-04: JOB has active job history; deactivate history first') END;
END; -- Preserve END; terminator for Node migration runner.

CREATE TRIGGER trg_s3_hrri_dept_delete
BEFORE DELETE ON DEPARTMENT

BEGIN
    SELECT CASE WHEN EXISTS (SELECT 1 FROM JOBHISTORY WHERE deptCode=OLD.deptCode) THEN RAISE(ABORT, 'S3-DBA-04: DEPARTMENT has job history; hard delete denied') END;
END; -- Preserve END; terminator for Node migration runner.

CREATE TRIGGER trg_s3_hrri_dept_deactivate
BEFORE UPDATE OF status ON DEPARTMENT
WHEN OLD.status='Active' AND NEW.status='Inactive'
BEGIN
    SELECT CASE WHEN EXISTS (SELECT 1 FROM JOBHISTORY WHERE deptCode=OLD.deptCode AND status='Active') THEN RAISE(ABORT, 'S3-DBA-04: DEPARTMENT has active job history') END;
END; -- Preserve END; terminator for Node migration runner.

CREATE TRIGGER trg_s3_hrri_employee_delete
BEFORE DELETE ON EMPLOYEE

BEGIN
    SELECT CASE WHEN EXISTS (SELECT 1 FROM JOBHISTORY WHERE empNo=OLD.empNo) THEN RAISE(ABORT, 'S3-DBA-04: EMPLOYEE has job history; hard delete denied') END;
    SELECT CASE WHEN EXISTS (SELECT 1 FROM SALES WHERE empNo=OLD.empNo) THEN RAISE(ABORT, 'S3-DBA-04: EMPLOYEE has sales; hard delete denied') END;
END; -- Preserve END; terminator for Node migration runner.

CREATE TRIGGER trg_s3_hrri_employee_restore
BEFORE UPDATE OF status ON EMPLOYEE
WHEN OLD.status='Inactive' AND NEW.status='Active'
BEGIN
    SELECT CASE WHEN EXISTS (
        SELECT 1 FROM JOBHISTORY h LEFT JOIN JOB j ON j.jobCode=h.jobCode
        WHERE h.empNo=NEW.empNo
          AND h.effDate=(SELECT MAX(h2.effDate) FROM JOBHISTORY h2 WHERE h2.empNo=NEW.empNo)
          AND (j.jobCode IS NULL OR j.status<>'Active')
    ) THEN RAISE(ABORT, 'S3-DBA-04: latest employee job history references inactive/missing JOB') END;
    SELECT CASE WHEN EXISTS (
        SELECT 1 FROM JOBHISTORY h LEFT JOIN DEPARTMENT d ON d.deptCode=h.deptCode
        WHERE h.empNo=NEW.empNo
          AND h.effDate=(SELECT MAX(h2.effDate) FROM JOBHISTORY h2 WHERE h2.empNo=NEW.empNo)
          AND h.deptCode IS NOT NULL AND (d.deptCode IS NULL OR d.status<>'Active')
    ) THEN RAISE(ABORT, 'S3-DBA-04: latest employee job history references inactive/missing DEPARTMENT') END;
END; -- Preserve END; terminator for Node migration runner.

CREATE TRIGGER trg_s3_hrri_history_insert
BEFORE INSERT ON JOBHISTORY
WHEN NEW.status='Active'
BEGIN
    SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM JOB WHERE jobCode=NEW.jobCode AND status='Active') THEN RAISE(ABORT, 'S3-DBA-04: active history requires Active JOB') END;
    SELECT CASE WHEN NEW.deptCode IS NOT NULL AND NOT EXISTS (SELECT 1 FROM DEPARTMENT WHERE deptCode=NEW.deptCode AND status='Active') THEN RAISE(ABORT, 'S3-DBA-04: active history requires Active DEPARTMENT') END;
END; -- Preserve END; terminator for Node migration runner.

CREATE TRIGGER trg_s3_hrri_history_update
BEFORE UPDATE OF status,jobCode,deptCode ON JOBHISTORY
WHEN NEW.status='Active'
BEGIN
    SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM JOB WHERE jobCode=NEW.jobCode AND status='Active') THEN RAISE(ABORT, 'S3-DBA-04: active history requires Active JOB') END;
    SELECT CASE WHEN NEW.deptCode IS NOT NULL AND NOT EXISTS (SELECT 1 FROM DEPARTMENT WHERE deptCode=NEW.deptCode AND status='Active') THEN RAISE(ABORT, 'S3-DBA-04: active history requires Active DEPARTMENT') END;
END; -- Preserve END; terminator for Node migration runner.
