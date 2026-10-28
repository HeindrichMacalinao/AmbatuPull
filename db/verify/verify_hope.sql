-- S1-DBA-02 | Read-only SQLite verification for the HOPE historical baseline.
-- Run after migration + historical seed. Automated constraint rejection tests
-- and full source-to-target comparison are in tests/verify_hope.py.
PRAGMA foreign_keys = ON;
PRAGMA foreign_keys;     -- expected: 1
PRAGMA integrity_check; -- expected: ok
PRAGMA foreign_key_check; -- expected: zero rows

-- Exactly 10 HOPE ERP tables (ignores original Model1.db simulation tables).
SELECT name AS hope_table
FROM sqlite_master
WHERE type = 'table' AND UPPER(name) IN (
    'CUSTOMER','PRODUCT','PRICEHIST','EMPLOYEE','JOB',
    'DEPARTMENT','JOBHISTORY','SALES','SALESDETAIL','PAYMENT'
) ORDER BY name;

-- All ten audit pairs must have required types and NOT NULL flags.
SELECT m.name AS hope_table,
       SUM(p.name = 'status' AND upper(p.type) = 'VARCHAR(8)' AND p."notnull" = 1) AS valid_status_columns,
       SUM(p.name = 'stamp' AND upper(p.type) = 'VARCHAR(80)' AND p."notnull" = 1) AS valid_stamp_columns
FROM sqlite_master m JOIN pragma_table_info(m.name) p
WHERE m.type = 'table' AND UPPER(m.name) IN (
    'CUSTOMER','PRODUCT','PRICEHIST','EMPLOYEE','JOB',
    'DEPARTMENT','JOBHISTORY','SALES','SALESDETAIL','PAYMENT'
) GROUP BY m.name ORDER BY m.name;

-- Expected: 9 declared foreign-key relationships.
SELECT COUNT(*) AS foreign_key_count
FROM sqlite_master m JOIN pragma_foreign_key_list(m.name) fk
WHERE m.type = 'table' AND UPPER(m.name) IN (
    'CUSTOMER','PRODUCT','PRICEHIST','EMPLOYEE','JOB',
    'DEPARTMENT','JOBHISTORY','SALES','SALESDETAIL','PAYMENT'
);

-- Exact record counts from HopeDB_audit.sql.txt. All result rows should PASS.
WITH expected(table_name, expected_rows) AS (
    VALUES ('CUSTOMER',82),('PRODUCT',57),('PRICEHIST',79),('EMPLOYEE',32),
           ('JOB',14),('DEPARTMENT',8),('JOBHISTORY',54),('SALES',124),
           ('SALESDETAIL',313),('PAYMENT',165)
), actual(table_name, actual_rows) AS (
    SELECT 'CUSTOMER', COUNT(*) FROM CUSTOMER
    UNION ALL SELECT 'PRODUCT', COUNT(*) FROM PRODUCT
    UNION ALL SELECT 'PRICEHIST', COUNT(*) FROM PRICEHIST
    UNION ALL SELECT 'EMPLOYEE', COUNT(*) FROM EMPLOYEE
    UNION ALL SELECT 'JOB', COUNT(*) FROM JOB
    UNION ALL SELECT 'DEPARTMENT', COUNT(*) FROM DEPARTMENT
    UNION ALL SELECT 'JOBHISTORY', COUNT(*) FROM JOBHISTORY
    UNION ALL SELECT 'SALES', COUNT(*) FROM SALES
    UNION ALL SELECT 'SALESDETAIL', COUNT(*) FROM SALESDETAIL
    UNION ALL SELECT 'PAYMENT', COUNT(*) FROM PAYMENT
)
SELECT expected.table_name, expected.expected_rows, actual.actual_rows,
       CASE WHEN expected.expected_rows = actual.actual_rows THEN 'PASS' ELSE 'FAIL' END AS result
FROM expected JOIN actual USING (table_name)
ORDER BY expected.table_name;

-- Known historical rows, not fictional demonstration data.
SELECT custNo, custName, payTerms, status, stamp FROM CUSTOMER WHERE custNo = 'C0001';
SELECT empNo, lastName, firstName, status, stamp FROM EMPLOYEE WHERE empNo = '00001';
SELECT prodCode, effDate, unitPrice FROM PRICEHIST WHERE prodCode = 'AK0001' AND effDate = '2010-05-15';

-- Expected: 124 sales, 313 sales details, and 165 payments have valid parents.
SELECT (SELECT COUNT(*) FROM SALES s JOIN CUSTOMER c ON c.custNo=s.custNo JOIN EMPLOYEE e ON e.empNo=s.empNo) AS valid_sales,
       (SELECT COUNT(*) FROM SALESDETAIL d JOIN SALES s ON s.transNo=d.transNo JOIN PRODUCT p ON p.prodCode=d.prodCode) AS valid_details,
       (SELECT COUNT(*) FROM PAYMENT p JOIN SALES s ON s.transNo=p.transNo) AS valid_payments;
