-- S2-DBA-04: SQLite relationships already use ON DELETE RESTRICT or NO ACTION.
-- Do not rebuild tables or change foreign keys. The S2-DBA-03 UPDATE triggers
-- also validated legacy payment terms/units when only status changed, making
-- safe soft deletion impossible for historical ('30D', 'ea', etc.) rows.
-- Restrict domain validation to writes of the domain columns themselves.
-- INSERT triggers, existing status CHECKs, and the FK restrictions stay intact.
-- Note: END; must share a line with a comment because the project migration
-- runner removes standalone END; lines when processing transaction wrappers.

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
END; -- Preserve SQLite trigger terminator in the migration runner.

DROP TRIGGER IF EXISTS trg_product_domain_update;
CREATE TRIGGER trg_product_domain_update
BEFORE UPDATE OF unit ON PRODUCT
BEGIN
    SELECT CASE WHEN NEW.unit IS NOT NULL
                     AND NEW.unit NOT IN ('pcs','can','pair','meter','box','kg','set')
        THEN RAISE(ABORT, 'chk_product_unit') END;
END; -- Preserve SQLite trigger terminator in the migration runner.
