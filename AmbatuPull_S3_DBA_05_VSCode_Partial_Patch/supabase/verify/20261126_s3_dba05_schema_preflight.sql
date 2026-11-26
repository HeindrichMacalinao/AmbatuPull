-- S3-DBA-05: Supabase/PostgreSQL READ-ONLY schema compatibility preflight.
-- It is NOT a seed migration. Do not insert/alter production records.
-- Expected missing columns in the supplied PostgreSQL snapshot:
-- EMPLOYEE.gender, EMPLOYEE.birthDate, EMPLOYEE.hireDate, EMPLOYEE.sepDate;
-- JOBHISTORY.deptCode. Supabase instead has dateHired/dateSeparated and
-- non-null current EMPLOYEE.jobCode/deptCode; those assignments were NOT provided.
WITH expected(table_name, column_name) AS (
 VALUES
  ('EMPLOYEE','empNo'),('EMPLOYEE','lastName'),('EMPLOYEE','firstName'),
  ('EMPLOYEE','gender'),('EMPLOYEE','birthDate'),('EMPLOYEE','hireDate'),
  ('EMPLOYEE','sepDate'),('EMPLOYEE','status'),('EMPLOYEE','stamp'),
  ('EMPLOYEE','jobCode'),('EMPLOYEE','deptCode'),
  ('JOBHISTORY','empNo'),('JOBHISTORY','jobCode'),
  ('JOBHISTORY','deptCode'),('JOBHISTORY','effDate'),
  ('JOBHISTORY','salary'),('JOBHISTORY','status'),('JOBHISTORY','stamp')
)
SELECT e.table_name, e.column_name,
       CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'PRESENT' END AS schema_status
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = e.table_name AND c.column_name = e.column_name
ORDER BY e.table_name, e.column_name;
