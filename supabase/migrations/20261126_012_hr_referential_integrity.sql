-- S3-DBA-04: PostgreSQL/Supabase HR parent/child protections.
-- Committed PG schema has JOBHISTORY.jobCode but NO JOBHISTORY.deptCode;
-- SALES also has NO empNo column. Do not invent either relationship.
-- Parent and child row-locking checks serialize concurrent status changes and
-- new active job-history writes. All existing RESTRICT FKs remain unchanged.
-- SECURITY DEFINER is needed so RLS cannot hide child rows from invariant checks.
-- DBA should own these functions with tightly scoped privileges; fixed search_path
-- and schema-qualified names avoid object shadowing. No public data grants added.
BEGIN;

DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM public."JOBHISTORY" h
             LEFT JOIN public."JOB" j ON j."jobCode"=h."jobCode"
             LEFT JOIN public."EMPLOYEE" e ON e."empNo"=h."empNo"
             WHERE j."jobCode" IS NULL OR e."empNo" IS NULL
                OR (h."status"='Active' AND j."status" <> 'Active'))
      OR EXISTS (SELECT 1 FROM public."EMPLOYEE" e
             LEFT JOIN public."JOB" j ON j."jobCode"=e."jobCode"
             LEFT JOIN public."DEPARTMENT" d ON d."deptCode"=e."deptCode"
             WHERE j."jobCode" IS NULL OR d."deptCode" IS NULL
                OR (e."status"='Active' AND (j."status"<>'Active' OR d."status"<>'Active')))
  THEN
    RAISE EXCEPTION 'S3-DBA-04 preflight failed: orphaned or inactive HR parent references; review data before deploying';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='JOBHISTORY' AND column_name='deptCode') THEN
    RAISE WARNING 'S3-DBA-04: no JOBHISTORY.deptCode; historical department validation unavailable. Current EMPLOYEE.deptCode is protected.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='SALES' AND column_name='empNo') THEN
    RAISE WARNING 'S3-DBA-04: no SALES.empNo; no sales-to-employee dependency exists to validate in committed PostgreSQL schema.';
  END IF;
END
$preflight$;

CREATE FUNCTION public.s3_hrri_guard_job() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $guard$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public."JOBHISTORY" WHERE "jobCode"=OLD."jobCode") THEN
      RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='S3-DBA-04: JOB has job history; hard delete denied';
    END IF;
    IF EXISTS (SELECT 1 FROM public."EMPLOYEE" WHERE "jobCode"=OLD."jobCode") THEN
      RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='S3-DBA-04: JOB is assigned to employee; hard delete denied';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."status"='Active' AND NEW."status"='Inactive' THEN
    IF EXISTS (SELECT 1 FROM public."JOBHISTORY" WHERE "jobCode"=OLD."jobCode" AND "status"='Active') THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='S3-DBA-04: JOB has active job history; soft delete denied';
    END IF;
    IF EXISTS (SELECT 1 FROM public."EMPLOYEE" WHERE "jobCode"=OLD."jobCode" AND "status"='Active') THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='S3-DBA-04: JOB is assigned to active employee';
    END IF;
  END IF;
  RETURN NEW;
END
$guard$;

CREATE FUNCTION public.s3_hrri_guard_department() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $guard$
BEGIN
  IF TG_OP='DELETE' THEN
    -- Historical deptCode is absent from PostgreSQL JOBHISTORY.
    IF EXISTS (SELECT 1 FROM public."EMPLOYEE" WHERE "deptCode"=OLD."deptCode") THEN
      RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='S3-DBA-04: DEPARTMENT is assigned to employee; hard delete denied';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."status"='Active' AND NEW."status"='Inactive' THEN
    IF EXISTS (SELECT 1 FROM public."EMPLOYEE" WHERE "deptCode"=OLD."deptCode" AND "status"='Active') THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='S3-DBA-04: DEPARTMENT is assigned to active employee';
    END IF;
  END IF;
  RETURN NEW;
END
$guard$;

