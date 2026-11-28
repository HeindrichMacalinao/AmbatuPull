-- Rollback [S4-DBA-01] Sales Pricing Views (SQLite)
BEGIN;

DROP VIEW IF EXISTS v_sales_summary;
DROP VIEW IF EXISTS v_saleline;

COMMIT;
