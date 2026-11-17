-- S2-DBA-03 (#102): SQLite data-domain enforcement without rebuilding FK tables.
-- Legacy historical payTerms ('30D'/'45D') and units ('ea'/'pc') are outside the
-- new allowed lists. Preserve them untouched; triggers validate every NEW row
-- and every UPDATE. Run scripts/check_domain_constraint_readiness.py and obtain
-- approved cleanup mappings before treating all pre-existing rows as compliant.
-- custNo uses the issue's length <= 10 alternative: existing C0001 identifiers
-- and CUST-001 seed identifiers cannot be migrated to 'C-' without FK rewrites.
-- Nullable payTerms/unit remain nullable to preserve their S1 schema contract.
-- status checks and PRICEHIST(prodCode,effDate) PK already exist in S1-DBA-02.

CREATE TRIGGER IF NOT EXISTS trg_customer_domain_insert
BEFORE INSERT ON CUSTOMER
BEGIN
    SELECT CASE WHEN NEW.custNo IS NULL OR length(trim(NEW.custNo)) = 0
                     OR length(NEW.custNo) > 10
        THEN RAISE(ABORT, 'chk_customer_custno_length') END;
    SELECT CASE WHEN NEW.custName IS NULL OR length(trim(NEW.custName)) = 0
        THEN RAISE(ABORT, 'chk_customer_name_nonempty') END;
    SELECT CASE WHEN NEW.payTerms IS NOT NULL
                     AND NEW.payTerms NOT IN ('Net 15','Net 30','Net 45','COD','Prepaid')
        THEN RAISE(ABORT, 'chk_customer_payterms') END;
END; -- Keep the terminator inline: the migration runner strips standalone END; lines.

CREATE TRIGGER IF NOT EXISTS trg_customer_domain_update
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
END; -- Keep the terminator inline: the migration runner strips standalone END; lines.

CREATE TRIGGER IF NOT EXISTS trg_product_domain_insert
BEFORE INSERT ON PRODUCT
BEGIN
    SELECT CASE WHEN NEW.unit IS NOT NULL
                     AND NEW.unit NOT IN ('pcs','can','pair','meter','box','kg','set')
        THEN RAISE(ABORT, 'chk_product_unit') END;
END; -- Keep the terminator inline: the migration runner strips standalone END; lines.

CREATE TRIGGER IF NOT EXISTS trg_product_domain_update
BEFORE UPDATE ON PRODUCT
BEGIN
    SELECT CASE WHEN NEW.unit IS NOT NULL
                     AND NEW.unit NOT IN ('pcs','can','pair','meter','box','kg','set')
        THEN RAISE(ABORT, 'chk_product_unit') END;
END; -- Keep the terminator inline: the migration runner strips standalone END; lines.

CREATE TRIGGER IF NOT EXISTS trg_pricehist_domain_insert
BEFORE INSERT ON PRICEHIST
BEGIN
    SELECT CASE WHEN NEW.unitPrice IS NULL OR typeof(NEW.unitPrice) NOT IN ('integer','real')
                     OR NEW.unitPrice <= 0
        THEN RAISE(ABORT, 'chk_pricehist_unitprice_positive') END;
END; -- Keep the terminator inline: the migration runner strips standalone END; lines.

CREATE TRIGGER IF NOT EXISTS trg_pricehist_domain_update
BEFORE UPDATE ON PRICEHIST
BEGIN
    SELECT CASE WHEN NEW.unitPrice IS NULL OR typeof(NEW.unitPrice) NOT IN ('integer','real')
                     OR NEW.unitPrice <= 0
        THEN RAISE(ABORT, 'chk_pricehist_unitprice_positive') END;
END; -- Keep the terminator inline: the migration runner strips standalone END; lines.
