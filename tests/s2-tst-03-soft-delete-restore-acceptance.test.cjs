'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { test, beforeEach, afterEach } = require('node:test');
const poolModule = require('../src/db/pool');
const customerService = require('../src/services/customerService');
const productService = require('../src/services/productService');

const root = path.resolve(__dirname, '..');
const admin = { role: 'Admin', email: 'admin@hope.com' };
const user = { role: 'User', userId: 7, email: 'user@hope.com', rights: ['customer.delete', 'product.delete'] };

let originalGetPool;
let queryHandler;
let customerState;
let productState;

const fakePool = {
  query: async (sql, params = []) => {
    if (queryHandler) return queryHandler(sql, params);
    return { rows: [], rowCount: 0 };
  },
};

beforeEach(() => {
  originalGetPool = poolModule.getPool;
  poolModule.getPool = () => fakePool;
  customerState = {
    custNo: 'C-001',
    custName: 'Linked Customer',
    address: '1 Main Street',
    payTerms: 'Net 30',
    status: 'Active',
    stamp: 'CREATED seed 2026-01-01 09:00 AM',
  };
  productState = {
    prodCode: 'P-S2-PH',
    description: 'Linked Product',
    unit: 'pcs',
    status: 'Active',
    stamp: 'CREATED seed 2026-01-01 09:00 AM',
  };
  queryHandler = async (sql, params) => {
    if (sql.includes('FROM CUSTOMER')) return { rows: [{ ...customerState }], rowCount: 1 };
    if (sql.includes('FROM PRODUCT')) return { rows: [{ ...productState }], rowCount: 1 };
    if (sql.includes('UPDATE CUSTOMER')) {
      if (sql.includes("status = 'Inactive'")) customerState = { ...customerState, status: 'Inactive', stamp: params[0] };
      else if (sql.includes("status = 'Active'")) customerState = { ...customerState, status: 'Active', stamp: params[0] };
      else customerState = { ...customerState, custName: params[0], address: params[1], payTerms: params[2], stamp: params[3] };
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('UPDATE PRODUCT')) {
      if (sql.includes("status = 'Inactive'")) productState = { ...productState, status: 'Inactive', stamp: params[0] };
      else if (sql.includes("status = 'Active'")) productState = { ...productState, status: 'Active', stamp: params[0] };
      else productState = { ...productState, description: params[0], unit: params[1], stamp: params[2] };
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  };
});

afterEach(() => {
  poolModule.getPool = originalGetPool;
});

test('TC-DEL-01/03 and stamp cycle: customer edit, soft delete, and Admin restore preserve the row', async () => {
  const edited = await customerService.updateCustomer({
    custNo: 'C-001',
    data: { custName: 'Edited Linked Customer' },
    requester: admin,
  });
  assert.match(edited.stamp, /^EDITED admin@hope\.com /);

  const deleted = await customerService.softDeleteCustomer({ custNo: 'C-001', requester: admin });
  assert.equal(customerState.status, 'Inactive');
  assert.match(deleted.stamp, /^DELETED admin@hope\.com /);

  const restored = await customerService.restoreCustomer({ custNo: 'C-001', requester: admin });
  assert.equal(customerState.status, 'Active');
  assert.match(restored.stamp, /^RESTORED admin@hope\.com /);
  assert.equal(customerState.custNo, 'C-001');
});

test('TC-DEL-04: standard Users cannot restore an inactive customer or product', async () => {
  await assert.rejects(
    () => customerService.restoreCustomer({ custNo: 'C-001', requester: user }),
    (error) => error.status === 403
  );
  await assert.rejects(
    () => productService.restoreProduct({ prodCode: 'P-S2-PH', requester: user }),
    (error) => error.status === 403
  );
});

test('Product soft-delete and restore cycle preserves audit stamps and never issues hard DELETE', async () => {
  const queries = [];
  const originalQuery = fakePool.query;
  fakePool.query = async (sql, params = []) => {
    queries.push(sql);
    return originalQuery(sql, params);
  };

  await productService.updateProduct({
    prodCode: 'P-S2-PH',
    data: { description: 'Edited Linked Product', unit: 'pcs' },
    requester: admin,
  });
  const deleted = await productService.softDeleteProduct({ prodCode: 'P-S2-PH', requester: admin });
  const restored = await productService.restoreProduct({ prodCode: 'P-S2-PH', requester: admin });

  assert.match(deleted.stamp, /^DELETED admin@hope\.com /);
  assert.match(restored.stamp, /^RESTORED admin@hope\.com /);
  assert.equal(productState.status, 'Active');
  assert.ok(queries.every((sql) => !/\bDELETE\s+FROM\s+(PRODUCT|PRICEHIST|SALESDETAIL)/i.test(sql)));
});

test('TC-FK-01/02: hard deletes are restricted while soft deletes preserve child links', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(fs.readFileSync(path.join(root, 'db/migrations/001_hope_base_tables.sql'), 'utf8'));
    db.prepare("INSERT INTO CUSTOMER VALUES ('C-001','Linked Customer','1 Main','Net 30','Active','CREATED test')").run();
    db.prepare("INSERT INTO PRODUCT VALUES ('P-S2-PH','Linked Product','pcs','Active','CREATED test')").run();
    db.prepare("INSERT INTO SALES VALUES ('S2V00001','2026-11-20','C-001',NULL,'Active','CREATED test')").run();
    db.prepare("INSERT INTO SALESDETAIL VALUES ('S2V00001','P-S2-PH',1,'Active','CREATED test')").run();
    db.prepare("INSERT INTO PRICEHIST VALUES ('P-S2-PH','2026-11-01',12.50,'Active','CREATED test')").run();

    assert.throws(() => db.prepare("DELETE FROM CUSTOMER WHERE custNo='C-001'").run(), /FOREIGN KEY constraint failed/);
    assert.throws(() => db.prepare("DELETE FROM PRODUCT WHERE prodCode='P-S2-PH'").run(), /FOREIGN KEY constraint failed/);

    db.prepare("UPDATE CUSTOMER SET status='Inactive',stamp='DELETED test' WHERE custNo='C-001'").run();
    db.prepare("UPDATE PRODUCT SET status='Inactive',stamp='DELETED test' WHERE prodCode='P-S2-PH'").run();
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM SALES WHERE custNo='C-001'").get().count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM SALESDETAIL WHERE prodCode='P-S2-PH'").get().count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM PRICEHIST WHERE prodCode='P-S2-PH'").get().count, 1);
    assert.equal(db.prepare("SELECT status FROM CUSTOMER WHERE custNo='C-001'").get().status, 'Inactive');
    assert.equal(db.prepare("SELECT status FROM PRODUCT WHERE prodCode='P-S2-PH'").get().status, 'Inactive');
  } finally {
    db.close();
  }
});

test('TC-DEL-02: Admin UI contract shades inactive rows and offers Restore instead of Delete', () => {
  const source = fs.readFileSync(path.join(root, 'src/components/CustomerManagement.tsx'), 'utf8');
  assert.match(source, /status === 'Inactive'/);
  assert.match(source, /bg-slate-100/);
  assert.match(source, /status === 'Inactive' && isAdmin \?/);
  assert.match(source, /onClick=\{\(\) => void restoreCustomer\(customer\)\}/);
  assert.match(source, /aria-label=\{`Restore \$\{customer\.custName\}`\}>Restore<\/button>/);
  assert.match(source, /setDeleteCustomer\(customer\)/);
  assert.match(source, /aria-label=\{`Delete \$\{customer\.custName\}`\}>Delete<\/button>/);
});
