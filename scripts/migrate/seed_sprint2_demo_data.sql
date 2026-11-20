-- S2-DBA-05 (#104): SQLite Sprint 2 demonstration data.
-- Run AFTER the ordered core, domain-constraint, and soft-delete migrations.
-- Uses the existing CUSTOMER, PRODUCT, and PRICEHIST columns; no schema edits.
-- Idempotency: skip only an existing primary/composite-key conflict, without
-- overwriting any customer, product, status, stamp, or historical price.
-- Validate pre-existing demo IDs before deployment; the accompanying runner
-- refuses to silently accept conflicting existing values.
--
-- IMPORTANT REQUIREMENTS CONFLICT: S2-DBA-03 enforces PRICEHIST.unitPrice > 0,
-- while the S2-DBA-05 prompt requests P-003 / 2026-02-01 / 0.00 (Active).
-- Inserting 0.00 would abort this transaction. Do NOT disable the constraint,
-- use OR IGNORE for an invalid price, or substitute a fabricated price.
-- P-003 is seeded as a product WITHOUT a price-history row pending approval.
-- P-004 is deliberately Inactive and has NO price-history row.
-- Price-row stamps use the actual time the seed script runs, because the
-- requested figures do not specify historical actors/times for price rows.

PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE TRANSACTION;

INSERT INTO CUSTOMER (custNo, custName, address, payTerms, status, stamp)
VALUES
    ('C-001', 'Acme Corporation', '123 Main St, Metro City', 'Net 30', 'Active',
     'CREATED system 2026-10-01 9:00 AM'),
    ('C-002', 'Globex Industries', '456 Oak Ave, Harbor Town', 'Net 45', 'Active',
     'CREATED system 2026-10-02 10:15 AM'),
    ('C-003', 'Initech LLC', '789 Pine Rd, Silicon Valley', 'COD', 'Active',
     'EDITED user1 2026-10-13 1:01 PM'),
    ('C-004', 'Umbrella Corp', '1 Raccoon City Blvd', 'Prepaid', 'Inactive',
     'DELETED user2 2026-10-13 1:01 PM'),
    ('C-005', 'Stark Enterprises', '200 Park Avenue, New York', 'Net 15', 'Active',
     'EDITED user1 2026-10-13 1:01 PM')
ON CONFLICT(custNo) DO NOTHING;

INSERT INTO PRODUCT (prodCode, description, unit, status, stamp)
VALUES
    ('P-001', 'Industrial Widget A', 'pcs', 'Active',
     'CREATED system 2026-10-01 9:00 AM'),
    ('P-002', 'Steel Bracket Heavy', 'pcs', 'Active',
     'CREATED system 2026-10-02 10:00 AM'),
    ('P-003', 'Lubricant Oil 5L', 'can', 'Active',
     'EDITED user1 2026-10-13 1:01 PM'),
    ('P-004', 'Safety Gloves XL', 'pair', 'Inactive',
     'DELETED user2 2026-10-13 1:01 PM'),
    ('P-005', 'Copper Wire 2.5mm', 'meter', 'Active',
     'CREATED system 2026-10-05 3:00 PM')
ON CONFLICT(prodCode) DO NOTHING;

INSERT INTO PRICEHIST (prodCode, effDate, unitPrice, status, stamp)
VALUES
    ('P-001', '2026-09-01', 0.50, 'Active',
     'CREATED system ' || strftime('%Y-%m-%d %H:%M:%S', 'now')),
    ('P-001', '2026-10-01', 0.75, 'Active',
     'CREATED system ' || strftime('%Y-%m-%d %H:%M:%S', 'now')),
    ('P-002', '2026-10-01', 0.50, 'Active',
     'CREATED system ' || strftime('%Y-%m-%d %H:%M:%S', 'now')),
    ('P-005', '2026-10-01', 0.35, 'Active',
     'CREATED system ' || strftime('%Y-%m-%d %H:%M:%S', 'now'))
ON CONFLICT(prodCode, effDate) DO NOTHING;

-- NOT EXECUTABLE under S2-DBA-03; pending an explicit team decision:
-- INSERT INTO PRICEHIST (prodCode, effDate, unitPrice, status, stamp)
-- VALUES ('P-003', '2026-02-01', 0.00, 'Active', '<approved audit stamp>');

COMMIT;
