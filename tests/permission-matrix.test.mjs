import { test } from 'node:test';
import assert from 'node:assert/strict';

export const RIGHTS = [
  'customer.view', 'customer.create', 'customer.delete',
  'product.view', 'product.create', 'product.edit', 'product.delete', 'product.import', 'product.export',
  'hr.view', 'hr.create', 'hr.edit', 'hr.delete', 'hr.block', 'hr.roles', 'hr.rights', 'hr.attendance',
  'hr.leave', 'hr.payroll', 'hr.documents', 'hr.export', 'hr.audit',
  'sales.view', 'sales.create', 'sales.edit', 'sales.delete', 'sales.refund', 'sales.export', 'sales.discount',
  'reports.view', 'reports.sales', 'reports.inventory', 'reports.hr', 'reports.financial', 'reports.export', 'reports.audit',
];

test('permission inventory contains exactly 36 unique rights', () => {
  assert.equal(RIGHTS.length, 36);
  assert.equal(new Set(RIGHTS).size, RIGHTS.length);
});
