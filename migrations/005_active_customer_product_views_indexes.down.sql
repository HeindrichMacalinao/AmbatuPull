-- Roll back S2-DBA-01. Preserve the underlying customer/product/price records.
DROP VIEW IF EXISTS v_active_customer;
DROP VIEW IF EXISTS v_active_product;

DROP INDEX IF EXISTS idx_customer_status_custname;
DROP INDEX IF EXISTS idx_product_status_description;
DROP INDEX IF EXISTS idx_pricehist_prodcode_effdate_status;
