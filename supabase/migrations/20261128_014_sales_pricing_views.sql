-- [S4-DBA-01] Sales Transaction Totals & Historical Line Pricing Views (PostgreSQL / Supabase)
BEGIN;

DROP VIEW IF EXISTS public.v_sales_summary;
DROP VIEW IF EXISTS public.v_saleline;

CREATE VIEW public.v_saleline
WITH (security_invoker = true) AS
SELECT
    sd."transNo",
    s."salesDate",
    sd."prodCode",
    sd."quantity",
    ph."unitPrice",
    CASE
        WHEN ph."unitPrice" IS NULL THEN NULL
        ELSE ROUND((sd."quantity"::numeric * ph."unitPrice"::numeric), 2)
    END AS "lineTotal",
    ph."effDate" AS "priceEffDate",
    (ph."unitPrice" IS NULL) AS "isMissingPrice",
    sd."status",
    sd."stamp"
FROM public."SALESDETAIL" sd
JOIN public."SALES" s
    ON sd."transNo" = s."transNo"
LEFT JOIN LATERAL (
    SELECT
        p."unitPrice",
        p."effDate"
    FROM public."PRICEHIST" p
    WHERE p."prodCode" = sd."prodCode"
      AND p."status" = 'Active'
      AND p."effDate" <= s."salesDate"
    ORDER BY p."effDate" DESC
    LIMIT 1
) ph ON true;

CREATE VIEW public.v_sales_summary
WITH (security_invoker = true) AS
SELECT
    s."transNo",
    s."salesDate",
    s."custNo",
    COUNT(l."prodCode")::integer AS "totalLines",
    COALESCE(SUM(CASE WHEN l."unitPrice" IS NULL THEN 1 ELSE 0 END), 0)::integer AS "missingPriceCount",
    (COALESCE(SUM(CASE WHEN l."unitPrice" IS NULL THEN 1 ELSE 0 END), 0) > 0) AS "hasMissingPrice",
    ROUND(COALESCE(SUM(l."lineTotal"), 0)::numeric, 2) AS "transactionTotal",
    s."status",
    s."stamp"
FROM public."SALES" s
LEFT JOIN public.v_saleline l
    ON s."transNo" = l."transNo"
   AND l."status" = 'Active'
WHERE s."status" = 'Active'
GROUP BY
    s."transNo",
    s."salesDate",
    s."custNo",
    s."status",
    s."stamp";

-- Least privilege: revoke default public/anon access; allow read-only SELECT for authenticated & service_role
REVOKE ALL ON public.v_saleline FROM PUBLIC, anon;
REVOKE ALL ON public.v_sales_summary FROM PUBLIC, anon;
GRANT SELECT ON public.v_saleline TO authenticated, service_role;
GRANT SELECT ON public.v_sales_summary TO authenticated, service_role;

COMMIT;
