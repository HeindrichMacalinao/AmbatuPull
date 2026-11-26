-- S3-DBA-06: PostgreSQL/Supabase HR lookup indexes.
-- Run against a reviewed LOCAL/STAGING database first. No extension is enabled.
-- Existing primary keys and S3-DBA-01 indexes are retained.
BEGIN;

-- Child-side indexes for FK checks and S3-DBA-04 guard lookups. PostgreSQL does
-- not automatically index referencing columns. EMPLOYEE has both columns;
-- JOBHISTORY has jobCode but the committed PG schema has no deptCode.
CREATE INDEX idx_employee_deptcode
ON public."EMPLOYEE" ("deptCode");

CREATE INDEX idx_employee_jobcode
ON public."EMPLOYEE" ("jobCode");

CREATE INDEX idx_jobhistory_jobcode
ON public."JOBHISTORY" ("jobCode");

-- Covers the S3-DBA-02 active as-of lookup. PostgreSQL may perform an
-- index-only scan when visibility-map coverage permits; otherwise heap fetches
-- remain normal. The partial predicate matches the helper's status filter.
CREATE INDEX idx_jobhistory_active_empno_effdate_cover
ON public."JOBHISTORY" ("empNo", "effDate" DESC, "jobCode")
INCLUDE ("salary")
WHERE "status" = 'Active';

COMMIT;
