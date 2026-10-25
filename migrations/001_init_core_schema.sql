-- ==============================================================================
-- Hope, Inc. ERP — Database Migration 001: Core ERP Schema
-- Task ID: S1-DBA-01 / S1-DBA-02 (Issue #6, #7)
-- Role: DevSecOps (@Chrollofuru)
-- Target: SQLite (UTF-8, No Docker)
-- ==============================================================================
-- Creates the 10 foundational tables with referential integrity and mandatory
-- 'status' (Active/Inactive) and 'stamp' audit tracking columns on EVERY table.
-- ==============================================================================

-- 1. CUSTOMER TABLE
CREATE TABLE IF NOT EXISTS CUSTOMER (
    custNo VARCHAR(10) PRIMARY KEY,
    custName VARCHAR(100) NOT NULL,
    address VARCHAR(200),
    payTerms VARCHAR(20),
    status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
);

-- 2. PRODUCT TABLE
CREATE TABLE IF NOT EXISTS PRODUCT (
    prodCode VARCHAR(10) PRIMARY KEY,
    description VARCHAR(100) NOT NULL,
    unit VARCHAR(20),
    status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
);

-- 3. PRICEHIST TABLE (Composite PK: prodCode, effDate)
CREATE TABLE IF NOT EXISTS PRICEHIST (
    prodCode VARCHAR(10) NOT NULL,
    effDate DATE NOT NULL,
    unitPrice DECIMAL(10,2) NOT NULL CHECK (unitPrice >= 0),
    status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL,
    PRIMARY KEY (prodCode, effDate),
    FOREIGN KEY (prodCode) REFERENCES PRODUCT (prodCode) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 4. DEPARTMENT TABLE
CREATE TABLE IF NOT EXISTS DEPARTMENT (
    deptCode VARCHAR(10) PRIMARY KEY,
    deptName VARCHAR(100) NOT NULL,
    status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
);

-- 5. JOB TABLE
CREATE TABLE IF NOT EXISTS JOB (
    jobCode VARCHAR(10) PRIMARY KEY,
    jobDesc VARCHAR(100) NOT NULL,
    status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
);

-- 6. EMPLOYEE TABLE
CREATE TABLE IF NOT EXISTS EMPLOYEE (
    empNo VARCHAR(10) PRIMARY KEY,
    lastName VARCHAR(50) NOT NULL,
    firstName VARCHAR(50) NOT NULL,
    gender CHAR(1) CHECK (gender IN ('M', 'F', 'O')),
    birthDate DATE,
    hireDate DATE NOT NULL,
    sepDate DATE,
    deptCode VARCHAR(10),
    jobCode VARCHAR(10),
    status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL,
    FOREIGN KEY (deptCode) REFERENCES DEPARTMENT (deptCode) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (jobCode) REFERENCES JOB (jobCode) ON DELETE SET NULL ON UPDATE CASCADE
);

-- 7. JOBHISTORY TABLE (Composite PK: empNo, jobCode, effDate)
CREATE TABLE IF NOT EXISTS JOBHISTORY (
    empNo VARCHAR(10) NOT NULL,
    jobCode VARCHAR(10) NOT NULL,
    effDate DATE NOT NULL,
    salary DECIMAL(12,2) CHECK (salary >= 0),
    deptCode VARCHAR(10),
    status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL,
    PRIMARY KEY (empNo, jobCode, effDate),
    FOREIGN KEY (empNo) REFERENCES EMPLOYEE (empNo) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (jobCode) REFERENCES JOB (jobCode) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (deptCode) REFERENCES DEPARTMENT (deptCode) ON DELETE SET NULL ON UPDATE CASCADE
);

-- 8. SALES TABLE
CREATE TABLE IF NOT EXISTS SALES (
    transNo VARCHAR(10) PRIMARY KEY,
    salesDate DATE NOT NULL,
    custNo VARCHAR(10) NOT NULL,
    empNo VARCHAR(10) NOT NULL,
    status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL,
    FOREIGN KEY (custNo) REFERENCES CUSTOMER (custNo) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (empNo) REFERENCES EMPLOYEE (empNo) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 9. SALESDETAIL TABLE (Composite PK: transNo, prodCode)
CREATE TABLE IF NOT EXISTS SALESDETAIL (
    transNo VARCHAR(10) NOT NULL,
    prodCode VARCHAR(10) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL,
    PRIMARY KEY (transNo, prodCode),
    FOREIGN KEY (transNo) REFERENCES SALES (transNo) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (prodCode) REFERENCES PRODUCT (prodCode) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 10. PAYMENT TABLE
CREATE TABLE IF NOT EXISTS PAYMENT (
    ORNo VARCHAR(10) PRIMARY KEY,
    payDate DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    transNo VARCHAR(10) NOT NULL,
    status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL,
    FOREIGN KEY (transNo) REFERENCES SALES (transNo) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ==============================================================================
-- PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_customer_status ON CUSTOMER(status);
CREATE INDEX IF NOT EXISTS idx_product_status ON PRODUCT(status);
CREATE INDEX IF NOT EXISTS idx_employee_dept ON EMPLOYEE(deptCode);
CREATE INDEX IF NOT EXISTS idx_employee_status ON EMPLOYEE(status);
CREATE INDEX IF NOT EXISTS idx_sales_cust ON SALES(custNo);
CREATE INDEX IF NOT EXISTS idx_sales_date ON SALES(salesDate);
CREATE INDEX IF NOT EXISTS idx_sales_status ON SALES(status);
CREATE INDEX IF NOT EXISTS idx_salesdetail_prod ON SALESDETAIL(prodCode);
CREATE INDEX IF NOT EXISTS idx_payment_trans ON PAYMENT(transNo);

-- ==============================================================================
-- BASELINE SEED DATA
-- ==============================================================================
INSERT OR IGNORE INTO DEPARTMENT (deptCode, deptName, status, stamp) VALUES
('EXEC', 'Executive Administration', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('SALES', 'Sales & Marketing', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('IT', 'Information Technology', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('HR', 'Human Resources', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('FIN', 'Finance & Accounting', 'Active', 'CREATED system 2026-10-25 00:00:00');

INSERT OR IGNORE INTO JOB (jobCode, jobDesc, status, stamp) VALUES
('CEO', 'Chief Executive Officer', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('MGR_SALES', 'Sales Manager', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('DEV_LEAD', 'Lead Software Engineer', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('HR_SPEC', 'HR Specialist', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('ACCT_CLERK', 'Accounting Clerk', 'Active', 'CREATED system 2026-10-25 00:00:00');

INSERT OR IGNORE INTO CUSTOMER (custNo, custName, address, payTerms, status, stamp) VALUES
('CUST-001', 'Hope Global Enterprises', '100 Ayala Avenue, Makati City', 'Net 30', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('CUST-002', 'Luzon Retail Distribution', '45 Quezon Blvd, Quezon City', 'Net 15', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('CUST-003', 'Metro Supplies Corp.', '12 Bonifacio High Street, Taguig City', 'COD', 'Active', 'CREATED system 2026-10-25 00:00:00');

INSERT OR IGNORE INTO PRODUCT (prodCode, description, unit, status, stamp) VALUES
('PROD-001', 'Enterprise Cloud License (Annual)', 'License', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('PROD-002', 'Standard ERP Module Seat', 'User/Mo', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('PROD-003', 'Implementation & Setup Package', 'Service', 'Active', 'CREATED system 2026-10-25 00:00:00');

INSERT OR IGNORE INTO PRICEHIST (prodCode, effDate, unitPrice, status, stamp) VALUES
('PROD-001', '2026-01-01', 25000.00, 'Active', 'CREATED system 2026-10-25 00:00:00'),
('PROD-002', '2026-01-01', 1200.00, 'Active', 'CREATED system 2026-10-25 00:00:00'),
('PROD-003', '2026-01-01', 50000.00, 'Active', 'CREATED system 2026-10-25 00:00:00');
