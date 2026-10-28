-- S1-DBA-02 | Hope, Inc. ERP base tables | SQLite 3
-- Assumptions:
--   1. SQLite is selected to match the supplied Model1.db. Enable foreign keys
--      on every application connection (PRAGMA foreign_keys = ON).
--   2. EMPLOYEE.lastName and EMPLOYEE.firstName are VARCHAR(100); the issue
--      does not specify their lengths or nullability.
--   3. DATE and DECIMAL(p,s) preserve the requested declared types in SQLite;
--      SQLite does not strictly enforce date formats or decimal precision.
--   4. Stamps are written by INSERT/UPDATE callers, not auto-generated.
-- Run once on a SQLite database; do not rerun outside the migration runner.

PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

CREATE TABLE "CUSTOMER" (
    "custNo" VARCHAR(10) PRIMARY KEY,
    "custName" VARCHAR(100) NOT NULL,
    "address" VARCHAR(200),
    "payTerms" VARCHAR(20),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active'
        CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL
);

CREATE TABLE "PRODUCT" (
    "prodCode" VARCHAR(10) PRIMARY KEY,
    "description" VARCHAR(100) NOT NULL,
    "unit" VARCHAR(20),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active'
        CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL
);

CREATE TABLE "PRICEHIST" (
    "prodCode" VARCHAR(10) NOT NULL,
    "effDate" DATE NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active'
        CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL,
    PRIMARY KEY ("prodCode", "effDate"),
    FOREIGN KEY ("prodCode") REFERENCES "PRODUCT" ("prodCode")
);

CREATE TABLE "EMPLOYEE" (
    "empNo" VARCHAR(10) PRIMARY KEY,
    "lastName" VARCHAR(100),
    "firstName" VARCHAR(100),
    "gender" CHAR(1),
    "birthDate" DATE,
    "hireDate" DATE,
    "sepDate" DATE NULL,
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active'
        CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL
);

CREATE TABLE "JOB" (
    "jobCode" VARCHAR(10) PRIMARY KEY,
    "jobDesc" VARCHAR(100),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active'
        CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL
);

CREATE TABLE "DEPARTMENT" (
    "deptCode" VARCHAR(10) PRIMARY KEY,
    "deptName" VARCHAR(100),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active'
        CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL
);

CREATE TABLE "JOBHISTORY" (
    "empNo" VARCHAR(10) NOT NULL,
    "jobCode" VARCHAR(10) NOT NULL,
    "effDate" DATE NOT NULL,
    "salary" DECIMAL(12,2),
    "deptCode" VARCHAR(10),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active'
        CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL,
    PRIMARY KEY ("empNo", "jobCode", "effDate"),
    FOREIGN KEY ("empNo") REFERENCES "EMPLOYEE" ("empNo"),
    FOREIGN KEY ("jobCode") REFERENCES "JOB" ("jobCode"),
    FOREIGN KEY ("deptCode") REFERENCES "DEPARTMENT" ("deptCode")
);

CREATE TABLE "SALES" (
    "transNo" VARCHAR(10) PRIMARY KEY,
    "salesDate" DATE,
    "custNo" VARCHAR(10),
    "empNo" VARCHAR(10),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active'
        CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL,
    FOREIGN KEY ("custNo") REFERENCES "CUSTOMER" ("custNo"),
    FOREIGN KEY ("empNo") REFERENCES "EMPLOYEE" ("empNo")
);

CREATE TABLE "SALESDETAIL" (
    "transNo" VARCHAR(10) NOT NULL,
    "prodCode" VARCHAR(10) NOT NULL,
    "quantity" INT,
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active'
        CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL,
    PRIMARY KEY ("transNo", "prodCode"),
    FOREIGN KEY ("transNo") REFERENCES "SALES" ("transNo"),
    FOREIGN KEY ("prodCode") REFERENCES "PRODUCT" ("prodCode")
);

CREATE TABLE "PAYMENT" (
    "ORNo" VARCHAR(10) PRIMARY KEY,
    "payDate" DATE,
    "amount" DECIMAL(12,2),
    "transNo" VARCHAR(10),
    "status" VARCHAR(8) NOT NULL DEFAULT 'Active'
        CHECK ("status" IN ('Active', 'Inactive')),
    "stamp" VARCHAR(80) NOT NULL,
    FOREIGN KEY ("transNo") REFERENCES "SALES" ("transNo")
);

COMMIT;
