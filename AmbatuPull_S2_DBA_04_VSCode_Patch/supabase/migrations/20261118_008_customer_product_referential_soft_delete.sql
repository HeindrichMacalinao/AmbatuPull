-- S2-DBA-04: PostgreSQL/Supabase existing FKs are already ON DELETE RESTRICT:
-- SALES.custNo, SALESDETAIL.prodCode, and PRICEHIST.prodCode.
-- No FK replacement or destructive table rebuild is necessary.
--
-- S2-DBA-03's NOT VALID checks reject *every* UPDATE of an old row whose
-- payTerms/unit is still noncompliant, including status='Inactive'. Replace
-- only those two domain checks with equivalent INSERT and column-change
-- triggers. New invalid values still fail with check_violation (23514).
-- The other CHECK constraints, status checks, and FKs remain untouched.

BEGIN;

ALTER TABLE public."CUSTOMER" DROP CONSTRAINT IF EXISTS chk_customer_payterms;
ALTER TABLE public."PRODUCT" DROP CONSTRAINT IF EXISTS chk_product_unit;

CREATE OR REPLACE FUNCTION public.check_customer_payterms_s2dba04()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $validate$
BEGIN
    IF NEW."payTerms" IS NOT NULL AND NEW."payTerms" NOT IN
       ('Net 15', 'Net 30', 'Net 45', 'COD', 'Prepaid') THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            CONSTRAINT = 'chk_customer_payterms',
            MESSAGE = 'CUSTOMER.payTerms must use an approved payment term';
    END IF;
    RETURN NEW;
END
$validate$;

CREATE OR REPLACE FUNCTION public.check_product_unit_s2dba04()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $validate$
BEGIN
    IF NEW."unit" IS NOT NULL AND NEW."unit" NOT IN
       ('pcs', 'can', 'pair', 'meter', 'box', 'kg', 'set') THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            CONSTRAINT = 'chk_product_unit',
            MESSAGE = 'PRODUCT.unit must use an approved unit';
    END IF;
    RETURN NEW;
END
$validate$;

DROP TRIGGER IF EXISTS trg_customer_payterms_insert_s2dba04 ON public."CUSTOMER";
DROP TRIGGER IF EXISTS trg_customer_payterms_update_s2dba04 ON public."CUSTOMER";
CREATE TRIGGER trg_customer_payterms_insert_s2dba04
BEFORE INSERT ON public."CUSTOMER"
FOR EACH ROW EXECUTE FUNCTION public.check_customer_payterms_s2dba04();
CREATE TRIGGER trg_customer_payterms_update_s2dba04
BEFORE UPDATE OF "payTerms" ON public."CUSTOMER"
FOR EACH ROW EXECUTE FUNCTION public.check_customer_payterms_s2dba04();

DROP TRIGGER IF EXISTS trg_product_unit_insert_s2dba04 ON public."PRODUCT";
DROP TRIGGER IF EXISTS trg_product_unit_update_s2dba04 ON public."PRODUCT";
CREATE TRIGGER trg_product_unit_insert_s2dba04
BEFORE INSERT ON public."PRODUCT"
FOR EACH ROW EXECUTE FUNCTION public.check_product_unit_s2dba04();
CREATE TRIGGER trg_product_unit_update_s2dba04
BEFORE UPDATE OF "unit" ON public."PRODUCT"
FOR EACH ROW EXECUTE FUNCTION public.check_product_unit_s2dba04();

COMMIT;
