'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const poolModule = require('../src/db/pool');
const { createApp } = require('../src/expressApp');

let mockQueries = [];
let queryHandler = null;

const fakePool = {
  query: async (sql, params = []) => {
    mockQueries.push({ sql, params });
    if (queryHandler) {
      return queryHandler(sql, params);
    }
    return { rows: [], rowCount: 0 };
  },
};

let originalGetPool;

beforeEach(() => {
  mockQueries = [];
  queryHandler = null;
  originalGetPool = poolModule.getPool;
  poolModule.getPool = () => fakePool;
});

afterEach(() => {
  poolModule.getPool = originalGetPool;
});

// ==============================================================================
// 1. Session Endpoint Rights Verification (§3.8, S2-DEV-08)
// ==============================================================================

test('GET /api/auth/session returns user identity and active granted rights', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/auth/session`;

  try {
    // 1. Unauthenticated -> 401
    const unauth = await fetch(baseUrl);
    assert.equal(unauth.status, 401);

    // 2. Standard user with attached rights header
    const userRes = await fetch(baseUrl, {
      headers: {
        'x-user-role': 'User',
        'x-user-id': '7',
        'x-user-email': 'alex@hope.com',
        'x-user-rights': JSON.stringify(['customer.add', 'product.view']),
      },
    });
    assert.equal(userRes.status, 200);
    const body = await userRes.json();
    assert.equal(body.role, 'User');
    assert.deepEqual(body.rights, ['customer.add', 'product.view']);
  } finally {
    server.close();
  }
});

// ==============================================================================
// 2. Per-Action Rights Matrix Enforcement for All 9 Rights (§3.8, §4.2, S2-DEV-08)
// ==============================================================================

const RIGHTS_MATRIX = [
  // Customer module (3 rights)
  {
    module: 'Customer',
    right: 'customer.add',
    method: 'POST',
    path: '/api/customers',
    body: { custNo: 'C-999', custName: 'Acme Corp', address: '123 Test St', payTerms: 'Net 30' },
  },
  {
    module: 'Customer',
    right: 'customer.edit',
    method: 'PUT',
    path: '/api/customers/C-001',
    body: { custName: 'Updated Acme', address: '456 New St', payTerms: 'Net 15' },
  },
  {
    module: 'Customer',
    right: 'customer.delete',
    method: 'DELETE',
    path: '/api/customers/C-001',
    body: null,
  },
  // Product module (6 rights)
  {
    module: 'Product',
    right: 'product.add',
    method: 'POST',
    path: '/api/products',
    body: { prodCode: 'P-999', description: 'Widget', unit: 'pcs' },
  },
  {
    module: 'Product',
    right: 'product.edit',
    method: 'PUT',
    path: '/api/products/P-001',
    body: { description: 'Updated Widget', unit: 'box' },
  },
  {
    module: 'Product',
    right: 'product.delete',
    method: 'DELETE',
    path: '/api/products/P-001',
    body: null,
  },
  {
    module: 'Product',
    right: 'price.add',
    method: 'POST',
    path: '/api/products/P-001/prices',
    body: { effDate: '2026-12-15', unitPrice: 9.99 },
  },
  {
    module: 'Product',
    right: 'price.edit',
    method: 'PUT',
    path: '/api/products/P-001/prices/2026-01-01',
    body: { unitPrice: 12.50 },
  },
  {
    module: 'Product',
    right: 'price.delete',
    method: 'DELETE',
    path: '/api/products/P-001/prices/2026-01-01',
    body: null,
  },
];

for (const item of RIGHTS_MATRIX) {
  test(`[Rights Matrix] Direct ${item.method} ${item.path} strictly enforces '${item.right}' (403 without right, 20x with right)`, async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}${item.path}`;

    queryHandler = async (sql, params) => {
      // 1. Module access check (user 99 and 77 both have general module access)
      if (sql.includes('SELECT 1 FROM user_permission') && (sql.includes('product.%') || sql.includes('customer.%'))) {
        return { rows: [{ 1: 1 }], rowCount: 1 };
      }
      // 2. Specific granular right check
      if (sql.includes('SELECT 1 FROM user_permission') && sql.includes('rightCode = $2')) {
        const userId = Number(params[0]);
        const checkedRight = params[1];
        // User 77 has the right, User 99 does NOT
        if (userId === 77 && checkedRight === item.right) {
          return { rows: [{ 1: 1 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      // 3. Customer existence checks
      if (sql.includes('SELECT 1 FROM CUSTOMER WHERE custNo = $1') || sql.includes('SELECT * FROM CUSTOMER WHERE custNo = $1')) {
        if (params[0] === 'C-999') {
          return { rows: [], rowCount: 0 }; // Not existing, allows creation
        }
        return { rows: [{ custNo: 'C-001', custName: 'Acme', address: 'Main St', payTerms: 'Net 30', status: 'Active' }], rowCount: 1 };
      }
      // 4. Product existence checks
      if (sql.includes('SELECT 1 FROM PRODUCT WHERE prodCode = $1') || sql.includes('SELECT * FROM PRODUCT WHERE prodCode = $1')) {
        if (params[0] === 'P-999') {
          return { rows: [], rowCount: 0 }; // Not existing, allows creation
        }
        return { rows: [{ prodCode: 'P-001', description: 'Widget', unit: 'pcs', status: 'Active' }], rowCount: 1 };
      }
      // 5. Price existence checks
      if (sql.includes('SELECT 1 FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2')) {
        if (item.method === 'POST') {
          return { rows: [], rowCount: 0 }; // Not duplicate
        }
        return { rows: [{ 1: 1 }], rowCount: 1 };
      }
      if (sql.includes('SELECT * FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2')) {
        return { rows: [{ prodCode: 'P-001', effDate: '2026-01-01', unitPrice: 5.0, status: 'Active' }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO') || sql.includes('UPDATE')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };

    try {
      // Case A: User WITHOUT the required right -> Server must return HTTP 403 Forbidden (§4.2)
      const forbiddenReq = await fetch(url, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'User',
          'x-user-id': '99',
        },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });
      assert.equal(
        forbiddenReq.status,
        403,
        `Expected HTTP 403 Forbidden when calling ${item.method} ${item.path} without right '${item.right}', got ${forbiddenReq.status}`
      );
      const errJson = await forbiddenReq.json();
      assert.ok(
        errJson.error.includes(item.right) || errJson.error.includes('Forbidden') || errJson.error.includes('access required'),
        `Error response should indicate missing right or forbidden: ${errJson.error}`
      );

      // Case B: User WITH the required right -> Server permits action (200 or 201)
      const allowedReq = await fetch(url, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'User',
          'x-user-id': '77',
        },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });
      assert.ok(
        allowedReq.status === 200 || allowedReq.status === 201,
        `Expected HTTP 200 or 201 when calling ${item.method} ${item.path} with right '${item.right}', got ${allowedReq.status}`
      );

      // Case C: Admin bypasses granular right check automatically
      const adminReq = await fetch(url, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'Admin',
          'x-user-email': 'admin@hope.com',
        },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });
      assert.ok(
        adminReq.status === 200 || adminReq.status === 201,
        `Expected Admin to bypass granular check for ${item.method} ${item.path}, got ${adminReq.status}`
      );
    } finally {
      server.close();
    }
  });
}

// ==============================================================================
// 3. Dynamic Current Price Calculation Verification (§3.4, S2-DEV-08)
// ==============================================================================

test('Current price calculation updates dynamically when price records change', async () => {
  const productService = require('../src/services/productService');

  let activePrice = 0.75;
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM PRODUCT')) {
      return { rows: [{ 1: 1 }], rowCount: 1 };
    }
    if (sql.includes('FROM PRODUCT')) {
      return {
        rows: [
          {
            prodCode: 'P-001',
            description: 'Widget',
            unit: 'pcs',
            status: 'Active',
            currentPrice: activePrice,
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  // Initially 0.75
  const initialProducts = await productService.listProducts({
    requester: { role: 'Admin' },
  });
  assert.equal(initialProducts[0].currentPrice, 0.75);

  // Price updated to 1.25
  activePrice = 1.25;
  const updatedProducts = await productService.listProducts({
    requester: { role: 'Admin' },
  });
  assert.equal(updatedProducts[0].currentPrice, 1.25);
});
