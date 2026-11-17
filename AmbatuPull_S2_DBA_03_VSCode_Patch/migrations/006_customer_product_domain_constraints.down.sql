-- S2-DBA-03 rollback: removes only the new trigger-based validation.
-- Keeps all rows, foreign keys, existing status checks and composite PKs.
DROP TRIGGER IF EXISTS trg_customer_domain_insert;
DROP TRIGGER IF EXISTS trg_customer_domain_update;
DROP TRIGGER IF EXISTS trg_product_domain_insert;
DROP TRIGGER IF EXISTS trg_product_domain_update;
DROP TRIGGER IF EXISTS trg_pricehist_domain_insert;
DROP TRIGGER IF EXISTS trg_pricehist_domain_update;
