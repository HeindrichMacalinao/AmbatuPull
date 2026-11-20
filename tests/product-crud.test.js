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
// 1. POST /api/products — Create Product Permissions (§3.8, §4.2, S2-DEV-05)
// ==============================================================================

test('createProduct rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () =>
      productService.createProduct({
        data: { prodCode: 'P-001', description: 'Widget', unit: 'pcs' },
        requester: null,
      }),
    (err) => err.status === 401
  );
});

test('createProduct rejects standard User without product.add right with 403', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.createProduct({
        data: { prodCode: 'P-001', description: 'Widget', unit: 'pcs' },
        requester: { userId: 5, role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes("missing required permission 'product.add'")
  );
});

test('createProduct allows Superadmin and Admin automatically without querying user_permission', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM PRODUCT WHERE prodCode')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO PRODUCT')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const adminResult = await productService.createProduct({
    data: { prodCode: 'P-001', description: 'Admin Widget', unit: 'pcs' },
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });
  assert.equal(adminResult.prodCode, 'P-001');
  assert.equal(adminResult.status, 'Active');
  assert.ok(adminResult.stamp.startsWith('CREATED admin@hope.com'));

  const superResult = await productService.createProduct({
    data: { prodCode: 'P-002', description: 'Super Widget', unit: 'box' },
    requester: { role: 'Superadmin', email: 'super@hope.com' },
  });
  assert.equal(superResult.prodCode, 'P-002');
  assert.equal(superResult.status, 'Active');
  assert.ok(superResult.stamp.startsWith('CREATED super@hope.com'));
});

test('createProduct allows standard User when product.add right is active', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }
    if (sql.includes('SELECT 1 FROM PRODUCT WHERE prodCode')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO PRODUCT')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const userResult = await productService.createProduct({
    data: { prodCode: 'P-003', description: 'User Widget', unit: 'can' },
    requester: { userId: 10, role: 'User', email: 'worker@hope.com' },
  });
  assert.equal(userResult.prodCode, 'P-003');
  assert.equal(userResult.status, 'Active');
  assert.ok(userResult.stamp.startsWith('CREATED worker@hope.com'));
});

// ==============================================================================
// 2. POST /api/products — Payload & Packaging Unit Validation (§2.2, S2-DEV-05)
// ==============================================================================

test('createProduct validates payload structure, prodCode format, and length', async () => {
  const admin = { role: 'Admin', email: 'admin@hope.com' };

  // Null data
  await assert.rejects(
    () => productService.createProduct({ data: null, requester: admin }),
    (err) => err.status === 400 && err.message.includes('valid JSON object')
  );

  // Missing prodCode
  await assert.rejects(
    () => productService.createProduct({ data: { description: 'No code', unit: 'pcs' }, requester: admin }),
    (err) => err.status === 400 && err.message.includes('Product code is required')
  );

  // prodCode > 10 chars
  await assert.rejects(
    () =>
      productService.createProduct({
        data: { prodCode: 'TOOLONGACODE123', description: 'Long', unit: 'pcs' },
        requester: admin,
      }),
    (err) => err.status === 400 && err.message.includes('must not exceed 10 characters')
  );

  // prodCode invalid chars
  await assert.rejects(
    () =>
      productService.createProduct({
        data: { prodCode: 'P 001!', description: 'Invalid Format', unit: 'pcs' },
        requester: admin,
      }),
    (err) => err.status === 400 && err.message.includes('alphanumeric')
  );

  // Missing description
  await assert.rejects(
    () =>
      productService.createProduct({
        data: { prodCode: 'P-004', description: '', unit: 'pcs' },
        requester: admin,
      }),
    (err) => err.status === 400 && err.message.includes('Description is required')
  );

  // Description > 100 chars
  await assert.rejects(
    () =>
      productService.createProduct({
        data: { prodCode: 'P-004', description: 'x'.repeat(101), unit: 'pcs' },
        requester: admin,
      }),
    (err) => err.status === 400 && err.message.includes('must not exceed 100 characters')
  );
});

