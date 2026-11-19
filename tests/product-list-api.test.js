'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const poolModule = require('../src/db/pool');
const productService = require('../src/services/productService');
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

const sampleProducts = [
  {
    prodCode: 'P-001',
    description: 'Product One',
    unit: 'Each',
    status: 'Active',
    stamp: 'ADD seed 2026-10-28',
    currentPrice: 0.75,
  },
  {
    prodCode: 'P-002',
    description: 'Product Two',
    unit: 'Box',
    status: 'Active',
    stamp: 'ADD seed 2026-10-28',
    currentPrice: 0.50,
  },
  {
    prodCode: 'P-003',
    description: 'Product Three (Zero Price)',
    unit: 'Each',
    status: 'Active',
    stamp: 'ADD seed 2026-10-28',
    currentPrice: 0,
  },
  {
    prodCode: 'P-004',
    description: 'Product Four (No Price)',
    unit: 'Each',
    status: 'Active',
    stamp: 'ADD seed 2026-10-28',
    currentPrice: null,
  },
  {
    prodCode: 'P-005',
    description: 'Product Five (Inactive)',
    unit: 'Set',
    status: 'Inactive',
    stamp: 'DELETED admin@hope.com 2026-11-01',
    currentPrice: 0.35,
  },
];

// ==============================================================================
// 1. Authorization & Access Control (§4.2, S2-DEV-04)
// ==============================================================================

test('listProducts rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () => productService.listProducts({ requester: null }),
    (err) => err.status === 401
  );
});

test('listProducts rejects standard User without product/price rights with 403', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.listProducts({
        requester: { userId: 5, role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes('product module access required')
  );
});

test('listProducts allows Superadmin and Admin automatically without querying user_permission', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('FROM PRODUCT')) {
      return { rows: sampleProducts.filter((p) => p.status === 'Active'), rowCount: 4 };
    }
    return { rows: [], rowCount: 0 };
  };

  const adminList = await productService.listProducts({
    requester: { userId: 1, role: 'Admin', email: 'admin@hope.com' },
  });
  assert.equal(adminList.length, 4);

  const permissionQueries = mockQueries.filter((q) => q.sql.includes('user_permission'));
  assert.equal(permissionQueries.length, 0, 'Admin must not query user_permission');

  const superList = await productService.listProducts({
    requester: { userId: 2, role: 'Superadmin', email: 'super@hope.com' },
  });
  assert.equal(superList.length, 4);
});

test('listProducts allows standard User when product right is active', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }
    if (sql.includes('FROM PRODUCT')) {
      return { rows: sampleProducts.filter((p) => p.status === 'Active'), rowCount: 4 };
    }
    return { rows: [], rowCount: 0 };
  };

  const userList = await productService.listProducts({
    requester: { userId: 5, role: 'User', email: 'user@hope.com' },
  });
  assert.equal(userList.length, 4);
});

// ==============================================================================
// 2. Dynamic Current Price Calculation (§2.5, §3.4 Figures 11 & 14, S2-DEV-04)
// ==============================================================================

test('listProducts includes derived currentPrice, supports zero price, and returns null when no price', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('FROM PRODUCT')) {
      return { rows: sampleProducts.filter((p) => p.status === 'Active'), rowCount: 4 };
    }
    return { rows: [], rowCount: 0 };
  };

  const products = await productService.listProducts({
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  const p1 = products.find((p) => p.prodCode === 'P-001');
  assert.equal(p1.currentPrice, 0.75);

  const p3 = products.find((p) => p.prodCode === 'P-003');
  assert.equal(p3.currentPrice, 0, 'Zero must be preserved as 0, not null');

  const p4 = products.find((p) => p.prodCode === 'P-004');
  assert.equal(p4.currentPrice, null, 'Product without price history must return null (displays — in UI)');
});

// ==============================================================================
// 3. Role-Based Visibility Rules (§3.4, §4.2, S2-DEV-04)
// ==============================================================================

test('Role Visibility: User strictly receives Active products and status/stamp fields are omitted', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('FROM PRODUCT')) {
      // Return both active and inactive from mock
      return { rows: sampleProducts, rowCount: sampleProducts.length };
    }
    return { rows: [], rowCount: 0 };
  };

  const userProducts = await productService.listProducts({
    requester: { userId: 5, role: 'User', email: 'user@hope.com', rights: ['product.add'] },
  });

  // Verify status = 'Active' was included in SQL query
  const selectQuery = mockQueries.find((q) => q.sql.includes('FROM PRODUCT'));
  assert.ok(selectQuery.sql.includes("p.status = 'Active'"));

  // Verify columns omitted in returned objects
  for (const item of userProducts) {
    assert.equal(item.status, undefined, 'User view must NOT expose status column');
    assert.equal(item.stamp, undefined, 'User view must NOT expose stamp column');
    assert.ok(item.prodCode);
    assert.ok(item.description);
  }
});

test('Role Visibility: User ignores status=all or status=inactive parameters', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('FROM PRODUCT')) {
      return { rows: sampleProducts.filter((p) => p.status === 'Active'), rowCount: 4 };
    }
    return { rows: [], rowCount: 0 };
  };

  await productService.listProducts({
    requester: { userId: 5, role: 'User', email: 'user@hope.com', rights: ['product.add'] },
    status: 'inactive',
  });

  const queryWithInactive = mockQueries.find((q) => q.sql.includes('FROM PRODUCT'));
  assert.ok(queryWithInactive.sql.includes("p.status = 'Active'"), 'User must strictly query Active records');
  assert.ok(!queryWithInactive.sql.includes("p.status = 'Inactive'"));
});

