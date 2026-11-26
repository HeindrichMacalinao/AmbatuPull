-- S3-DBA-04 rollback: remove ONLY triggers created by this ticket; leave FKs/data intact.
DROP TRIGGER IF EXISTS trg_s3_hrri_job_delete;
DROP TRIGGER IF EXISTS trg_s3_hrri_job_deactivate;
DROP TRIGGER IF EXISTS trg_s3_hrri_dept_delete;
DROP TRIGGER IF EXISTS trg_s3_hrri_dept_deactivate;
DROP TRIGGER IF EXISTS trg_s3_hrri_employee_delete;
DROP TRIGGER IF EXISTS trg_s3_hrri_employee_restore;
DROP TRIGGER IF EXISTS trg_s3_hrri_history_insert;
DROP TRIGGER IF EXISTS trg_s3_hrri_history_update;
DROP TRIGGER IF EXISTS trg_s3_hrri_employee_insert;