test('createProduct validates packaging unit against approved list and normalizes casing', async () => {
  const admin = { role: 'Admin', email: 'admin@hope.com' };

  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM PRODUCT WHERE prodCode')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO PRODUCT')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  // Missing unit
  await assert.rejects(
    () =>
      productService.createProduct({
        data: { prodCode: 'P-005', description: 'No Unit' },
        requester: admin,
      }),
    (err) => err.status === 400 && err.message.includes('Packaging unit is required')
  );

  // Invalid unit (e.g. 'liter', 'ea')
  await assert.rejects(
    () =>
      productService.createProduct({
        data: { prodCode: 'P-005', description: 'Bad Unit', unit: 'liter' },
        requester: admin,
      }),
    (err) => err.status === 400 && err.message.includes('Invalid packaging unit')
  );

  // Valid unit with mixed casing (e.g. 'PCS' -> 'pcs', 'license' -> 'License')
  const res1 = await productService.createProduct({
    data: { prodCode: 'P-005', description: 'Widget', unit: 'PCS' },
    requester: admin,
  });
  assert.equal(res1.unit, 'pcs');

  const res2 = await productService.createProduct({
    data: { prodCode: 'P-006', description: 'Software', unit: 'license' },
    requester: admin,
  });
  assert.equal(res2.unit, 'License');
});

test('createProduct rejects duplicate prodCode with 409 Conflict', async () => {
  const admin = { role: 'Admin', email: 'admin@hope.com' };

  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM PRODUCT WHERE prodCode')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.createProduct({
        data: { prodCode: 'AD0001', description: 'Existing item', unit: 'pcs' },
        requester: admin,
      }),
    (err) => err.status === 409 && err.message.includes("Product with code 'AD0001' already exists")
  );
});

test('createProduct writes audit_log and returns created product', async () => {
  const admin = { role: 'Admin', email: 'admin@hope.com' };

  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM PRODUCT WHERE prodCode')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO PRODUCT')) {
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO audit_log')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const product = await productService.createProduct({
    data: { prodCode: 'P-007', description: 'Audited Product', unit: 'meter' },
    requester: admin,
  });

  assert.equal(product.prodCode, 'P-007');
  assert.equal(product.description, 'Audited Product');
  assert.equal(product.unit, 'meter');
  assert.equal(product.status, 'Active');
  assert.ok(product.stamp.startsWith('CREATED admin@hope.com'));

  const auditQuery = mockQueries.find((q) => q.sql.includes('INSERT INTO audit_log'));
  assert.ok(auditQuery);
  assert.equal(auditQuery.params[0], 'admin@hope.com');
  assert.equal(auditQuery.params[1], 'P-007');
});

// ==============================================================================
// 3. PUT /api/products/:prodCode — Edit Product Permissions & Logic (§3.8, S2-DEV-05)
// ==============================================================================

test('updateProduct rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () =>
      productService.updateProduct({
        prodCode: 'P-001',
        data: { description: 'Updated' },
        requester: null,
      }),
    (err) => err.status === 401
  );
});

test('updateProduct rejects standard User without product.edit right with 403', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.updateProduct({
        prodCode: 'P-001',
        data: { description: 'Updated' },
        requester: { userId: 5, role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes("missing required permission 'product.edit'")
  );
});

test('updateProduct returns 404 when product is not found', async () => {
  const admin = { role: 'Admin', email: 'admin@hope.com' };

  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRODUCT WHERE prodCode')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.updateProduct({
        prodCode: 'NONEXISTENT',
        data: { description: 'Updated' },
        requester: admin,
      }),
    (err) => err.status === 404 && err.message.includes('Product not found')
  );
});

