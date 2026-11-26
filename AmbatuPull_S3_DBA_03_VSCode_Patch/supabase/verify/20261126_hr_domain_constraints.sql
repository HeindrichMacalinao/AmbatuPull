-- Read-only Supabase PostgreSQL preflight. No employee values or salaries returned.
-- Run against staging before attempting the migration.
SELECT 'employee invalid separation order' AS check_name, COUNT(*) AS violations
FROM public."EMPLOYEE"
WHERE "dateSeparated" IS NOT NULL AND "dateSeparated" < "dateHired";
SELECT 'jobhistory negative salary' AS check_name, COUNT(*) AS violations
FROM public."JOBHISTORY" WHERE "salary" < 0;
SELECT 'jobhistory null effective date' AS check_name, COUNT(*) AS violations
FROM public."JOBHISTORY" WHERE "effDate" IS NULL;
-- Return schema availability for the two currently missing attributes.
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='EMPLOYEE'
  AND column_name IN ('gender','birthDate','dateHired','dateSeparated')
ORDER BY column_name;
-- After migration: verify constraint presence + validation status.
SELECT conrelid::regclass AS table_name, conname, convalidated
FROM pg_constraint
WHERE conrelid IN ('public."EMPLOYEE"'::regclass,'public."JOBHISTORY"'::regclass)
  AND conname LIKE '%_s3' ORDER BY conrelid::regclass::text, conname;

-- Confirm the previously existing NOT NULL on effDate and salary.
SELECT column_name, is_nullable FROM information_schema.columns
WHERE table_schema='public' AND table_name='JOBHISTORY'
AND column_name IN ('effDate','salary') ORDER BY column_name;
-- Inspect existing CHECKs on salary; do not add a redundant check.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE conrelid='public."JOBHISTORY"'::regclass
AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%salary%';
