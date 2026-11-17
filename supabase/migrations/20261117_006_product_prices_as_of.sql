-- S2-DBA-02 (#101): parameterized effective-date price lookup for PostgreSQL.
-- Product rows with no eligible Active price return NULL. Caller supplies DATE;
-- no implicit CURRENT_DATE and no hardcoded business date are used.
CREATE OR REPLACE FUNCTION public.product_prices_as_of(p_target_date DATE)
RETURNS TABLE (
    "prodCode" VARCHAR(10),
    "description" VARCHAR(100),
    "unit" VARCHAR(20),
    "status" VARCHAR(8),
    "stamp" VARCHAR(80),
    "currentPrice" DECIMAL(10,2)
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT p."prodCode", p."description", p."unit", p."status", p."stamp",
           (SELECT ph."unitPrice"
            FROM public."PRICEHIST" AS ph
            WHERE ph."prodCode" = p."prodCode"
              AND ph."effDate" <= p_target_date
              AND ph."status" = 'Active'
            ORDER BY ph."effDate" DESC
            LIMIT 1) AS "currentPrice"
    FROM public."PRODUCT" AS p
    ORDER BY p."prodCode";
$$;

-- This all-product query can include inactive products; restrict invocation to
-- the trusted server role until an authenticated product-listing API exists.
REVOKE ALL ON FUNCTION public.product_prices_as_of(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_prices_as_of(DATE) TO service_role;

-- Expose the new RPC to PostgREST without requiring a server restart.
NOTIFY pgrst, 'reload schema';
