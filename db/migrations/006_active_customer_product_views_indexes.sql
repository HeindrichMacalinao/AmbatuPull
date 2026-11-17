-- S2-DBA-01 (#100): SQLite schema for regenerated HopeERP.db / HOPE_Model1.db.
<<<<<<< HEAD
-- Keep in sync with migrations/006_active_customer_product_views_indexes.sql.
=======
-- Keep in sync with migrations/005_active_customer_product_views_indexes.sql.
>>>>>>> origin/main
CREATE VIEW IF NOT EXISTS v_active_customer AS
SELECT custNo, custName, address, payTerms, status, stamp
FROM CUSTOMER
WHERE status = 'Active';

CREATE VIEW IF NOT EXISTS v_active_product AS
SELECT prodCode, description, unit, status, stamp
FROM PRODUCT
WHERE status = 'Active';

CREATE INDEX IF NOT EXISTS idx_customer_status_custname
    ON CUSTOMER(status, custName);

CREATE INDEX IF NOT EXISTS idx_product_status_description
    ON PRODUCT(status, description);

CREATE INDEX IF NOT EXISTS idx_pricehist_prodcode_effdate_status
    ON PRICEHIST(prodCode, effDate, status);
