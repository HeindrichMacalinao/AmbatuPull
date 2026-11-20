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
// 1. DELETE /api/products/:prodCode — Soft Delete (§2.3, §3.4, §3.8, S2-DEV-06)
// ==============================================================================

test('softDeleteProduct rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () => productService.softDeleteProduct({ prodCode: 'P-001', requester: null }),
    (err) => err.status === 401
  );
});

test('softDeleteProduct rejects standard User without product.delete right with 403', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.softDeleteProduct({
        prodCode: 'P-001',
        requester: { userId: 5, role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes("missing required permission 'product.delete'")
  );
});

test('softDeleteProduct allows Superadmin and Admin automatically', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRODUCT WHERE prodCode')) {
      return {
        rows: [{ prodCode: 'P-001', description: 'Acme Product', unit: 'pcs', status: 'Active' }],
        rowCount: 1,
      };
    }
    if (sql.includes("UPDATE PRODUCT SET status = 'Inactive'")) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const adminResult = await productService.softDeleteProduct({
    prodCode: 'P-001',
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });
  assert.equal(adminResult.prodCode, 'P-001');
  assert.equal(adminResult.status, 'Inactive');
  assert.ok(adminResult.stamp.startsWith('DELETED admin@hope.com'));

  // Ensure SQL did NOT perform hard delete
  const hardDeleteQueries = mockQueries.filter((q) => q.sql.toUpperCase().includes('DELETE FROM PRODUCT'));
  assert.equal(hardDeleteQueries.length, 0, 'Must NOT perform hard DELETE FROM PRODUCT');
});

test('softDeleteProduct allows standard User when product.delete right is granted', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }
    if (sql.includes('SELECT * FROM PRODUCT WHERE prodCode')) {
      return {
        rows: [{ prodCode: 'P-002', description: 'Beta Product', unit: 'box', status: 'Active' }],
        rowCount: 1,
      };
    }
    if (sql.includes("UPDATE PRODUCT SET status = 'Inactive'")) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const userResult = await productService.softDeleteProduct({
    prodCode: 'P-002',
    requester: { userId: 7, role: 'User', email: 'staff@hope.com' },
  });
  assert.equal(userResult.prodCode, 'P-002');
  assert.equal(userResult.status, 'Inactive');
  assert.ok(userResult.stamp.startsWith('DELETED staff@hope.com'));
});

test('softDeleteProduct returns 404 if product does not exist', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRODUCT WHERE prodCode')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.softDeleteProduct({
        prodCode: 'NONEXISTENT',
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 404 && err.message.includes('Product not found')
  );
});

