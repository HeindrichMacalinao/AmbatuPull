-- ==============================================================================
-- Hope, Inc. ERP — Database Migration 001: Core ERP Schema (Supabase / PostgreSQL)
-- ==============================================================================
-- Creates the 10 foundational tables with referential integrity,
-- status columns ('Active', 'Inactive'), and stamp audit tracking.
-- ==============================================================================

-- 1. CUSTOMER TABLE
CREATE TABLE IF NOT EXISTS "CUSTOMER" (
    "custNo" VARCHAR(10) PRIMARY KEY,
    "custName" VARCHAR(100) NOT NULL,
    "address" VARCHAR(200),
    "payTerms" VARCHAR(20),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL DEFAULT 'SYSTEM_INIT'
);

-- 2. PRODUCT TABLE
CREATE TABLE IF NOT EXISTS "PRODUCT" (
    "prodCode" VARCHAR(10) PRIMARY KEY,
    "description" VARCHAR(100) NOT NULL,
    "unit" VARCHAR(20),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL DEFAULT 'SYSTEM_INIT'
);

-- 3. PRICEHIST TABLE (Composite PK: prodCode, effDate)
CREATE TABLE IF NOT EXISTS "PRICEHIST" (
    "prodCode" VARCHAR(10) NOT NULL,
    "effDate" DATE NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL CHECK ("unitPrice" >= 0),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL DEFAULT 'SYSTEM_INIT',
    PRIMARY KEY ("prodCode", "effDate"),
    FOREIGN KEY ("prodCode") REFERENCES "PRODUCT" ("prodCode") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 4. DEPARTMENT TABLE
CREATE TABLE IF NOT EXISTS "DEPARTMENT" (
    "deptCode" VARCHAR(10) PRIMARY KEY,
    "deptName" VARCHAR(100) NOT NULL,
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL DEFAULT 'SYSTEM_INIT'
);

-- 5. JOB TABLE
CREATE TABLE IF NOT EXISTS "JOB" (
    "jobCode" VARCHAR(10) PRIMARY KEY,
    "jobDesc" VARCHAR(100) NOT NULL,
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL DEFAULT 'SYSTEM_INIT'
);

-- 6. EMPLOYEE TABLE
CREATE TABLE IF NOT EXISTS "EMPLOYEE" (
    "empNo" VARCHAR(10) PRIMARY KEY,
    "lastName" VARCHAR(50) NOT NULL,
    "firstName" VARCHAR(50) NOT NULL,
    "midName" VARCHAR(50),
    "deptCode" VARCHAR(10) NOT NULL,
    "jobCode" VARCHAR(10) NOT NULL,
    "dateHired" DATE NOT NULL,
    "dateSeparated" DATE,
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL DEFAULT 'SYSTEM_INIT',
    FOREIGN KEY ("deptCode") REFERENCES "DEPARTMENT" ("deptCode") ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY ("jobCode") REFERENCES "JOB" ("jobCode") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 7. JOBHISTORY TABLE (Composite PK: empNo, effDate)
CREATE TABLE IF NOT EXISTS "JOBHISTORY" (
    "empNo" VARCHAR(10) NOT NULL,
    "effDate" DATE NOT NULL,
    "jobCode" VARCHAR(10) NOT NULL,
    "salary" DECIMAL(10,2) NOT NULL CHECK ("salary" >= 0),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL DEFAULT 'SYSTEM_INIT',
    PRIMARY KEY ("empNo", "effDate"),
    FOREIGN KEY ("empNo") REFERENCES "EMPLOYEE" ("empNo") ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY ("jobCode") REFERENCES "JOB" ("jobCode") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 8. SALES TABLE
CREATE TABLE IF NOT EXISTS "SALES" (
    "saleNo" VARCHAR(10) PRIMARY KEY,
    "custNo" VARCHAR(10) NOT NULL,
    "saleDate" DATE NOT NULL,
    "remarks" VARCHAR(200),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL DEFAULT 'SYSTEM_INIT',
    FOREIGN KEY ("custNo") REFERENCES "CUSTOMER" ("custNo") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 9. SALESDETAIL TABLE (Composite PK: saleNo, prodCode)
CREATE TABLE IF NOT EXISTS "SALESDETAIL" (
    "saleNo" VARCHAR(10) NOT NULL,
    "prodCode" VARCHAR(10) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL CHECK ("unitPrice" >= 0),
    "quantity" DECIMAL(10,2) NOT NULL CHECK ("quantity" > 0),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL DEFAULT 'SYSTEM_INIT',
    PRIMARY KEY ("saleNo", "prodCode"),
    FOREIGN KEY ("saleNo") REFERENCES "SALES" ("saleNo") ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY ("prodCode") REFERENCES "PRODUCT" ("prodCode") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 10. PAYMENT TABLE
CREATE TABLE IF NOT EXISTS "PAYMENT" (
    "orNo" VARCHAR(10) PRIMARY KEY,
    "saleNo" VARCHAR(10) NOT NULL,
    "payDate" DATE NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL CHECK ("amount" > 0),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL DEFAULT 'SYSTEM_INIT',
    FOREIGN KEY ("saleNo") REFERENCES "SALES" ("saleNo") ON DELETE RESTRICT ON UPDATE CASCADE
);
