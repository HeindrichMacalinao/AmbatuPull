-- Sprint 1 QA test-only roles and rights fixture.
-- SQLite-compatible SQL; run only after db/migrations/002_user_management_tables.sql.
-- This file is documentation/fixture source and is not executed by this task.

BEGIN;

-- Seed the three documented role names.
INSERT INTO "module" ("moduleCode", "moduleName")
VALUES
  ('customer', 'Customer'),
  ('product', 'Product'),
  ('hr', 'Human Resources'),
  ('sales', 'Sales'),
  ('reports', 'Reports')
ON CONFLICT ("moduleCode") DO UPDATE
SET "moduleName" = excluded."moduleName";

INSERT INTO "rights" ("rightCode", "moduleCode", "description")
VALUES
  ('customer.view', 'customer', 'View customers'),
  ('customer.create', 'customer', 'Create customers'),
  ('customer.delete', 'customer', 'Delete customers'),
  ('product.view', 'product', 'View products'),
  ('product.create', 'product', 'Create products'),
  ('product.edit', 'product', 'Edit products'),
  ('product.delete', 'product', 'Delete products'),
  ('product.import', 'product', 'Import products'),
  ('product.export', 'product', 'Export products'),
  ('hr.view', 'hr', 'View human resources'),
  ('hr.create', 'hr', 'Create human resources records'),
  ('hr.edit', 'hr', 'Edit human resources records'),
  ('hr.delete', 'hr', 'Delete human resources records'),
  ('hr.block', 'hr', 'Block human resources records'),
  ('hr.roles', 'hr', 'Manage human resources roles'),
  ('hr.rights', 'hr', 'Manage human resources rights'),
  ('hr.attendance', 'hr', 'Manage attendance'),
  ('hr.leave', 'hr', 'Manage leave'),
  ('hr.payroll', 'hr', 'Manage payroll'),
  ('hr.documents', 'hr', 'Manage documents'),
  ('hr.export', 'hr', 'Export human resources data'),
  ('hr.audit', 'hr', 'View human resources audit'),
  ('sales.view', 'sales', 'View sales'),
  ('sales.create', 'sales', 'Create sales'),
  ('sales.edit', 'sales', 'Edit sales'),
  ('sales.delete', 'sales', 'Delete sales'),
  ('sales.refund', 'sales', 'Refund sales'),
  ('sales.export', 'sales', 'Export sales'),
  ('sales.discount', 'sales', 'Apply sales discounts'),
  ('reports.view', 'reports', 'View reports'),
  ('reports.sales', 'reports', 'View sales reports'),
  ('reports.inventory', 'reports', 'View inventory reports'),
  ('reports.hr', 'reports', 'View HR reports'),
  ('reports.financial', 'reports', 'View financial reports'),
  ('reports.export', 'reports', 'Export reports'),
  ('reports.audit', 'reports', 'View report audit')
ON CONFLICT ("rightCode") DO UPDATE
SET "moduleCode" = excluded."moduleCode",
    "description" = excluded."description";

INSERT INTO "role" ("roleName", "description")
VALUES
  ('Superadmin', 'Full system access'),
  ('Admin', 'Eligible user management'),
  ('User', 'Granted rights only')
ON CONFLICT ("roleName") DO UPDATE
SET "description" = excluded."description";

COMMIT;
