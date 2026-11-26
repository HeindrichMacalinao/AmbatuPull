-- S3-DBA-02: parameterized, read-only as-of HR assignment helper for
-- PostgreSQL 15+/Supabase schema as inspected (JOBHISTORY has NO deptCode).
-- Historical department cannot be inferred safely; return NULL for it.
-- Do not grant this salary-returning function to browser-accessible roles.
BEGIN;

CREATE FUNCTION public.erp_employee_positions_as_of(
  p_as_of_date date, p_emp_no text DEFAULT NULL
)
RETURNS TABLE (
  "empNo" text, "jobCode" text, "jobDesc" text,
  "deptCode" text, "deptName" text, "salary" numeric, "effDate" date
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF p_as_of_date IS NULL THEN
    RAISE EXCEPTION 'p_as_of_date is required';
  END IF;
  IF p_emp_no IS NOT NULL AND (length(p_emp_no) = 0 OR length(p_emp_no) > 10) THEN
    RAISE EXCEPTION 'invalid p_emp_no';
  END IF;
  -- PostgreSQL seed schema has PK(empNo, effDate). If it is replaced with
  -- another schema permitting same-date ties, refuse an ambiguous result.
  IF EXISTS (
    WITH latest AS (
      SELECT jh."empNo", max(jh."effDate") AS max_date
      FROM public."JOBHISTORY" jh
      JOIN public."EMPLOYEE" e ON e."empNo" = jh."empNo"
      WHERE jh."status" = 'Active' AND jh."effDate" <= p_as_of_date
        AND e."status" = 'Active'
        AND (p_emp_no IS NULL OR e."empNo" = p_emp_no)
      GROUP BY jh."empNo"
    )
    SELECT 1 FROM latest l
    JOIN public."JOBHISTORY" jh
      ON jh."empNo" = l."empNo" AND jh."effDate" = l.max_date
      AND jh."status" = 'Active'
    GROUP BY l."empNo" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Ambiguous latest JOBHISTORY assignment; define a tie-breaker';
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT jh."empNo", jh."jobCode", jh."salary", jh."effDate",
           ROW_NUMBER() OVER (
             PARTITION BY jh."empNo"
             ORDER BY jh."effDate" DESC, jh."jobCode"
           ) AS rn
    FROM public."JOBHISTORY" jh
    WHERE jh."status" = 'Active' AND jh."effDate" <= p_as_of_date
  )
  SELECT e."empNo"::text, r."jobCode"::text, j."jobDesc"::text,
         NULL::text AS "deptCode", NULL::text AS "deptName",
         r."salary"::numeric, r."effDate"::date
  FROM public."EMPLOYEE" e
  LEFT JOIN ranked r ON r."empNo" = e."empNo" AND r.rn = 1
  LEFT JOIN public."JOB" j ON j."jobCode" = r."jobCode"
  WHERE e."status" = 'Active' AND (p_emp_no IS NULL OR e."empNo" = p_emp_no)
  ORDER BY e."empNo";
END;
$function$;

REVOKE ALL ON FUNCTION public.erp_employee_positions_as_of(date, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_employee_positions_as_of(date, text)
  TO service_role;
COMMIT;
