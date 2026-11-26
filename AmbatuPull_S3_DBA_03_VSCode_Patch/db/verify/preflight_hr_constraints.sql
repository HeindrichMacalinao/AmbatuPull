-- S3-DBA-03 PRE-MIGRATION AUDIT (SQLite): read-only. All violation counts should be 0.
-- NULL fields are allowed where the original schema allows NULL.
SELECT 'EMPLOYEE invalid HR domains' AS check_name, COUNT(*) AS violations
FROM EMPLOYEE WHERE
   (gender IS NOT NULL AND gender NOT IN ('M','F','O')) OR
   ((hireDate IS NOT NULL AND (typeof(hireDate) <> 'text' OR length(hireDate) <> 10 OR hireDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(hireDate, '+0 days') <> hireDate, 1)))) OR
   ((birthDate IS NOT NULL AND (typeof(birthDate) <> 'text' OR length(birthDate) <> 10 OR birthDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(birthDate, '+0 days') <> birthDate, 1)))) OR
   ((sepDate IS NOT NULL AND (typeof(sepDate) <> 'text' OR length(sepDate) <> 10 OR sepDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(sepDate, '+0 days') <> sepDate, 1)))) OR
   (sepDate IS NOT NULL AND (hireDate IS NULL OR sepDate < hireDate)) OR
   (birthDate IS NOT NULL AND hireDate IS NOT NULL AND birthDate >= hireDate);
SELECT 'JOBHISTORY invalid salary/effDate' AS check_name, COUNT(*) AS violations
FROM JOBHISTORY WHERE
   (salary IS NOT NULL AND (typeof(salary) NOT IN ('integer','real') OR salary < 0)) OR
   (effDate IS NULL OR (effDate IS NOT NULL AND (typeof(effDate) <> 'text' OR length(effDate) <> 10 OR effDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR COALESCE(date(effDate, '+0 days') <> effDate, 1))));
