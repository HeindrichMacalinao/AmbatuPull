-- S3-DBA-03: PostgreSQL/Supabase HR domain checks.
-- This repository's committed PostgreSQL schema uses EMPLOYEE."dateHired" and
-- "dateSeparated" (not SQLite's hireDate/sepDate) and has NO gender or birthDate.
-- Do NOT invent those columns. The migration enforces every rule supported by
-- actual columns, and emits explicit NOTICEs about absent attributes.
-- PostgreSQL dates are DATE-typed; no SQLite-style text parsing needed.
-- Existing JOBHISTORY.salary >= 0 CHECK and effDate NOT NULL are retained;
-- no redundant salary constraint or effDate schema change is created.
-- Deploy only to a reviewed STAGING copy; check actual schema before deployment.
BEGIN;
DO $s3_hr$
DECLARE
    has_gender boolean;
    has_birth boolean;
    has_hire boolean;
    has_sep boolean;
BEGIN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='EMPLOYEE' AND column_name='gender')
        INTO has_gender;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='EMPLOYEE' AND column_name='birthDate')
        INTO has_birth;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='EMPLOYEE' AND column_name='dateHired')
        INTO has_hire;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='EMPLOYEE' AND column_name='dateSeparated')
        INTO has_sep;
    IF NOT (has_hire AND has_sep) THEN
        RAISE EXCEPTION 'S3-DBA-03 expected public."EMPLOYEE"."dateHired" and "dateSeparated"; inspect live schema before migration';
    END IF;
    IF has_gender THEN
        ALTER TABLE public."EMPLOYEE" ADD CONSTRAINT chk_employee_gender_s3
            CHECK ("gender" IS NULL OR "gender" IN ('M','F','O')) NOT VALID;
    ELSE
        RAISE WARNING 'S3-DBA-03 UNENFORCED: PostgreSQL EMPLOYEE.gender does not exist; schema decision required';
    END IF;
    IF has_birth THEN
        ALTER TABLE public."EMPLOYEE" ADD CONSTRAINT chk_employee_birthdate_s3
            CHECK ("birthDate" IS NULL OR "birthDate" < "dateHired") NOT VALID;
    ELSE
        RAISE WARNING 'S3-DBA-03 UNENFORCED: PostgreSQL EMPLOYEE.birthDate does not exist; schema decision required';
    END IF;
END
$s3_hr$;
-- dateSeparated is nullable and dateHired NOT NULL in committed PG schema.
ALTER TABLE public."EMPLOYEE" ADD CONSTRAINT chk_employee_sepdate_s3
  CHECK ("dateSeparated" IS NULL OR "dateSeparated" >= "dateHired") NOT VALID;
-- Validate all present constraints: if old rows are invalid, the transaction
-- fails without rewriting data or leaving partially installed constraints.
ALTER TABLE public."EMPLOYEE" VALIDATE CONSTRAINT chk_employee_sepdate_s3;
DO $s3_validate$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public."EMPLOYEE"'::regclass
               AND conname='chk_employee_gender_s3') THEN
        ALTER TABLE public."EMPLOYEE" VALIDATE CONSTRAINT chk_employee_gender_s3;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public."EMPLOYEE"'::regclass
               AND conname='chk_employee_birthdate_s3') THEN
        ALTER TABLE public."EMPLOYEE" VALIDATE CONSTRAINT chk_employee_birthdate_s3;
    END IF;
END
$s3_validate$;
-- JOBHISTORY.salary nonnegative and effDate NOT NULL are existing baseline
-- constraints. Preserved unchanged (no redundant CHECK added).
COMMIT;
