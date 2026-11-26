-- Only drop the S3-DBA-02 function, never any HR data.
BEGIN;
DROP FUNCTION public.erp_employee_positions_as_of(date, text);
COMMIT;
