-- Rollback [S4-DBA-01] Sales Pricing Views (PostgreSQL / Supabase)
BEGIN;

DROP VIEW IF EXISTS public.v_sales_summary;
DROP VIEW IF EXISTS public.v_saleline;

COMMIT;