test('softDeleteProduct returns 400 if product is already Inactive', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRODUCT WHERE prodCode')) {
      return {
        rows: [{ prodCode: 'P-001', description: 'Acme Product', unit: 'pcs', status: 'Inactive', stamp: 'DELETED old 2026-01-01 10:00 AM' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.softDeleteProduct({
        prodCode: 'P-001',
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 400 && err.message.includes('already inactive')
  );
});

test('softDeleteProduct updates audit stamp and logs entry to audit_log (§2.3)', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRODUCT WHERE prodCode')) {
      return {
        rows: [{ prodCode: 'P-001', description: 'Acme Product', unit: 'pcs', status: 'Active' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  };

  await productService.softDeleteProduct({
    prodCode: 'P-001',
    requester: { role: 'Superadmin', email: 'super@hope.com' },
  });

  const auditLogQuery = mockQueries.find((q) => q.sql.includes('INSERT INTO audit_log'));
  assert.ok(auditLogQuery, 'Expected audit_log INSERT query');
  assert.equal(auditLogQuery.params[0], 'super@hope.com');
  assert.equal(auditLogQuery.params[1], 'P-001');
  const loggedDetails = JSON.parse(auditLogQuery.params[2]);
  assert.equal(loggedDetails.before.status, 'Active');
  assert.equal(loggedDetails.after.status, 'Inactive');
});

test('softDeleteProduct verifies PRICEHIST records are preserved intact (Requirement 3)', async () => {
  // Verifies that neither PRICEHIST nor SALESDETAIL are touched during soft deletion
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRODUCT WHERE prodCode')) {
      return {
        rows: [{ prodCode: 'P-001', description: 'Product with Prices', unit: 'pcs', status: 'Active' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  };

  await productService.softDeleteProduct({
    prodCode: 'P-001',
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  // Check no queries deleted from PRICEHIST or SALESDETAIL
  const priceDeletes = mockQueries.filter((q) => q.sql.toUpperCase().includes('DELETE FROM PRICEHIST'));
  const salesDeletes = mockQueries.filter((q) => q.sql.toUpperCase().includes('DELETE FROM SALESDETAIL'));
  assert.equal(priceDeletes.length, 0, 'Must NOT delete from PRICEHIST');
  assert.equal(salesDeletes.length, 0, 'Must NOT delete from SALESDETAIL');
});

// ==============================================================================
// 2. PUT /api/products/:prodCode/restore — Restore Product (§2.3, §3.4, §3.8, S2-DEV-06)
// ==============================================================================

test('restoreProduct rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () => productService.restoreProduct({ prodCode: 'P-001', requester: null }),
    (err) => err.status === 401
  );
});

test('restoreProduct strictly rejects non-Admin/Superadmin users with 403', async () => {
  await assert.rejects(
    () =>
      productService.restoreProduct({
        prodCode: 'P-001',
        requester: { userId: 5, role: 'User', email: 'user@hope.com', rights: ['product.delete', 'product.add', 'product.edit'] },
      }),
    (err) => err.status === 403 && err.message.includes('only Admin or Superadmin can restore products')
  );
});

test('restoreProduct allows Admin and Superadmin to restore Inactive product', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRODUCT WHERE prodCode')) {
      return {
        rows: [{ prodCode: 'P-001', description: 'Acme Product', unit: 'pcs', status: 'Inactive', stamp: 'DELETED user 2026-01-01 10:00 AM' }],
        rowCount: 1,
      };
    }
    if (sql.includes("UPDATE PRODUCT SET status = 'Active'")) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const adminResult = await productService.restoreProduct({
    prodCode: 'P-001',
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });
  assert.equal(adminResult.prodCode, 'P-001');
  assert.equal(adminResult.status, 'Active');
  assert.ok(adminResult.stamp.startsWith('RESTORED admin@hope.com'));

  const superResult = await productService.restoreProduct({
    prodCode: 'P-001',
    requester: { role: 'Superadmin', email: 'super@hope.com' },
  });
  assert.equal(superResult.prodCode, 'P-001');
  assert.equal(superResult.status, 'Active');
  assert.ok(superResult.stamp.startsWith('RESTORED super@hope.com'));
});

test('restoreProduct returns 404 if product does not exist', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRODUCT WHERE prodCode')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.restoreProduct({
        prodCode: 'NONEXISTENT',
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 404 && err.message.includes('Product not found')
  );
});

test('restoreProduct returns 400 if product is already Active', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRODUCT WHERE prodCode')) {
      return {
        rows: [{ prodCode: 'P-001', description: 'Acme Product', unit: 'pcs', status: 'Active', stamp: 'CREATED admin@hope.com 2026-01-01 10:00 AM' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      productService.restoreProduct({
        prodCode: 'P-001',
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 400 && err.message.includes('already active')
  );
});

test('restoreProduct updates audit stamp and logs entry to audit_log (§2.3)', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM PRODUCT WHERE prodCode')) {
      return {
        rows: [{ prodCode: 'P-001', description: 'Acme Product', unit: 'pcs', status: 'Inactive' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  };

  await productService.restoreProduct({
    prodCode: 'P-001',
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  const auditLogQuery = mockQueries.find((q) => q.sql.includes('INSERT INTO audit_log'));
  assert.ok(auditLogQuery, 'Expected audit_log INSERT query');
  assert.equal(auditLogQuery.params[0], 'admin@hope.com');
  assert.equal(auditLogQuery.params[1], 'P-001');
  const loggedDetails = JSON.parse(auditLogQuery.params[2]);
  assert.equal(loggedDetails.before.status, 'Inactive');
  assert.equal(loggedDetails.after.status, 'Active');
});

// ==============================================================================
// 3. Express HTTP Integration Tests: DELETE /api/products/:prodCode & PUT /:prodCode/restore
// ==============================================================================

test('HTTP DELETE and PUT /api/products/:prodCode/restore enforce auth, RBAC, soft delete, and restore', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      const userId = params ? params[0] : null;
      // User #99 has no rights at all
      if (userId === 99) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("LIKE 'product.%'")) {
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }
      // User #5 has product.delete
      if (params && params[1] === 'product.delete') {
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('SELECT * FROM PRODUCT WHERE prodCode')) {
      const prodCode = params[0];
      if (prodCode === 'P-001') {
        return {
          rows: [{ prodCode: 'P-001', description: 'Acme Product', unit: 'pcs', status: 'Active' }],
          rowCount: 1,
        };
      }
      if (prodCode === 'P-002') {
        return {
          rows: [{ prodCode: 'P-002', description: 'Beta Product', unit: 'box', status: 'Inactive' }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 1 };
  };

  try {
    // 1. Unauthenticated DELETE -> 401
    const unauthDel = await fetch(`${baseUrl}/api/products/P-001`, {
      method: 'DELETE',
    });
    assert.equal(unauthDel.status, 401);

    // 2. User without product.delete right -> 403 Forbidden
    const noRightDel = await fetch(`${baseUrl}/api/products/P-001`, {
      method: 'DELETE',
      headers: {
        'x-user-role': 'User',
        'x-user-id': '99',
        'x-user-email': 'norights@hope.com',
      },
    });
    assert.equal(noRightDel.status, 403);

    // 3. User with product.delete right -> 200 OK (soft deleted)
    const userDel = await fetch(`${baseUrl}/api/products/P-001`, {
      method: 'DELETE',
      headers: {
        'x-user-role': 'User',
        'x-user-id': '5',
        'x-user-email': 'user@hope.com',
      },
    });
    assert.equal(userDel.status, 200);
    const delBody = await userDel.json();
    assert.equal(delBody.status, 'Inactive');
    assert.ok(delBody.stamp.startsWith('DELETED user@hope.com'));

    // 4. Non-Admin user attempting restore -> 403 Forbidden
    const userRestore = await fetch(`${baseUrl}/api/products/P-002/restore`, {
      method: 'PUT',
      headers: {
        'x-user-role': 'User',
        'x-user-id': '5',
        'x-user-email': 'user@hope.com',
      },
    });
    assert.equal(userRestore.status, 403);

    // 5. Admin attempting restore -> 200 OK (restored)
    const adminRestore = await fetch(`${baseUrl}/api/products/P-002/restore`, {
      method: 'PUT',
      headers: {
        'x-user-role': 'Admin',
        'x-user-email': 'admin@hope.com',
      },
    });
    assert.equal(adminRestore.status, 200);
    const restoreBody = await adminRestore.json();
    assert.equal(restoreBody.status, 'Active');
    assert.ok(restoreBody.stamp.startsWith('RESTORED admin@hope.com'));
  } finally {
    server.close();
  }
});
