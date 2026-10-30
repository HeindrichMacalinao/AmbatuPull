-- Sprint 1 QA test-only fixture cleanup.
-- SQLite-compatible SQL; documentation only for a future disposable DB.
-- This file is not executed by this task.

BEGIN;

-- Remove permissions belonging to test-prefixed accounts.
DELETE FROM user_permission
WHERE "userId" IN (SELECT "userId" FROM app_user WHERE email LIKE 'test_%');

-- Remove only test-prefixed accounts.
DELETE FROM app_user
WHERE email LIKE 'test_%';

-- Remove only rights seeded by the test fixture. A right is safe to remove
-- after its grants are removed above.
DELETE FROM rights
WHERE "rightCode" IN (
  'customer.view',
  'customer.create',
  'customer.delete',
  'product.view',
  'product.create',
  'product.edit',
  'product.delete',
  'product.import',
  'product.export',
  'hr.view',
  'hr.create',
  'hr.edit',
  'hr.delete',
  'hr.block',
  'hr.roles',
  'hr.rights',
  'hr.attendance',
  'hr.leave',
  'hr.payroll',
  'hr.documents',
  'hr.export',
  'hr.audit',
  'sales.view',
  'sales.create',
  'sales.edit',
  'sales.delete',
  'sales.refund',
  'sales.export',
  'sales.discount',
  'reports.view',
  'reports.sales',
  'reports.inventory',
  'reports.hr',
  'reports.financial',
  'reports.export',
  'reports.audit'
)
;

-- Remove only role rows created by the test fixture.
DELETE FROM role
WHERE "roleName" IN ('Superadmin', 'Admin', 'User');

-- Reset-token/session cleanup is intentionally absent because those table
-- names and columns are not present in the repository.

COMMIT;