test('updateProduct allows standard User when product.edit right is active and validates unit', async () => {
  const user = { userId: 7, role: 'User', email: 'editor@hope.com' };

  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }
    if (sql.includes('SELECT * FROM PRODUCT WHERE prodCode')) {
      return {
        rows: [{ prodCode: 'P-001', description: 'Original', unit: 'pcs', status: 'Active', stamp: 'ORIGINAL' }],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE PRODUCT')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  // Invalid unit on edit
  await assert.rejects(
    () =>
      productService.updateProduct({
        prodCode: 'P-001',
        data: { unit: 'invalidUnit' },
        requester: user,
      }),
    (err) => err.status === 400 && err.message.includes('Invalid packaging unit')
  );

  // Successful update
  const updated = await productService.updateProduct({
    prodCode: 'P-001',
    data: { description: 'Updated Description', unit: 'box' },
    requester: user,
  });

  assert.equal(updated.prodCode, 'P-001');
  assert.equal(updated.description, 'Updated Description');
  assert.equal(updated.unit, 'box');
  assert.ok(updated.stamp.startsWith('EDITED editor@hope.com'));

  const updateQuery = mockQueries.find((q) => q.sql.includes('UPDATE PRODUCT'));
  assert.ok(updateQuery);
  assert.equal(updateQuery.params[0], 'Updated Description');
  assert.equal(updateQuery.params[1], 'box');
  assert.equal(updateQuery.params[3], 'P-001');
});

test('updateProduct writes audit_log with before and after states', async () => {
  const admin = { role: 'Admin', email: 'admin@hope.com' };

  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRODUCT WHERE prodCode')) {
      return {
        rows: [{ prodCode: 'P-001', description: 'Old Description', unit: 'pcs', status: 'Active', stamp: 'OLD_STAMP' }],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE PRODUCT')) {
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO audit_log')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  await productService.updateProduct({
    prodCode: 'P-001',
    data: { description: 'New Description', unit: 'kg' },
    requester: admin,
  });

  const auditQuery = mockQueries.find((q) => q.sql.includes('INSERT INTO audit_log'));
  assert.ok(auditQuery);
  assert.equal(auditQuery.params[0], 'admin@hope.com');
  assert.equal(auditQuery.params[1], 'P-001');

  const details = JSON.parse(auditQuery.params[2]);
  assert.equal(details.before.description, 'Old Description');
  assert.equal(details.before.unit, 'pcs');
  assert.equal(details.after.description, 'New Description');
  assert.equal(details.after.unit, 'kg');
});

// ==============================================================================
// 4. Express HTTP Integration: POST and PUT /api/products
// ==============================================================================

test('HTTP POST & PUT /api/products enforce authentication, rights, and validation', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      if (sql.includes("LIKE 'product.%'")) {
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }
      const rightCode = params[1];
      // User 20 has product.add but not product.edit
      if (rightCode === 'product.add') {
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('SELECT 1 FROM PRODUCT WHERE prodCode')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('SELECT * FROM PRODUCT WHERE prodCode')) {
      return {
        rows: [{ prodCode: 'P-HTTP', description: 'Desc', unit: 'pcs', status: 'Active', stamp: 'STAMP' }],
        rowCount: 1,
      };
    }
    if (sql.includes('INSERT INTO PRODUCT') || sql.includes('UPDATE PRODUCT')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  try {
    // 1. POST unauthenticated -> 401
    const unauthPost = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prodCode: 'P-001', description: 'Widget', unit: 'pcs' }),
    });
    assert.equal(unauthPost.status, 401);

    // 2. POST standard user with product.add -> 201
    const authPost = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'User',
        'x-user-id': '20',
        'x-user-email': 'adder@hope.com',
      },
      body: JSON.stringify({ prodCode: 'P-001', description: 'Widget', unit: 'pcs' }),
    });
    assert.equal(authPost.status, 201);
    const postBody = await authPost.json();
    assert.equal(postBody.prodCode, 'P-001');
    assert.equal(postBody.status, 'Active');

    // 3. PUT standard user without product.edit -> 403
    const forbiddenPut = await fetch(`${baseUrl}/api/products/P-HTTP`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'User',
        'x-user-id': '20',
        'x-user-email': 'adder@hope.com',
      },
      body: JSON.stringify({ description: 'Updated' }),
    });
    assert.equal(forbiddenPut.status, 403);

    // 4. PUT Admin -> 200
    const adminPut = await fetch(`${baseUrl}/api/products/P-HTTP`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Admin',
        'x-user-email': 'admin@hope.com',
      },
      body: JSON.stringify({ description: 'Updated by Admin', unit: 'set' }),
    });
    assert.equal(adminPut.status, 200);
    const putBody = await adminPut.json();
    assert.equal(putBody.description, 'Updated by Admin');
    assert.equal(putBody.unit, 'set');
  } finally {
    server.close();
  }
});
