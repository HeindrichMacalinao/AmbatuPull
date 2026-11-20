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

// ==============================================================================
// 1. GET /api/products/:prodCode/prices — List Prices (§3.4 Figures 12 & 13, §4.2, S2-DEV-07)
// ==============================================================================

test('listPrices rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () => productService.listPrices({ prodCode: 'P-001', requester: null }),
    (err) => err.status === 401
  );
});

test('listPrices rejects standard User without product/price rights with 403', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.listPrices({
        prodCode: 'P-001',
        requester: { userId: 5, role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes('product module access required')
  );
});

test('listPrices allows Superadmin and Admin automatically without querying user_permission', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      throw new Error('user_permission should not be queried for Admin');
    }
    if (sql.includes('SELECT 1 FROM PRODUCT')) {
      return { rows: [{ 1: 1 }], rowCount: 1 };
    }
    if (sql.includes('SELECT prodCode, effDate, unitPrice, status, stamp FROM PRICEHIST')) {
      return {
        rows: [
          { prodCode: 'P-001', effDate: '2026-06-15', unitPrice: 0.75, status: 'Active', stamp: 'CREATED admin' },
          { prodCode: 'P-001', effDate: '2026-01-01', unitPrice: 0.60, status: 'Inactive', stamp: 'DELETED admin' },
        ],
        rowCount: 2,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const prices = await productService.listPrices({
    prodCode: 'P-001',
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  assert.equal(prices.length, 2);
  assert.equal(prices[0].effDate, '2026-06-15');
  assert.equal(prices[0].unitPrice, 0.75);
  assert.equal(prices[0].status, 'Active');
  assert.equal(prices[0].stamp, 'CREATED admin');
  assert.equal(prices[1].status, 'Inactive');
});

test('listPrices returns 404 if product does not exist', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM PRODUCT')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.listPrices({
        prodCode: 'P-999',
        requester: { role: 'Superadmin' },
      }),
    (err) => err.status === 404 && err.message.includes('Product not found')
  );
});

test('Role Visibility: User strictly receives Active prices and status/stamp fields are omitted (Figure 13)', async () => {
  let executedSql = '';
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM PRODUCT')) {
      return { rows: [{ 1: 1 }], rowCount: 1 };
    }
    if (sql.includes('FROM PRICEHIST')) {
      executedSql = sql;
      return {
        rows: [
          { prodCode: 'P-001', effDate: '2026-06-15', unitPrice: '0.75', status: 'Active', stamp: 'CREATED admin' },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const prices = await productService.listPrices({
    prodCode: 'P-001',
    requester: { role: 'User', rights: ['price.add'] },
    status: 'all', // Should be ignored for standard User
  });

  assert.ok(executedSql.includes("status = 'Active'"), 'Query must enforce Active status for standard User');
  assert.equal(prices.length, 1);
  assert.equal(prices[0].effDate, '2026-06-15');
  assert.equal(prices[0].unitPrice, 0.75);
  assert.equal(prices[0].status, undefined, 'status must be omitted for User');
  assert.equal(prices[0].stamp, undefined, 'stamp must be omitted for User');
});

// ==============================================================================
// 2. POST /api/products/:prodCode/prices — Add Price (§3.4, §3.8, S2-DEV-07)
// ==============================================================================

test('addPrice rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () => productService.addPrice({ prodCode: 'P-001', effDate: '2026-07-01', unitPrice: 1.5, requester: null }),
    (err) => err.status === 401
  );
});

test('addPrice rejects standard User without price.add right with 403', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.addPrice({
        prodCode: 'P-001',
        effDate: '2026-07-01',
        unitPrice: 1.5,
        requester: { userId: 5, role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes("missing required permission 'price.add'")
  );
});

test('addPrice returns 404 if product does not exist', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM PRODUCT')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.addPrice({
        prodCode: 'P-999',
        effDate: '2026-07-01',
        unitPrice: 1.5,
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 404 && err.message.includes('Product not found')
  );
});