CREATE FUNCTION public.s3_hrri_guard_employee() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $guard$
DECLARE linked_sales boolean;
BEGIN
  IF TG_OP='DELETE' THEN
    IF EXISTS (SELECT 1 FROM public."JOBHISTORY" WHERE "empNo"=OLD."empNo") THEN
      RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='S3-DBA-04: EMPLOYEE has job history; hard delete denied';
    END IF;
    -- Only run this test if a later approved schema adds SALES.empNo.
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='SALES' AND column_name='empNo') THEN
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM public."SALES" WHERE "empNo"=$1)'
         INTO linked_sales USING OLD."empNo";
      IF linked_sales THEN
        RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='S3-DBA-04: EMPLOYEE has sales; hard delete denied';
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  -- Also protect changed assignments on already-Active employees.
  IF NEW."status"='Active' THEN
    PERFORM 1 FROM public."JOB" WHERE "jobCode"=NEW."jobCode" AND "status"='Active' FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='S3-DBA-04: employee job must exist and be Active';
    END IF;
    PERFORM 1 FROM public."DEPARTMENT" WHERE "deptCode"=NEW."deptCode" AND "status"='Active' FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='S3-DBA-04: employee department must exist and be Active';
    END IF;
  END IF;
  RETURN NEW;
END
$guard$;

CREATE FUNCTION public.s3_hrri_guard_jobhistory() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $guard$
BEGIN
  IF NEW."status"='Active' THEN
    PERFORM 1 FROM public."JOB" WHERE "jobCode"=NEW."jobCode" AND "status"='Active' FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='S3-DBA-04: active history requires Active JOB';
    END IF;
  END IF;
  RETURN NEW;
END
$guard$;

-- In Supabase, direct EXECUTE on trigger functions is unnecessary for API roles.
REVOKE ALL ON FUNCTION public.s3_hrri_guard_job() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.s3_hrri_guard_department() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.s3_hrri_guard_employee() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.s3_hrri_guard_jobhistory() FROM PUBLIC;

CREATE TRIGGER trg_s3_hrri_job_delete BEFORE DELETE ON public."JOB"
FOR EACH ROW EXECUTE FUNCTION public.s3_hrri_guard_job();
CREATE TRIGGER trg_s3_hrri_job_deactivate BEFORE UPDATE OF "status" ON public."JOB"
FOR EACH ROW EXECUTE FUNCTION public.s3_hrri_guard_job();
CREATE TRIGGER trg_s3_hrri_dept_delete BEFORE DELETE ON public."DEPARTMENT"
FOR EACH ROW EXECUTE FUNCTION public.s3_hrri_guard_department();
CREATE TRIGGER trg_s3_hrri_dept_deactivate BEFORE UPDATE OF "status" ON public."DEPARTMENT"
FOR EACH ROW EXECUTE FUNCTION public.s3_hrri_guard_department();
CREATE TRIGGER trg_s3_hrri_employee_delete BEFORE DELETE ON public."EMPLOYEE"
FOR EACH ROW EXECUTE FUNCTION public.s3_hrri_guard_employee();
CREATE TRIGGER trg_s3_hrri_employee_restore BEFORE UPDATE OF "status", "jobCode", "deptCode" ON public."EMPLOYEE"
FOR EACH ROW EXECUTE FUNCTION public.s3_hrri_guard_employee();
CREATE TRIGGER trg_s3_hrri_employee_insert BEFORE INSERT ON public."EMPLOYEE"
FOR EACH ROW EXECUTE FUNCTION public.s3_hrri_guard_employee();
CREATE TRIGGER trg_s3_hrri_history_insert BEFORE INSERT ON public."JOBHISTORY"
FOR EACH ROW EXECUTE FUNCTION public.s3_hrri_guard_jobhistory();
CREATE TRIGGER trg_s3_hrri_history_update BEFORE UPDATE OF "status", "jobCode" ON public."JOBHISTORY"
FOR EACH ROW EXECUTE FUNCTION public.s3_hrri_guard_jobhistory();
COMMIT;
