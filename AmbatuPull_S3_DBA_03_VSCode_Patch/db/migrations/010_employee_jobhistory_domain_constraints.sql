BEGIN TRANSACTION;

-- S3-DBA-03 (#): HR domain checks without rebuilding tables.
-- SQLite: use BEFORE INSERT/UPDATE triggers to preserve existing foreign keys,
-- active HR views, indexes, and schema differences between both SQLite variants.
-- Policy: gender M/F/O (O is present in local schema); nullable values stay
-- nullable; salary >= 0, including zero; JOBHISTORY.effDate already NOT NULL.
-- Dates must be valid canonical ISO YYYY-MM-DD when provided.
-- Caller wraps this migration in a transaction; no explicit BEGIN/COMMIT.

-- S3-DBA-03: block installation if pre-existing rows violate the requested rules.
-- A TEMP table with a CHECK acts as a transactional assertion. No ERP data is modified.
CREATE TEMP TABLE _s3_dba03_assert (ok INTEGER NOT NULL CHECK (ok = 1));
INSERT INTO _s3_dba03_assert (ok)
SELECT CASE WHEN EXISTS (SELECT 1 FROM EMPLOYEE WHERE
   (gender IS NOT NULL AND gender NOT IN ('M','F','O')) OR
   ((hireDate IS NOT NULL AND (typeof(hireDate) <> 'text' OR length(hireDate) <> 10 OR hireDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(hireDate, '+0 days') <> hireDate, 1)))) OR
   ((birthDate IS NOT NULL AND (typeof(birthDate) <> 'text' OR length(birthDate) <> 10 OR birthDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(birthDate, '+0 days') <> birthDate, 1)))) OR
   ((sepDate IS NOT NULL AND (typeof(sepDate) <> 'text' OR length(sepDate) <> 10 OR sepDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(sepDate, '+0 days') <> sepDate, 1)))) OR
   (sepDate IS NOT NULL AND (hireDate IS NULL OR sepDate < hireDate)) OR
   (birthDate IS NOT NULL AND hireDate IS NOT NULL AND birthDate >= hireDate))
OR EXISTS (SELECT 1 FROM JOBHISTORY WHERE
   (salary IS NOT NULL AND (typeof(salary) NOT IN ('integer','real') OR salary < 0)) OR
   (effDate IS NULL OR (effDate IS NOT NULL AND (typeof(effDate) <> 'text' OR length(effDate) <> 10 OR effDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(effDate, '+0 days') <> effDate, 1))))) THEN 0 ELSE 1 END;
DROP TABLE _s3_dba03_assert;

CREATE TRIGGER trg_s3_employee_hr_domain_insert
BEFORE INSERT ON EMPLOYEE
BEGIN
    SELECT CASE WHEN NEW.gender IS NOT NULL AND (typeof(NEW.gender) <> 'text' OR NEW.gender NOT IN ('M','F','O')) THEN RAISE(ABORT, 'chk_employee_gender') END;
    SELECT CASE WHEN (NEW.hireDate IS NOT NULL AND (typeof(NEW.hireDate) <> 'text' OR length(NEW.hireDate) <> 10 OR NEW.hireDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(NEW.hireDate, '+0 days') <> NEW.hireDate, 1))) THEN RAISE(ABORT, 'chk_employee_hiredate_format') END;
    SELECT CASE WHEN (NEW.birthDate IS NOT NULL AND (typeof(NEW.birthDate) <> 'text' OR length(NEW.birthDate) <> 10 OR NEW.birthDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(NEW.birthDate, '+0 days') <> NEW.birthDate, 1))) THEN RAISE(ABORT, 'chk_employee_birthdate_format') END;
    SELECT CASE WHEN (NEW.sepDate IS NOT NULL AND (typeof(NEW.sepDate) <> 'text' OR length(NEW.sepDate) <> 10 OR NEW.sepDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(NEW.sepDate, '+0 days') <> NEW.sepDate, 1))) THEN RAISE(ABORT, 'chk_employee_sepdate_format') END;
    SELECT CASE WHEN NEW.sepDate IS NOT NULL AND (NEW.hireDate IS NULL OR NEW.sepDate < NEW.hireDate) THEN RAISE(ABORT, 'chk_employee_sepdate') END;
    SELECT CASE WHEN NEW.birthDate IS NOT NULL AND NEW.hireDate IS NOT NULL AND NEW.birthDate >= NEW.hireDate THEN RAISE(ABORT, 'chk_employee_birthdate') END;