test('Role Visibility: Admin receives active, inactive, or all products with status and stamp', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('FROM PRODUCT')) {
      return { rows: sampleProducts, rowCount: sampleProducts.length };
    }
    return { rows: [], rowCount: 0 };
  };

  // 1. Admin status='all'
  mockQueries = [];
  const allProducts = await productService.listProducts({
    requester: { role: 'Admin', email: 'admin@hope.com' },
    status: 'all',
  });
  const allQuery = mockQueries.find((q) => q.sql.includes('FROM PRODUCT'));
  assert.ok(!allQuery.sql.includes('p.status ='), 'status=all should not filter by status');

  for (const item of allProducts) {
    assert.ok(item.status !== undefined, 'Admin must see status column');
    assert.ok(item.stamp !== undefined, 'Admin must see stamp column');
  }

  // 2. Admin status='inactive'
  mockQueries = [];
  await productService.listProducts({
    requester: { role: 'Admin', email: 'admin@hope.com' },
    status: 'inactive',
  });
  const inactiveQuery = mockQueries.find((q) => q.sql.includes('FROM PRODUCT'));
  assert.ok(inactiveQuery.sql.includes("p.status = 'Inactive'"));
});

// ==============================================================================
// 4. Live Search Filter (§3.4, S2-DEV-04)
// ==============================================================================

test('Live Search: filters matching prodCode or description (case-insensitive)', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('FROM PRODUCT')) {
      assert.ok(sql.includes('LOWER(p.prodCode) LIKE $1 OR LOWER(p.description) LIKE $1'));
      assert.equal(params[0], '%toshiba%');
      return {
        rows: [
          { prodCode: 'AD0001', description: 'Toshiba Canvio 1 TB', unit: 'Each', status: 'Active', stamp: 'ADD', currentPrice: 58 },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const results = await productService.listProducts({
    requester: { role: 'Admin', email: 'admin@hope.com' },
    search: 'Toshiba',
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].prodCode, 'AD0001');
});

// ==============================================================================
// 5. getProductByCode (§3.4)
// ==============================================================================

test('getProductByCode returns product details and enforces role visibility', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('WHERE p.prodCode = $1')) {
      const code = params[0];
      const match = sampleProducts.find((p) => p.prodCode === code);
      return match ? { rows: [match], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  // 1. Admin gets active product with status & stamp
  const adminActive = await productService.getProductByCode({
    prodCode: 'P-001',
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });
  assert.equal(adminActive.prodCode, 'P-001');
  assert.equal(adminActive.currentPrice, 0.75);
  assert.equal(adminActive.status, 'Active');
  assert.ok(adminActive.stamp);

  // 2. User gets active product without status & stamp
  const userActive = await productService.getProductByCode({
    prodCode: 'P-001',
    requester: { userId: 5, role: 'User', email: 'user@hope.com', rights: ['product.add'] },
  });
  assert.equal(userActive.prodCode, 'P-001');
  assert.equal(userActive.currentPrice, 0.75);
  assert.equal(userActive.status, undefined);
  assert.equal(userActive.stamp, undefined);

  // 3. User requesting Inactive product gets 404
  await assert.rejects(
    () =>
      productService.getProductByCode({
        prodCode: 'P-005',
        requester: { userId: 5, role: 'User', email: 'user@hope.com', rights: ['product.add'] },
      }),
    (err) => err.status === 404
  );

  // 4. Admin requesting Inactive product succeeds
  const adminInactive = await productService.getProductByCode({
    prodCode: 'P-005',
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });
  assert.equal(adminInactive.prodCode, 'P-005');
  assert.equal(adminInactive.status, 'Inactive');

  // 5. Nonexistent product -> 404
  await assert.rejects(
    () =>
      productService.getProductByCode({
        prodCode: 'NONEXISTENT',
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 404
  );
});

// ==============================================================================
// 6. Express HTTP Integration: GET /api/products
// ==============================================================================

test('HTTP GET /api/products enforces auth, permissions, status tabs, search, and visibility', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      const userId = params ? params[0] : null;
      if (userId === 99) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }
    if (sql.includes('FROM PRODUCT')) {
      return { rows: sampleProducts, rowCount: sampleProducts.length };
    }
    return { rows: [], rowCount: 0 };
  };

  try {
    // 1. Unauthenticated -> 401
    const unauthRes = await fetch(`${baseUrl}/api/products`);
    assert.equal(unauthRes.status, 401);

    // 2. User without rights -> 403
    const forbiddenRes = await fetch(`${baseUrl}/api/products`, {
      headers: {
        'x-user-role': 'User',
        'x-user-id': '99',
        'x-user-email': 'norights@hope.com',
      },
    });
    assert.equal(forbiddenRes.status, 403);

    // 3. User with rights -> 200, status and stamp omitted
    const userRes = await fetch(`${baseUrl}/api/products`, {
      headers: {
        'x-user-role': 'User',
        'x-user-id': '5',
        'x-user-email': 'user@hope.com',
      },
    });
    assert.equal(userRes.status, 200);
    const userBody = await userRes.json();
    assert.ok(Array.isArray(userBody.products));
    assert.ok(userBody.products.length > 0);
    assert.equal(userBody.products[0].status, undefined);
    assert.equal(userBody.products[0].stamp, undefined);

    // 4. Admin -> 200, status and stamp included
    const adminRes = await fetch(`${baseUrl}/api/products?status=all`, {
      headers: {
        'x-user-role': 'Admin',
        'x-user-email': 'admin@hope.com',
      },
    });
    assert.equal(adminRes.status, 200);
    const adminBody = await adminRes.json();
    assert.ok(Array.isArray(adminBody.products));
    assert.ok(adminBody.products[0].status !== undefined);
    assert.ok(adminBody.products[0].stamp !== undefined);
  } finally {
    server.close();
  }
});
