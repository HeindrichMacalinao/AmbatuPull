-- S3-DBA-01; Supabase/PostgreSQL >= 15 only. Validate on staging first.
-- Core schema uses quoted uppercase table names and mixed-case column names.
-- Security: invoker rights/RLS apply; no anon/authenticated SELECT privileges.
-- SELECT * includes sensitive EMPLOYEE and JOBHISTORY fields: do not grant
-- direct view access to public API roles without a role-specific projection.
BEGIN;

CREATE VIEW public.v_active_employees WITH (security_invoker = true) AS
SELECT * FROM public."EMPLOYEE" WHERE "status" = 'Active';
CREATE VIEW public.v_active_jobs WITH (security_invoker = true) AS
SELECT * FROM public."JOB" WHERE "status" = 'Active';
CREATE VIEW public.v_active_departments WITH (security_invoker = true) AS
SELECT * FROM public."DEPARTMENT" WHERE "status" = 'Active';
CREATE VIEW public.v_active_jobhistory WITH (security_invoker = true) AS
SELECT * FROM public."JOBHISTORY" WHERE "status" = 'Active';

-- Explicitly avoid granting PostgreSQL 'authenticated' role access.
-- App-level roles Superadmin/Admin/User are not PostgreSQL role mappings.
REVOKE ALL ON public.v_active_employees, public.v_active_jobs,
              public.v_active_departments, public.v_active_jobhistory
FROM PUBLIC, anon, authenticated;

CREATE INDEX idx_employee_status_lastname_firstname
ON public."EMPLOYEE" ("status", "lastName", "firstName");
CREATE INDEX idx_job_status_jobcode
ON public."JOB" ("status", "jobCode");
CREATE INDEX idx_department_status_deptcode
ON public."DEPARTMENT" ("status", "deptCode");
CREATE INDEX idx_jobhistory_empno_effdate_status
ON public."JOBHISTORY" ("empNo", "effDate", "status");

COMMIT;