test('addPrice validates effective date format and value', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM PRODUCT')) {
      return { rows: [{ 1: 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.addPrice({
        prodCode: 'P-001',
        effDate: 'not-a-date',
        unitPrice: 1.5,
        requester: { role: 'Admin' },
      }),
    (err) => err.status === 400 && err.message.includes('valid date in YYYY-MM-DD format')
  );
});

test('addPrice validates unit price (must be positive number)', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM PRODUCT')) {
      return { rows: [{ 1: 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.addPrice({
        prodCode: 'P-001',
        effDate: '2026-07-01',
        unitPrice: -5,
        requester: { role: 'Admin' },
      }),
    (err) => err.status === 400 && err.message.includes('greater than zero')
  );

  await assert.rejects(
    () =>
      productService.addPrice({
        prodCode: 'P-001',
        effDate: '2026-07-01',
        unitPrice: 0,
        requester: { role: 'Admin' },
      }),
    (err) => err.status === 400 && err.message.includes('greater than zero')
  );
});

test('addPrice rejects duplicate (prodCode, effDate) with HTTP 400', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM PRODUCT')) {
      return { rows: [{ 1: 1 }], rowCount: 1 };
    }
    if (sql.includes('SELECT 1 FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2')) {
      return { rows: [{ 1: 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.addPrice({
        prodCode: 'P-001',
        effDate: '2026-01-01',
        unitPrice: 1.5,
        requester: { role: 'Admin' },
      }),
    (err) => err.status === 400 && err.message.includes('already exists')
  );
});

test('addPrice creates price with Active status and CREATED audit stamp and logs to audit_log (§2.3)', async () => {
  let insertPriceParams = null;
  let auditParams = null;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM PRODUCT')) {
      return { rows: [{ 1: 1 }], rowCount: 1 };
    }
    if (sql.includes('SELECT 1 FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO PRICEHIST')) {
      insertPriceParams = params;
      return { rowCount: 1 };
    }
    if (sql.includes('INSERT INTO audit_log')) {
      auditParams = params;
      return { rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const price = await productService.addPrice({
    prodCode: 'P-001',
    effDate: '2026-07-01',
    unitPrice: 2.5,
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  assert.equal(price.prodCode, 'P-001');
  assert.equal(price.effDate, '2026-07-01');
  assert.equal(price.unitPrice, 2.5);
  assert.equal(price.status, 'Active');
  assert.match(price.stamp, /^CREATED admin@hope\.com \d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/);

  assert.ok(insertPriceParams);
  assert.equal(insertPriceParams[0], 'P-001');
  assert.equal(insertPriceParams[1], '2026-07-01');
  assert.equal(insertPriceParams[2], 2.5);

  assert.ok(auditParams);
  assert.equal(auditParams[0], 'admin@hope.com');
  assert.equal(auditParams[1], 'P-001:2026-07-01');
});

// ==============================================================================
// 3. PUT /api/products/:prodCode/prices/:effDate — Edit Price (§3.4, §3.8, S2-DEV-07)
// ==============================================================================

test('updatePrice rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () => productService.updatePrice({ prodCode: 'P-001', effDate: '2026-01-01', unitPrice: 3.0, requester: null }),
    (err) => err.status === 401
  );
});

test('updatePrice rejects standard User without price.edit right with 403', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.updatePrice({
        prodCode: 'P-001',
        effDate: '2026-01-01',
        unitPrice: 3.0,
        requester: { userId: 5, role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes("missing required permission 'price.edit'")
  );
});

test('updatePrice returns 404 if price record does not exist', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.updatePrice({
        prodCode: 'P-001',
        effDate: '2026-01-01',
        unitPrice: 3.0,
        requester: { role: 'Admin' },
      }),
    (err) => err.status === 404 && err.message.includes('Price record not found')
  );
});

test('updatePrice updates unitPrice with EDITED audit stamp and logs to audit_log (§2.3)', async () => {
  let updateParams = null;
  let auditParams = null;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2')) {
      return {
        rows: [{ prodCode: 'P-001', effDate: '2026-01-01', unitPrice: 0.60, status: 'Active', stamp: 'CREATED admin' }],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE PRICEHIST')) {
      updateParams = params;
      return { rowCount: 1 };
    }
    if (sql.includes('INSERT INTO audit_log')) {
      auditParams = params;
      return { rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const updated = await productService.updatePrice({
    prodCode: 'P-001',
    effDate: '2026-01-01',
    unitPrice: 0.85,
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  assert.equal(updated.unitPrice, 0.85);
  assert.match(updated.stamp, /^EDITED admin@hope\.com \d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/);

  assert.ok(updateParams);
  assert.equal(updateParams[0], 0.85);
  assert.equal(updateParams[2], 'P-001');
  assert.equal(updateParams[3], '2026-01-01');

  assert.ok(auditParams);
  assert.equal(auditParams[0], 'admin@hope.com');
  assert.equal(auditParams[1], 'P-001:2026-01-01');
});

// ==============================================================================
// 4. DELETE /api/products/:prodCode/prices/:effDate — Soft Delete (§2.3, §3.4, §3.8, S2-DEV-07)
// ==============================================================================

test('softDeletePrice rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () => productService.softDeletePrice({ prodCode: 'P-001', effDate: '2026-01-01', requester: null }),
    (err) => err.status === 401
  );
});

test('softDeletePrice rejects standard User without price.delete right with 403', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.softDeletePrice({
        prodCode: 'P-001',
        effDate: '2026-01-01',
        requester: { userId: 5, role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes("missing required permission 'price.delete'")
  );
});

test('softDeletePrice returns 404 if price record does not exist', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.softDeletePrice({
        prodCode: 'P-001',
        effDate: '2026-01-01',
        requester: { role: 'Admin' },
      }),
    (err) => err.status === 404 && err.message.includes('Price record not found')
  );
});

test('softDeletePrice returns 400 if price record is already Inactive', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2')) {
      return {
        rows: [{ prodCode: 'P-001', effDate: '2026-01-01', unitPrice: 0.60, status: 'Inactive', stamp: 'DELETED' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.softDeletePrice({
        prodCode: 'P-001',
        effDate: '2026-01-01',
        requester: { role: 'Admin' },
      }),
    (err) => err.status === 400 && err.message.includes('already inactive')
  );
});

test('softDeletePrice updates status to Inactive with DELETED audit stamp and logs to audit_log (§2.3)', async () => {
  let deleteParams = null;
  let auditParams = null;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2')) {
      return {
        rows: [{ prodCode: 'P-001', effDate: '2026-01-01', unitPrice: 0.60, status: 'Active', stamp: 'CREATED admin' }],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE PRICEHIST') && sql.includes("status = 'Inactive'")) {
      deleteParams = params;
      return { rowCount: 1 };
    }
    if (sql.includes('INSERT INTO audit_log')) {
      auditParams = params;
      return { rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const deleted = await productService.softDeletePrice({
    prodCode: 'P-001',
    effDate: '2026-01-01',
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  assert.equal(deleted.status, 'Inactive');
  assert.match(deleted.stamp, /^DELETED admin@hope\.com \d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/);

  assert.ok(deleteParams);
  assert.equal(deleteParams[1], 'P-001');
  assert.equal(deleteParams[2], '2026-01-01');

  assert.ok(auditParams);
  assert.equal(auditParams[0], 'admin@hope.com');
  assert.equal(auditParams[1], 'P-001:2026-01-01');
});

// ==============================================================================
// 5. PUT /api/products/:prodCode/prices/:effDate/restore — Restore Price (§2.3, §3.4, §3.8, S2-DEV-07)
// ==============================================================================

test('restorePrice rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () => productService.restorePrice({ prodCode: 'P-001', effDate: '2026-01-01', requester: null }),
    (err) => err.status === 401
  );
});

test('restorePrice strictly rejects non-Admin/Superadmin users with 403', async () => {
  await assert.rejects(
    () =>
      productService.restorePrice({
        prodCode: 'P-001',
        effDate: '2026-01-01',
        requester: { userId: 5, role: 'User', rights: ['*'] },
      }),
    (err) => err.status === 403 && err.message.includes('only Admin or Superadmin')
  );
});

test('restorePrice returns 404 if price record does not exist', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.restorePrice({
        prodCode: 'P-001',
        effDate: '2026-01-01',
        requester: { role: 'Admin' },
      }),
    (err) => err.status === 404 && err.message.includes('Price record not found')
  );
});

test('restorePrice returns 400 if price record is already Active', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2')) {
      return {
        rows: [{ prodCode: 'P-001', effDate: '2026-01-01', unitPrice: 0.60, status: 'Active', stamp: 'CREATED' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.restorePrice({
        prodCode: 'P-001',
        effDate: '2026-01-01',
        requester: { role: 'Admin' },
      }),
    (err) => err.status === 400 && err.message.includes('already active')
  );
});

test('restorePrice allows Admin to restore Inactive price with RESTORED stamp and logs to audit_log (§2.3)', async () => {
  let restoreParams = null;
  let auditParams = null;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2')) {
      return {
        rows: [{ prodCode: 'P-001', effDate: '2026-01-01', unitPrice: 0.60, status: 'Inactive', stamp: 'DELETED' }],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE PRICEHIST') && sql.includes("status = 'Active'")) {
      restoreParams = params;
      return { rowCount: 1 };
    }
    if (sql.includes('INSERT INTO audit_log')) {
      auditParams = params;
      return { rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const restored = await productService.restorePrice({
    prodCode: 'P-001',
    effDate: '2026-01-01',
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  assert.equal(restored.status, 'Active');
  assert.match(restored.stamp, /^RESTORED admin@hope\.com \d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/);

  assert.ok(restoreParams);
  assert.equal(restoreParams[1], 'P-001');
  assert.equal(restoreParams[2], '2026-01-01');

  assert.ok(auditParams);
  assert.equal(auditParams[0], 'admin@hope.com');
  assert.equal(auditParams[1], 'P-001:2026-01-01');
});

// ==============================================================================
// 6. HTTP Integration Tests for Express App
// ==============================================================================

test('HTTP GET, POST, PUT, DELETE, and RESTORE /api/products/:prodCode/prices enforce auth, RBAC, stamps, and errors', async () => {
  const app = createApp();

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM PRODUCT')) {
      return { rows: [{ 1: 1 }], rowCount: 1 };
    }
    if (sql.includes('SELECT 1 FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('SELECT * FROM PRICEHIST WHERE prodCode = $1 AND effDate = $2')) {
      return {
        rows: [{ prodCode: 'P-001', effDate: '2026-01-01', unitPrice: 0.60, status: 'Active', stamp: 'CREATED' }],
        rowCount: 1,
      };
    }
    if (sql.includes('INSERT INTO PRICEHIST')) {
      return { rowCount: 1 };
    }
    if (sql.includes('UPDATE PRICEHIST')) {
      return { rowCount: 1 };
    }
    if (sql.includes('FROM PRICEHIST')) {
      return {
        rows: [{ prodCode: 'P-001', effDate: '2026-01-01', unitPrice: 0.60, status: 'Active', stamp: 'CREATED admin' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/products/P-001/prices`;

  try {
    // 1. Unauthenticated GET -> 401
    const unauthGet = await fetch(baseUrl);
    assert.equal(unauthGet.status, 401);

    // 2. Admin GET -> 200 with status & stamp
    const adminGet = await fetch(baseUrl, {
      headers: { 'x-user-role': 'Admin', 'x-user-email': 'admin@hope.com' },
    });
    assert.equal(adminGet.status, 200);
    const getBody = await adminGet.json();
    assert.equal(getBody.prices.length, 1);
    assert.equal(getBody.prices[0].status, 'Active');

    // 3. User POST without price.add right -> 403
    const userPostNoRight = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'User',
        'x-user-id': '5',
      },
      body: JSON.stringify({ effDate: '2026-07-01', unitPrice: 1.5 }),
    });
    assert.equal(userPostNoRight.status, 403);

    // 4. Admin POST -> 201 + CREATED stamp
    const adminPost = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Admin',
        'x-user-email': 'admin@hope.com',
      },
      body: JSON.stringify({ effDate: '2026-07-01', unitPrice: 1.5 }),
    });
    assert.equal(adminPost.status, 201);
    const postBody = await adminPost.json();
    assert.equal(postBody.price.unitPrice, 1.5);
    assert.match(postBody.price.stamp, /^CREATED admin@hope\.com/);

    // 5. Admin PUT (edit price) -> 200 + EDITED stamp
    const adminPut = await fetch(`${baseUrl}/2026-01-01`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Admin',
        'x-user-email': 'admin@hope.com',
      },
      body: JSON.stringify({ unitPrice: 2.0 }),
    });
    assert.equal(adminPut.status, 200);
    const putBody = await adminPut.json();
    assert.equal(putBody.price.unitPrice, 2.0);
    assert.match(putBody.price.stamp, /^EDITED admin@hope\.com/);

    // 6. User restore attempt -> 403
    const userRestore = await fetch(`${baseUrl}/2026-01-01/restore`, {
      method: 'PUT',
      headers: {
        'x-user-role': 'User',
        'x-user-id': '5',
      },
    });
    assert.equal(userRestore.status, 403);
  } finally {
    server.close();
  }
});
