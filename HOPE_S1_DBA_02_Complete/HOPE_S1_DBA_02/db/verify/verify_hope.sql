-- S1-DBA-02 | Run as SQL inspection queries after migration and seed.
-- NOTE: PRAGMA foreign_keys is connection-local; ensure it returns 1.
PRAGMA foreign_keys = ON;
PRAGMA foreign_keys;
PRAGMA integrity_check;
PRAGMA foreign_key_check; -- 0 rows means no existing FK violations.

-- 10 required HOPE tables (ignores pre-existing Model1.db simulation tables):
SELECT name FROM sqlite_master
WHERE type = 'table' AND name IN (
    'CUSTOMER','PRODUCT','PRICEHIST','EMPLOYEE','JOB',
    'DEPARTMENT','JOBHISTORY','SALES','SALESDETAIL','PAYMENT'
) ORDER BY name;

-- Each table must have exactly one status and one stamp column:
SELECT m.name AS table_name,
       SUM(p.name = 'status' AND upper(p.type) = 'VARCHAR(8)' AND p."notnull" = 1) AS valid_status_columns,
       SUM(p.name = 'stamp' AND upper(p.type) = 'VARCHAR(80)' AND p."notnull" = 1) AS valid_stamp_columns
FROM sqlite_master AS m
JOIN pragma_table_info(m.name) AS p
WHERE m.type = 'table' AND m.name IN (
    'CUSTOMER','PRODUCT','PRICEHIST','EMPLOYEE','JOB',
    'DEPARTMENT','JOBHISTORY','SALES','SALESDETAIL','PAYMENT'
)
GROUP BY m.name ORDER BY m.name;

-- Number of declared FK relationships: must be 9.
SELECT COUNT(*) AS fk_count FROM sqlite_master AS m
JOIN pragma_foreign_key_list(m.name) AS fk
WHERE m.type = 'table' AND m.name IN (
    'CUSTOMER','PRODUCT','PRICEHIST','EMPLOYEE','JOB',
    'DEPARTMENT','JOBHISTORY','SALES','SALESDETAIL','PAYMENT'
);

-- All tables must have at least one seeded record:
SELECT 'CUSTOMER' AS table_name, COUNT(*) AS rows_loaded FROM "CUSTOMER"
UNION ALL SELECT 'PRODUCT', COUNT(*) FROM "PRODUCT"
UNION ALL SELECT 'PRICEHIST', COUNT(*) FROM "PRICEHIST"
UNION ALL SELECT 'EMPLOYEE', COUNT(*) FROM "EMPLOYEE"
UNION ALL SELECT 'JOB', COUNT(*) FROM "JOB"
UNION ALL SELECT 'DEPARTMENT', COUNT(*) FROM "DEPARTMENT"
UNION ALL SELECT 'JOBHISTORY', COUNT(*) FROM "JOBHISTORY"
UNION ALL SELECT 'SALES', COUNT(*) FROM "SALES"
UNION ALL SELECT 'SALESDETAIL', COUNT(*) FROM "SALESDETAIL"
UNION ALL SELECT 'PAYMENT', COUNT(*) FROM "PAYMENT";

-- Practical relationship inspection:
SELECT s."transNo", c."custName", e."firstName", e."lastName", p."ORNo", p."amount"
FROM "SALES" AS s
JOIN "CUSTOMER" AS c ON c."custNo" = s."custNo"
JOIN "EMPLOYEE" AS e ON e."empNo" = s."empNo"
JOIN "PAYMENT" AS p ON p."transNo" = s."transNo"
ORDER BY s."transNo";

-- For actively testing rejected INSERTS without aborting this SQL script,
-- run tests/verify_hope.py (uses transaction SAVEPOINT and IntegrityError).
