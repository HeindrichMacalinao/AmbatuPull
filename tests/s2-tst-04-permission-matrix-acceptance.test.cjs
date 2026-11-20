'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test, beforeEach, afterEach } = require('node:test');
const poolModule = require('../src/db/pool');
const customerService = require('../src/services/customerService');
const productService = require('../src/services/productService');
const { createApp } = require('../src/expressApp');

const root = path.resolve(__dirname, '..');
const deniedUser = { role: 'User', userId: 99, email: 'alex@hope.com' };
const admin = { role: 'Admin', email: 'admin@hope.com' };
let originalGetPool;
let queryHandler;

const fakePool = {
  query: async (sql, params = []) => queryHandler(sql, params),
};

beforeEach(() => {
  originalGetPool = poolModule.getPool;
  poolModule.getPool = () => fakePool;
  queryHandler = async () => ({ rows: [], rowCount: 0 });
});

afterEach(() => {
  poolModule.getPool = originalGetPool;
});

const RIGHTS_MATRIX = [
  {
    right: 'customer.add',
    invoke: () => customerService.createCustomer({
      data: { custNo: 'C-001', custName: 'Customer', payTerms: 'Net 30' },
      requester: deniedUser,
    }),
  },
  {
    right: 'customer.edit',
    invoke: () => customerService.updateCustomer({
      custNo: 'C-001',
      data: { custName: 'Edited Customer' },
      requester: deniedUser,
    }),
  },
  {
    right: 'customer.delete',
    invoke: () => customerService.softDeleteCustomer({ custNo: 'C-001', requester: deniedUser }),
  },
  {
    right: 'product.add',
    invoke: () => productService.createProduct({
      data: { prodCode: 'P-001', description: 'Product', unit: 'pcs' },
      requester: deniedUser,
    }),
  },
  {
    right: 'product.edit',
    invoke: () => productService.updateProduct({
      prodCode: 'P-001',
      data: { description: 'Edited Product' },
      requester: deniedUser,
    }),
  },
  {
    right: 'product.delete',
    invoke: () => productService.softDeleteProduct({ prodCode: 'P-001', requester: deniedUser }),
  },
  {
    right: 'price.add',
    invoke: () => productService.addPrice({
      prodCode: 'P-001',
      effDate: '2026-12-01',
      unitPrice: 10,
      requester: deniedUser,
    }),
  },
  {
    right: 'price.edit',
    invoke: () => productService.updatePrice({
      prodCode: 'P-001',
      effDate: '2026-01-01',
      unitPrice: 10,
      requester: deniedUser,
    }),
  },
  {
    right: 'price.delete',
    invoke: () => productService.softDeletePrice({
      prodCode: 'P-001',
      effDate: '2026-01-01',
      requester: deniedUser,
    }),
  },
];

for (const { right, invoke } of RIGHTS_MATRIX) {
  test(`TC-PERM-${right}: missing ${right} is rejected with 403`, async () => {
    await assert.rejects(
      invoke,
      (error) => error.status === 403 && error.message.includes(right)
    );
  });
}

test('TC-PERM-UI: customer, product, and price controls are guarded by rights', () => {
  const customerSource = fs.readFileSync(path.join(root, 'src/components/CustomerManagement.tsx'), 'utf8');
  const productSource = fs.readFileSync(path.join(root, 'src/components/ProductManagement.tsx'), 'utf8');
  const priceSource = fs.readFileSync(path.join(root, 'src/components/PriceHistoryModal.tsx'), 'utf8');

  for (const right of ['customer.add', 'customer.edit', 'customer.delete']) {
    assert.match(customerSource, new RegExp(right.replace('.', '\\.')));
  }
  for (const right of ['product.add', 'product.edit', 'product.delete']) {
    assert.match(productSource, new RegExp(right.replace('.', '\\.')));
  }
  for (const right of ['price.add', 'price.edit', 'price.delete']) {
    assert.match(productSource + priceSource, new RegExp(right.replace('.', '\\.')));
  }
  assert.match(customerSource, /canDelete/);
  assert.match(priceSource, /canEdit/);
  assert.match(priceSource, /canDelete/);
  assert.match(priceSource, /isAdmin &&.*Add Price/);
});

test('TC-PERM-GAP-01/02: direct customer DELETE and price POST are forbidden', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const customerResponse = await fetch(`${baseUrl}/api/customers/C-001`, {
      method: 'DELETE',
      headers: { 'x-user-role': 'User', 'x-user-id': '99', 'x-user-email': deniedUser.email },
    });
    assert.equal(customerResponse.status, 403);

    const priceResponse = await fetch(`${baseUrl}/api/products/P-001/prices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'User',
        'x-user-id': '99',
        'x-user-email': deniedUser.email,
      },
      body: JSON.stringify({ effDate: '2026-12-01', unitPrice: 10 }),
    });
    assert.equal(priceResponse.status, 403);
  } finally {
    server.close();
  }
});

test('TC-PERM-ADMIN: Admin bypasses granular action rights', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM CUSTOMER WHERE custNo')) return { rows: [], rowCount: 0 };
    if (sql.includes('INSERT INTO CUSTOMER')) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  };
  const created = await customerService.createCustomer({
    data: { custNo: 'C-ADMIN', custName: 'Admin Customer', payTerms: 'Net 30' },
    requester: admin,
  });
  assert.equal(created.status, 'Active');
});
