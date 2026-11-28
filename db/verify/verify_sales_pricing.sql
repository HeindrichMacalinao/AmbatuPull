-- Verification Script for [S4-DBA-01]
-- Tests: before/on/after price change, future & inactive prices ignored,
-- missing price flagging, inactive line exclusion, multi-line & zero-line sales.
-- Leaves zero test data behind via ROLLBACK.

PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

-- 1. Confirm SALES has no stored total column
SELECT COUNT(*) AS stored_total_columns
FROM pragma_table_info('SALES')
WHERE LOWER(name) LIKE '%total%';
-- Expected: 0

-- 2. Confirm views exist
SELECT name
FROM sqlite_master
WHERE type = 'view'
  AND name IN ('v_saleline', 'v_sales_summary')
ORDER BY name;
-- Expected: v_saleline, v_sales_summary

-- 3. Insert isolated test fixtures (using valid domain values from S2-DBA-03)
INSERT INTO CUSTOMER (custNo, custName, address, payTerms, status, stamp)
VALUES ('C-T99', 'Verify Pricing Corp', 'Test Addr', 'Net 30', 'Active', 'CREATED verify 2026-11-28');

INSERT INTO EMPLOYEE (empNo, lastName, firstName, gender, birthDate, hireDate, sepDate, status, stamp)
VALUES ('E-T99', 'Tester', 'Verify', 'M', '1990-01-01', '2020-01-01', NULL, 'Active', 'CREATED verify 2026-11-28');

INSERT INTO PRODUCT (prodCode, description, unit, status, stamp) VALUES
('P-T01', 'Price Change Item', 'pcs', 'Active', 'CREATED verify 2026-11-28'),
('P-T02', 'No Valid Price Item', 'pcs', 'Active', 'CREATED verify 2026-11-28');

INSERT INTO PRICEHIST (prodCode, effDate, unitPrice, status, stamp) VALUES
('P-T01', '2026-01-01', 10.00, 'Active',   'CREATED verify 2026-11-28'),
('P-T01', '2026-02-01', 15.00, 'Active',   'CREATED verify 2026-11-28'),
('P-T01', '2026-02-15', 99.00, 'Inactive', 'CREATED verify 2026-11-28'),
('P-T01', '2026-03-01', 25.00, 'Active',   'CREATED verify 2026-11-28'),
('P-T02', '2026-01-01', 50.00, 'Inactive', 'CREATED verify 2026-11-28');

INSERT INTO SALES (transNo, salesDate, custNo, empNo, status, stamp) VALUES
('T-BEFORE', '2026-01-15', 'C-T99', 'E-T99', 'Active',   'CREATED verify 2026-11-28'),
('T-ON',     '2026-02-01', 'C-T99', 'E-T99', 'Active',   'CREATED verify 2026-11-28'),
('T-AFTER',  '2026-02-20', 'C-T99', 'E-T99', 'Active',   'CREATED verify 2026-11-28'),
('T-MULTI',  '2026-02-20', 'C-T99', 'E-T99', 'Active',   'CREATED verify 2026-11-28'),
('T-EMPTY',  '2026-02-20', 'C-T99', 'E-T99', 'Active',   'CREATED verify 2026-11-28'),
('T-INACT',  '2026-02-20', 'C-T99', 'E-T99', 'Inactive', 'CREATED verify 2026-11-28');

INSERT INTO SALESDETAIL (transNo, prodCode, quantity, status, stamp) VALUES
('T-BEFORE', 'P-T01', 2, 'Active',   'CREATED verify 2026-11-28'),
('T-ON',     'P-T01', 2, 'Active',   'CREATED verify 2026-11-28'),
('T-AFTER',  'P-T01', 2, 'Active',   'CREATED verify 2026-11-28'),
('T-MULTI',  'P-T01', 3, 'Active',   'CREATED verify 2026-11-28'),
('T-MULTI',  'P-T02', 1, 'Active',   'CREATED verify 2026-11-28'),
('T-EMPTY',  'P-T01', 5, 'Inactive', 'CREATED verify 2026-11-28'),
('T-INACT',  'P-T01', 4, 'Active',   'CREATED verify 2026-11-28');

-- 4. Verify v_saleline output
SELECT transNo, prodCode, quantity, unitPrice, lineTotal, priceEffDate, isMissingPrice, status
FROM v_saleline
WHERE transNo IN ('T-BEFORE', 'T-ON', 'T-AFTER', 'T-MULTI', 'T-EMPTY')
ORDER BY transNo, prodCode;

-- 5. Verify v_sales_summary output
SELECT transNo, totalLines, missingPriceCount, hasMissingPrice, transactionTotal
FROM v_sales_summary
WHERE transNo IN ('T-BEFORE', 'T-ON', 'T-AFTER', 'T-MULTI', 'T-EMPTY', 'T-INACT')
ORDER BY transNo;

-- 6. Verify index usage on PRICEHIST
EXPLAIN QUERY PLAN
SELECT * FROM v_saleline WHERE transNo = 'T-AFTER';

ROLLBACK;
