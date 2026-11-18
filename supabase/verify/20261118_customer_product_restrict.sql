-- S2-DBA-04 PostgreSQL/Supabase verification, for a privileged SQL session.
-- This dialect uses SALES.saleNo and SALESDETAIL.saleNo (SQLite uses transNo).
-- ALL fixtures and status changes are rolled back, including on success.
-- C-001 is a disposable fixture because the approved baseline uses C0001.
-- Requires the S2-DBA-04 migration before testing legacy-domain soft deletes.

BEGIN;

DO $verify$
DECLARE
    v_cust_fk text;
    v_detail_fk text;
    v_price_fk text;
BEGIN
    -- Confirm exact referenced columns and a restricting/no-action FK policy.
    SELECT c.confdeltype INTO v_cust_fk
      FROM pg_constraint c
      WHERE c.conrelid = 'public."SALES"'::regclass AND c.contype = 'f'
        AND c.confrelid = 'public."CUSTOMER"'::regclass
        AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute
                               WHERE attrelid = 'public."SALES"'::regclass
                                 AND attname = 'custNo')]::smallint[];
    SELECT c.confdeltype INTO v_detail_fk
      FROM pg_constraint c
      WHERE c.conrelid = 'public."SALESDETAIL"'::regclass AND c.contype = 'f'
        AND c.confrelid = 'public."PRODUCT"'::regclass
        AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute
                               WHERE attrelid = 'public."SALESDETAIL"'::regclass
                                 AND attname = 'prodCode')]::smallint[];
    SELECT c.confdeltype INTO v_price_fk
      FROM pg_constraint c
      WHERE c.conrelid = 'public."PRICEHIST"'::regclass AND c.contype = 'f'
        AND c.confrelid = 'public."PRODUCT"'::regclass
        AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute
                               WHERE attrelid = 'public."PRICEHIST"'::regclass
                                 AND attname = 'prodCode')]::smallint[];
    IF v_cust_fk NOT IN ('r', 'a') OR v_detail_fk NOT IN ('r', 'a')
       OR v_price_fk NOT IN ('r', 'a')
       OR v_cust_fk IS NULL OR v_detail_fk IS NULL OR v_price_fk IS NULL THEN
        RAISE EXCEPTION 'Expected RESTRICT or NO ACTION customer/product foreign keys';
    END IF;

    IF EXISTS (SELECT 1 FROM public."CUSTOMER" WHERE "custNo" = 'C-001')
       OR EXISTS (SELECT 1 FROM public."PRODUCT" WHERE "prodCode" IN ('P-S2-PH','P-S2-SD'))
       OR EXISTS (SELECT 1 FROM public."SALES" WHERE "saleNo" = 'S2V00001') THEN
        RAISE EXCEPTION 'Verification fixture identifiers already exist; aborting safely';
    END IF;

    INSERT INTO public."CUSTOMER" ("custNo", "custName", "payTerms", "status", "stamp")
    VALUES ('C-001', 'Verification Customer', 'COD', 'Active', 'CREATED s2-dba-04 test');
    INSERT INTO public."PRODUCT" ("prodCode", "description", "unit", "status", "stamp")
    VALUES ('P-S2-PH', 'Price-history FK verification', 'pcs', 'Active', 'CREATED s2-dba-04 test'),
           ('P-S2-SD', 'Sales-detail FK verification', 'pcs', 'Active', 'CREATED s2-dba-04 test');
    INSERT INTO public."PRICEHIST" ("prodCode", "effDate", "unitPrice", "status", "stamp")
    VALUES ('P-S2-PH', DATE '2026-11-18', 1.25, 'Active', 'CREATED s2-dba-04 test');
    INSERT INTO public."SALES" ("saleNo", "custNo", "saleDate", "status", "stamp")
    VALUES ('S2V00001', 'C-001', DATE '2026-11-18', 'Active', 'CREATED s2-dba-04 test');
    INSERT INTO public."SALESDETAIL"
      ("saleNo", "prodCode", "unitPrice", "quantity", "status", "stamp")
    VALUES ('S2V00001', 'P-S2-SD', 1.25, 1, 'Active', 'CREATED s2-dba-04 test');

    BEGIN
        DELETE FROM public."CUSTOMER" WHERE "custNo" = 'C-001';
        RAISE EXCEPTION 'CUSTOMER hard delete unexpectedly succeeded';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        DELETE FROM public."PRODUCT" WHERE "prodCode" = 'P-S2-PH';
        RAISE EXCEPTION 'PRICEHIST parent hard delete unexpectedly succeeded';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        DELETE FROM public."PRODUCT" WHERE "prodCode" = 'P-S2-SD';
        RAISE EXCEPTION 'SALESDETAIL parent hard delete unexpectedly succeeded';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    UPDATE public."CUSTOMER" SET "status" = 'Inactive', "stamp" = 'EDITED s2-dba-04 verify'
      WHERE "custNo" = 'C-001';
    UPDATE public."PRODUCT" SET "status" = 'Inactive', "stamp" = 'EDITED s2-dba-04 verify'
      WHERE "prodCode" IN ('P-S2-PH', 'P-S2-SD');

    IF (SELECT COUNT(*) FROM public."SALES" s JOIN public."CUSTOMER" c
            ON c."custNo" = s."custNo"
        WHERE c."custNo" = 'C-001' AND c."status" = 'Inactive') <> 1
       OR (SELECT COUNT(*) FROM public."SALESDETAIL" d
           JOIN public."SALES" s ON s."saleNo" = d."saleNo"
           JOIN public."PRODUCT" p ON p."prodCode" = d."prodCode"
           WHERE s."custNo" = 'C-001' AND p."prodCode" = 'P-S2-SD'
                 AND p."status" = 'Inactive') <> 1
       OR (SELECT COUNT(*) FROM public."PRICEHIST" h
           JOIN public."PRODUCT" p ON p."prodCode" = h."prodCode"
           WHERE p."prodCode" = 'P-S2-PH' AND p."status" = 'Inactive') <> 1 THEN
        RAISE EXCEPTION 'Historical sales/price links did not survive soft deletion';
    END IF;

    RAISE NOTICE 'PASS: all hard deletes restricted; soft deletion preserves sales, details and prices';
END
$verify$;

ROLLBACK;
