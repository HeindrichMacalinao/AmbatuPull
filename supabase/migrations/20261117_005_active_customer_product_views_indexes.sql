-- S2-DBA-01 (#100): PostgreSQL / Supabase equivalent of SQLite migration 006.
-- PostgreSQL 15+ is required for security_invoker views.
CREATE OR REPLACE VIEW public.v_active_customer
WITH (security_invoker = true) AS
SELECT "custNo", "custName", "address", "payTerms", "status", "stamp"
FROM public."CUSTOMER"
WHERE "status" = 'Active';

CREATE OR REPLACE VIEW public.v_active_product
WITH (security_invoker = true) AS
SELECT "prodCode", "description", "unit", "status", "stamp"
FROM public."PRODUCT"
WHERE "status" = 'Active';

CREATE INDEX IF NOT EXISTS idx_customer_status_custname
    ON public."CUSTOMER" ("status", "custName");

CREATE INDEX IF NOT EXISTS idx_product_status_description
    ON public."PRODUCT" ("status", "description");

CREATE INDEX IF NOT EXISTS idx_pricehist_prodcode_effdate_status
    ON public."PRICEHIST" ("prodCode", "effDate", "status");
