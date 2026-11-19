-- S2-DBA-04: SQLite referential-integrity and soft-delete verification.
-- Run through: python tests/verify_customer_product_restrict.py
-- The Python runner executes these named SQL blocks, catches the expected FK
-- failures, asserts each SELECT returns 1, and ALWAYS rolls back. Do not run
-- this file directly: its intentionally invalid DELETEs must be caught.
-- C-001 does not exist in the approved HOPE historical baseline (C0001 does),
-- so this script creates a disposable C-001 with a linked sale inside a txn.

-- @begin
BEGIN IMMEDIATE;

-- @setup
INSERT INTO EMPLOYEE (empNo, lastName, firstName, hireDate, status, stamp)
VALUES ('E-S204', 'Verification', 'Employee', '2026-11-18', 'Active', 'CREATED s2-dba-04 test');

INSERT INTO CUSTOMER (custNo, custName, payTerms, status, stamp)
VALUES ('C-001', 'Verification Customer', 'COD', 'Active', 'CREATED s2-dba-04 test');

INSERT INTO PRODUCT (prodCode, description, unit, status, stamp)
VALUES ('P-S2-PH', 'Price-history FK verification', 'pcs', 'Active', 'CREATED s2-dba-04 test');

INSERT INTO PRODUCT (prodCode, description, unit, status, stamp)
VALUES ('P-S2-SD', 'Sales-detail FK verification', 'pcs', 'Active', 'CREATED s2-dba-04 test');

INSERT INTO PRICEHIST (prodCode, effDate, unitPrice, status, stamp)
VALUES ('P-S2-PH', '2026-11-18', 1.25, 'Active', 'CREATED s2-dba-04 test');

INSERT INTO SALES (transNo, salesDate, custNo, empNo, status, stamp)
VALUES ('S2V00001', '2026-11-18', 'C-001', 'E-S204', 'Active', 'CREATED s2-dba-04 test');

INSERT INTO SALESDETAIL (transNo, prodCode, quantity, status, stamp)
VALUES ('S2V00001', 'P-S2-SD', 1, 'Active', 'CREATED s2-dba-04 test');

-- @reject_customer
DELETE FROM CUSTOMER WHERE custNo = 'C-001';

-- @reject_product_pricehist
DELETE FROM PRODUCT WHERE prodCode = 'P-S2-PH';

-- @reject_product_salesdetail
DELETE FROM PRODUCT WHERE prodCode = 'P-S2-SD';

-- @soft_delete
UPDATE CUSTOMER
SET status = 'Inactive', stamp = 'EDITED s2-dba-04 verify'
WHERE custNo = 'C-001';

UPDATE PRODUCT
SET status = 'Inactive', stamp = 'EDITED s2-dba-04 verify'
WHERE prodCode IN ('P-S2-PH', 'P-S2-SD');

-- @verify
SELECT COUNT(*) = 1 FROM CUSTOMER WHERE custNo = 'C-001' AND status = 'Inactive';
SELECT COUNT(*) = 2 FROM PRODUCT
 WHERE prodCode IN ('P-S2-PH', 'P-S2-SD') AND status = 'Inactive';
SELECT COUNT(*) = 1 FROM SALES s
 JOIN CUSTOMER c ON c.custNo = s.custNo
 WHERE c.custNo = 'C-001' AND c.status = 'Inactive';
SELECT COUNT(*) = 1 FROM SALESDETAIL d
 JOIN SALES s ON s.transNo = d.transNo
 JOIN PRODUCT p ON p.prodCode = d.prodCode
 WHERE s.custNo = 'C-001' AND p.prodCode = 'P-S2-SD' AND p.status = 'Inactive';
SELECT COUNT(*) = 1 FROM PRICEHIST h
 JOIN PRODUCT p ON p.prodCode = h.prodCode
 WHERE p.prodCode = 'P-S2-PH' AND p.status = 'Inactive';

-- @rollback
ROLLBACK;
