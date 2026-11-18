-- Restore S2-DBA-03's original UPDATE-trigger semantics on rollback.
-- This also restores the legacy-data soft-delete limitation; use with care.
DROP TRIGGER IF EXISTS trg_customer_domain_update;
CREATE TRIGGER trg_customer_domain_update
BEFORE UPDATE ON CUSTOMER
BEGIN
    SELECT CASE WHEN NEW.custNo IS NULL OR length(trim(NEW.custNo)) = 0
                     OR length(NEW.custNo) > 10
        THEN RAISE(ABORT, 'chk_customer_custno_length') END;
    SELECT CASE WHEN NEW.custName IS NULL OR length(trim(NEW.custName)) = 0
        THEN RAISE(ABORT, 'chk_customer_name_nonempty') END;
    SELECT CASE WHEN NEW.payTerms IS NOT NULL
                     AND NEW.payTerms NOT IN ('Net 15','Net 30','Net 45','COD','Prepaid')
        THEN RAISE(ABORT, 'chk_customer_payterms') END;
END; -- Preserve SQLite trigger terminator in the migration runner.

DROP TRIGGER IF EXISTS trg_product_domain_update;
CREATE TRIGGER trg_product_domain_update
BEFORE UPDATE ON PRODUCT
BEGIN
    SELECT CASE WHEN NEW.unit IS NOT NULL
                     AND NEW.unit NOT IN ('pcs','can','pair','meter','box','kg','set')
        THEN RAISE(ABORT, 'chk_product_unit') END;
END; -- Preserve SQLite trigger terminator in the migration runner.
