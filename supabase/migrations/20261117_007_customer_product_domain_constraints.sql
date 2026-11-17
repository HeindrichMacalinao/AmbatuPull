-- S2-DBA-03 (#102): safe, staged PostgreSQL domain checks.
-- IMPORTANT: Historical CUSTOMER payTerms '30D'/'45D' and PRODUCT units 'ea'/'pc'
-- violate the new business lists. Existing 'License', 'Service', and 'User/Mo'
-- units are explicitly retained as valid values. NOT VALID preserves legacy rows while
-- enforcing each new INSERT and UPDATE; it does NOT mean old data is compliant.
-- Audit and obtain approval for historical mappings before running VALIDATE.
-- Nullable payTerms and unit remain nullable as in the existing S1 schema.
-- Existing statuses and PRICEHIST(prodCode, effDate) PK already enforce their
-- respective allowed values and uniqueness; no disruptive rebuild is needed.
-- custNo uses length <= 10 (not C- prefix) to preserve existing FK identifiers.

DO $domain$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'public."CUSTOMER"'::regclass
                     AND conname = 'chk_customer_custno_length') THEN
        ALTER TABLE public."CUSTOMER"
            ADD CONSTRAINT chk_customer_custno_length
            CHECK (char_length("custNo") BETWEEN 1 AND 10 AND btrim("custNo") <> '') NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'public."CUSTOMER"'::regclass
                     AND conname = 'chk_customer_name_nonempty') THEN
        ALTER TABLE public."CUSTOMER"
            ADD CONSTRAINT chk_customer_name_nonempty
            CHECK (char_length(btrim("custName")) > 0) NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'public."CUSTOMER"'::regclass
                     AND conname = 'chk_customer_payterms') THEN
        ALTER TABLE public."CUSTOMER"
            ADD CONSTRAINT chk_customer_payterms
            CHECK ("payTerms" IS NULL OR "payTerms" IN ('Net 15','Net 30','Net 45','COD','Prepaid')) NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'public."PRODUCT"'::regclass
                     AND conname = 'chk_product_unit') THEN
        ALTER TABLE public."PRODUCT"
            ADD CONSTRAINT chk_product_unit
            CHECK ("unit" IS NULL OR "unit" IN (
                'pcs','can','pair','meter','box','kg','set',
                'License','Service','User/Mo'
            )) NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'public."PRICEHIST"'::regclass
                     AND conname = 'chk_pricehist_unitprice_positive') THEN
        ALTER TABLE public."PRICEHIST"
            ADD CONSTRAINT chk_pricehist_unitprice_positive
            CHECK ("unitPrice" > 0) NOT VALID;
    END IF;
END
$domain$;

-- After approved cleanup, independently VALIDATE these constraints in a later
-- migration. Never automatically rewrite historical customers/products here.
NOTIFY pgrst, 'reload schema';
