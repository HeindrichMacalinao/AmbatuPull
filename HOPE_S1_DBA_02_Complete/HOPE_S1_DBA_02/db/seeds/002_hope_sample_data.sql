-- S1-DBA-02 | Demonstration records (not actual HopeDB_audit.sql history).
-- Run once AFTER 001_hope_base_tables.sql. All IDs/data below are fictional.
-- Omitted status fields test the DEFAULT 'Active' constraint.
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

INSERT INTO "CUSTOMER" ("custNo", "custName", "address", "payTerms", "stamp") VALUES
('C001', 'Sample Customer A', 'Quezon City', 'Net 30', 'CREATED system 2026-10-26 12:00 PM'),
('C002', 'Sample Customer B', 'Manila', 'Cash', 'CREATED system 2026-10-26 12:00 PM');

INSERT INTO "PRODUCT" ("prodCode", "description", "unit", "stamp") VALUES
('P001', 'Sample Notebook', 'piece', 'CREATED system 2026-10-26 12:00 PM'),
('P002', 'Sample Ballpen', 'piece', 'CREATED system 2026-10-26 12:00 PM');

INSERT INTO "PRICEHIST" ("prodCode", "effDate", "unitPrice", "stamp") VALUES
('P001', '2026-01-01', 75.00, 'CREATED system 2026-10-26 12:00 PM'),
('P001', '2026-07-01', 80.00, 'CREATED system 2026-10-26 12:00 PM'),
('P002', '2026-01-01', 15.00, 'CREATED system 2026-10-26 12:00 PM');

INSERT INTO "EMPLOYEE" ("empNo", "lastName", "firstName", "gender", "birthDate", "hireDate", "sepDate", "stamp") VALUES
('E001', 'Santos', 'Alex', 'M', '1998-04-15', '2024-03-01', NULL, 'CREATED system 2026-10-26 12:00 PM'),
('E002', 'Reyes', 'Jamie', 'F', '1999-09-22', '2025-01-10', NULL, 'CREATED system 2026-10-26 12:00 PM');

INSERT INTO "JOB" ("jobCode", "jobDesc", "stamp") VALUES
('J001', 'Sales Associate', 'CREATED system 2026-10-26 12:00 PM'),
('J002', 'Sales Manager', 'CREATED system 2026-10-26 12:00 PM');

INSERT INTO "DEPARTMENT" ("deptCode", "deptName", "stamp") VALUES
('D001', 'Sales', 'CREATED system 2026-10-26 12:00 PM'),
('D002', 'Operations', 'CREATED system 2026-10-26 12:00 PM');

INSERT INTO "JOBHISTORY" ("empNo", "jobCode", "effDate", "salary", "deptCode", "stamp") VALUES
('E001', 'J001', '2024-03-01', 25000.00, 'D001', 'CREATED system 2026-10-26 12:00 PM'),
('E001', 'J002', '2026-04-01', 35000.00, 'D001', 'CREATED system 2026-10-26 12:00 PM'),
('E002', 'J001', '2025-01-10', 24000.00, 'D001', 'CREATED system 2026-10-26 12:00 PM');

INSERT INTO "SALES" ("transNo", "salesDate", "custNo", "empNo", "stamp") VALUES
('S001', '2026-10-01', 'C001', 'E001', 'CREATED system 2026-10-26 12:00 PM'),
('S002', '2026-10-02', 'C002', 'E002', 'CREATED system 2026-10-26 12:00 PM');

INSERT INTO "SALESDETAIL" ("transNo", "prodCode", "quantity", "stamp") VALUES
('S001', 'P001', 2, 'CREATED system 2026-10-26 12:00 PM'),
('S001', 'P002', 5, 'CREATED system 2026-10-26 12:00 PM'),
('S002', 'P002', 3, 'CREATED system 2026-10-26 12:00 PM');

INSERT INTO "PAYMENT" ("ORNo", "payDate", "amount", "transNo", "stamp") VALUES
('OR001', '2026-10-01', 235.00, 'S001', 'CREATED system 2026-10-26 12:00 PM'),
('OR002', '2026-10-02', 45.00, 'S002', 'CREATED system 2026-10-26 12:00 PM');

COMMIT;
