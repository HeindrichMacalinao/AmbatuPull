-- S3-DBA-03: remove ONLY the four triggers introduced by this migration.
DROP TRIGGER IF EXISTS trg_s3_jobhistory_hr_domain_update;
DROP TRIGGER IF EXISTS trg_s3_jobhistory_hr_domain_insert;
DROP TRIGGER IF EXISTS trg_s3_employee_hr_domain_update;
DROP TRIGGER IF EXISTS trg_s3_employee_hr_domain_insert;
