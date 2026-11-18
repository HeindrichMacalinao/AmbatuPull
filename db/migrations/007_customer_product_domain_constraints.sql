-- S2-DBA-03 (#102): trigger-based SQLite domain rules for regenerated DBs.
-- Must stay equivalent to migrations/007_customer_product_domain_constraints.sql.
-- Install AFTER importing historical data; otherwise approved legacy rows would
-- be blocked. Legacy data remains unchanged pending an approved cleanup plan.

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
END; -- Keep terminator on same line as comment for the project's migration runner.

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
END; -- Keep terminator on same line as comment for the project's migration runner.

CREATE TRIGGER IF NOT EXISTS trg_product_domain_insert
BEFORE INSERT ON PRODUCT
BEGIN
    SELECT CASE WHEN NEW.unit IS NOT NULL
                     AND NEW.unit NOT IN (
                         'pcs','can','pair','meter','box','kg','set',
                         'License','Service','User/Mo'
                     )
        THEN RAISE(ABORT, 'chk_product_unit') END;
END; -- Keep terminator on same line as comment for the project's migration runner.

CREATE TRIGGER IF NOT EXISTS trg_product_domain_update
BEFORE UPDATE ON PRODUCT
BEGIN
    SELECT CASE WHEN NEW.unit IS NOT NULL
                     AND NEW.unit NOT IN (
                         'pcs','can','pair','meter','box','kg','set',
                         'License','Service','User/Mo'
                     )
        THEN RAISE(ABORT, 'chk_product_unit') END;
END; -- Keep terminator on same line as comment for the project's migration runner.

CREATE TRIGGER IF NOT EXISTS trg_pricehist_domain_insert
BEFORE INSERT ON PRICEHIST
BEGIN
    SELECT CASE WHEN NEW.unitPrice IS NULL OR typeof(NEW.unitPrice) NOT IN ('integer','real')
                     OR NEW.unitPrice <= 0
        THEN RAISE(ABORT, 'chk_pricehist_unitprice_positive') END;
END; -- Keep terminator on same line as comment for the project's migration runner.

CREATE TRIGGER IF NOT EXISTS trg_pricehist_domain_update
BEFORE UPDATE ON PRICEHIST
BEGIN
    SELECT CASE WHEN NEW.unitPrice IS NULL OR typeof(NEW.unitPrice) NOT IN ('integer','real')
                     OR NEW.unitPrice <= 0
        THEN RAISE(ABORT, 'chk_pricehist_unitprice_positive') END;
END; -- Keep terminator on same line as comment for the project's migration runner.
