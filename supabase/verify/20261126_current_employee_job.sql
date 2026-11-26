-- Staging-only verification: set sample IDs/dates outside the report.
-- Execute from privileged, authorized testing role. Do not log salary rows.
-- Confirm invoker security and absence of browser roles' EXECUTE grants.
SELECT p.proname, p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'erp_employee_positions_as_of';

SELECT has_function_privilege('anon', 'public.erp_employee_positions_as_of(date,text)', 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', 'public.erp_employee_positions_as_of(date,text)', 'EXECUTE') AS authenticated_can_execute;

-- Example only; output includes sensitive salary. Use staging synthetic IDs:
-- SELECT * FROM public.erp_employee_positions_as_of(date '2026-10-15', 'TEST-001');
-- SELECT count(*) FROM public.erp_employee_positions_as_of(date '2026-10-15');
