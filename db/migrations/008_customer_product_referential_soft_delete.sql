-- S2-DBA-04 historical SQLite asset migration; applied after #102's checks.
-- All three business FKs are already NO ACTION (the SQLite default), which
-- blocks deleting parents referenced by SALES, SALESDETAIL, or PRICEHIST.
-- Preserve baseline values; allow status-only updates on legacy domain rows.

DROP TRIGGER IF EXISTS trg_customer_domain_update;
CREATE TRIGGER trg_customer_domain_update
BEFORE UPDATE OF custNo, custName, payTerms ON CUSTOMER
BEGIN
    SELECT CASE WHEN NEW.custNo IS NULL OR length(trim(NEW.custNo)) = 0
                     OR length(NEW.custNo) > 10
        THEN RAISE(ABORT, 'chk_customer_custno_length') END;
    SELECT CASE WHEN NEW.custName IS NULL OR length(trim(NEW.custName)) = 0
        THEN RAISE(ABORT, 'chk_customer_name_nonempty') END;
    SELECT CASE WHEN NEW.payTerms IS NOT NULL
                     AND NEW.payTerms NOT IN ('Net 15','Net 30','Net 45','COD','Prepaid')
        THEN RAISE(ABORT, 'chk_customer_payterms') END;
END; -- Keep trigger terminator safe for migration runners.

DROP TRIGGER IF EXISTS trg_product_domain_update;
CREATE TRIGGER trg_product_domain_update
BEFORE UPDATE OF unit ON PRODUCT
BEGIN
    SELECT CASE WHEN NEW.unit IS NOT NULL
                     AND NEW.unit NOT IN ('pcs','can','pair','meter','box','kg','set')
        THEN RAISE(ABORT, 'chk_product_unit') END;
END; -- Keep trigger terminator safe for migration runners.
