-- S3-DBA-03: remove ONLY constraints added by the corresponding up migration.
BEGIN;
ALTER TABLE public."EMPLOYEE" DROP CONSTRAINT IF EXISTS chk_employee_gender_s3;
ALTER TABLE public."EMPLOYEE" DROP CONSTRAINT IF EXISTS chk_employee_birthdate_s3;
ALTER TABLE public."EMPLOYEE" DROP CONSTRAINT IF EXISTS chk_employee_sepdate_s3;
COMMIT;