END; -- keep END terminator on a line with comment for migration runner

CREATE TRIGGER trg_s3_employee_hr_domain_update
BEFORE UPDATE ON EMPLOYEE
BEGIN
    SELECT CASE WHEN NEW.gender IS NOT NULL AND (typeof(NEW.gender) <> 'text' OR NEW.gender NOT IN ('M','F','O')) THEN RAISE(ABORT, 'chk_employee_gender') END;
    SELECT CASE WHEN (NEW.hireDate IS NOT NULL AND (typeof(NEW.hireDate) <> 'text' OR length(NEW.hireDate) <> 10 OR NEW.hireDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(NEW.hireDate, '+0 days') <> NEW.hireDate, 1))) THEN RAISE(ABORT, 'chk_employee_hiredate_format') END;
    SELECT CASE WHEN (NEW.birthDate IS NOT NULL AND (typeof(NEW.birthDate) <> 'text' OR length(NEW.birthDate) <> 10 OR NEW.birthDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(NEW.birthDate, '+0 days') <> NEW.birthDate, 1))) THEN RAISE(ABORT, 'chk_employee_birthdate_format') END;
    SELECT CASE WHEN (NEW.sepDate IS NOT NULL AND (typeof(NEW.sepDate) <> 'text' OR length(NEW.sepDate) <> 10 OR NEW.sepDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(NEW.sepDate, '+0 days') <> NEW.sepDate, 1))) THEN RAISE(ABORT, 'chk_employee_sepdate_format') END;
    SELECT CASE WHEN NEW.sepDate IS NOT NULL AND (NEW.hireDate IS NULL OR NEW.sepDate < NEW.hireDate) THEN RAISE(ABORT, 'chk_employee_sepdate') END;
    SELECT CASE WHEN NEW.birthDate IS NOT NULL AND NEW.hireDate IS NOT NULL AND NEW.birthDate >= NEW.hireDate THEN RAISE(ABORT, 'chk_employee_birthdate') END;
END; -- keep END terminator on a line with comment for migration runner

CREATE TRIGGER trg_s3_jobhistory_hr_domain_insert
BEFORE INSERT ON JOBHISTORY
BEGIN
    SELECT CASE WHEN NEW.salary IS NOT NULL AND (typeof(NEW.salary) NOT IN ('integer','real') OR NEW.salary < 0) THEN RAISE(ABORT, 'chk_jobhistory_salary_nonnegative') END;
    SELECT CASE WHEN NEW.effDate IS NULL OR (NEW.effDate IS NOT NULL AND (typeof(NEW.effDate) <> 'text' OR length(NEW.effDate) <> 10 OR NEW.effDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(NEW.effDate, '+0 days') <> NEW.effDate, 1))) THEN RAISE(ABORT, 'chk_jobhistory_effdate') END;
END; -- keep END terminator on a line with comment for migration runner

CREATE TRIGGER trg_s3_jobhistory_hr_domain_update
BEFORE UPDATE ON JOBHISTORY
BEGIN
    SELECT CASE WHEN NEW.salary IS NOT NULL AND (typeof(NEW.salary) NOT IN ('integer','real') OR NEW.salary < 0) THEN RAISE(ABORT, 'chk_jobhistory_salary_nonnegative') END;
    SELECT CASE WHEN NEW.effDate IS NULL OR (NEW.effDate IS NOT NULL AND (typeof(NEW.effDate) <> 'text' OR length(NEW.effDate) <> 10 OR NEW.effDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(NEW.effDate, '+0 days') <> NEW.effDate, 1))) THEN RAISE(ABORT, 'chk_jobhistory_effdate') END;
END; -- keep END terminator on a line with comment for migration runner

COMMIT;
