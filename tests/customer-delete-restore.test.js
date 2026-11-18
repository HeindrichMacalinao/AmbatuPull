'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const poolModule = require('../src/db/pool');
const customerService = require('../src/services/customerService');
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
// 1. DELETE /api/customers/:custNo — Soft Delete (§2.3, §3.8, S2-DEV-03)
// ==============================================================================

test('softDeleteCustomer rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () => customerService.softDeleteCustomer({ custNo: 'C0001', requester: null }),
    (err) => err.status === 401
  );
});

test('softDeleteCustomer rejects standard User without customer.delete right with 403', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      customerService.softDeleteCustomer({
        custNo: 'C0001',
        requester: { userId: 5, role: 'User', email: 'user@hope.com' },
      }),
    (err) => err.status === 403 && err.message.includes("missing required permission 'customer.delete'")
  );
});

test('softDeleteCustomer allows Superadmin and Admin automatically', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT * FROM CUSTOMER WHERE custNo')) {
      return {
        rows: [{ custNo: 'C0001', custName: 'Acme Corp', address: '123 Main', payTerms: 'Net 30', status: 'Active' }],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE CUSTOMER SET status = \'Inactive\'')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const adminResult = await customerService.softDeleteCustomer({
    custNo: 'C0001',
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });
  assert.equal(adminResult.custNo, 'C0001');
  assert.equal(adminResult.status, 'Inactive');
  assert.ok(adminResult.stamp.startsWith('DELETED admin@hope.com'));

  // Ensure SQL did NOT perform hard delete
  const hardDeleteQueries = mockQueries.filter((q) => q.sql.toUpperCase().includes('DELETE FROM CUSTOMER'));
  assert.equal(hardDeleteQueries.length, 0, 'Must NOT perform hard DELETE FROM CUSTOMER');
});

test('softDeleteCustomer allows standard User when customer.delete right is granted', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT 1 FROM user_permission')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }
    if (sql.includes('SELECT * FROM CUSTOMER WHERE custNo')) {
      return {
        rows: [{ custNo: 'C0002', custName: 'Beta Corp', address: null, payTerms: 'COD', status: 'Active' }],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE CUSTOMER SET status = \'Inactive\'')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const userResult = await customerService.softDeleteCustomer({
    custNo: 'C0002',
    requester: { userId: 7, role: 'User', email: 'staff@hope.com' },
  });
  assert.equal(userResult.custNo, 'C0002');
  assert.equal(userResult.status, 'Inactive');
  assert.ok(userResult.stamp.startsWith('DELETED staff@hope.com'));
});

test('softDeleteCustomer returns 404 if customer does not exist', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM CUSTOMER WHERE custNo')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      customerService.softDeleteCustomer({
        custNo: 'NONEXISTENT',
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 404 && err.message.includes('Customer not found')
  );
});

test('softDeleteCustomer returns 400 if customer is already Inactive', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM CUSTOMER WHERE custNo')) {
      return {
        rows: [{ custNo: 'C0001', custName: 'Acme Corp', status: 'Inactive', stamp: 'DELETED old@hope.com 2026-01-01 10:00 AM' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      customerService.softDeleteCustomer({
        custNo: 'C0001',
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 400 && err.message.includes('already inactive')
  );
});

test('softDeleteCustomer updates audit stamp and logs entry to audit_log (§2.3)', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM CUSTOMER WHERE custNo')) {
      return {
        rows: [{ custNo: 'C0001', custName: 'Acme Corp', status: 'Active' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  };

  await customerService.softDeleteCustomer({
    custNo: 'C0001',
    requester: { role: 'Superadmin', email: 'super@hope.com' },
  });

  const auditLogQuery = mockQueries.find((q) => q.sql.includes('INSERT INTO audit_log'));
  assert.ok(auditLogQuery, 'Expected audit_log INSERT query');
  assert.equal(auditLogQuery.params[0], 'super@hope.com');
  assert.equal(auditLogQuery.params[1], 'C0001');
  const loggedDetails = JSON.parse(auditLogQuery.params[2]);
  assert.equal(loggedDetails.before.status, 'Active');
  assert.equal(loggedDetails.after.status, 'Inactive');
});

// ==============================================================================
// 2. PUT /api/customers/:custNo/restore — Restore Customer (§2.3, §3.8, S2-DEV-03)
// ==============================================================================

test('restoreCustomer rejects unauthenticated requester with 401', async () => {
  await assert.rejects(
    () => customerService.restoreCustomer({ custNo: 'C0001', requester: null }),
    (err) => err.status === 401
  );
});

test('restoreCustomer strictly rejects non-Admin/Superadmin users with 403', async () => {
  // Even if a standard User had all customer rights, restore is reserved for Admin & Superadmin per §2.3
  await assert.rejects(
    () =>
      customerService.restoreCustomer({
        custNo: 'C0001',
        requester: { userId: 5, role: 'User', email: 'user@hope.com', rights: ['customer.delete', 'customer.add', 'customer.edit'] },
      }),
    (err) => err.status === 403 && err.message.includes('only Admin or Superadmin can restore customers')
  );
});

test('restoreCustomer allows Admin and Superadmin to restore Inactive customer', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM CUSTOMER WHERE custNo')) {
      return {
        rows: [{ custNo: 'C0001', custName: 'Acme Corp', address: '123 Main', payTerms: 'Net 30', status: 'Inactive', stamp: 'DELETED user 2026-01-01 10:00 AM' }],
        rowCount: 1,
      };
    }
    if (sql.includes('UPDATE CUSTOMER SET status = \'Active\'')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const adminResult = await customerService.restoreCustomer({
    custNo: 'C0001',
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });
  assert.equal(adminResult.custNo, 'C0001');
  assert.equal(adminResult.status, 'Active');
  assert.ok(adminResult.stamp.startsWith('RESTORED admin@hope.com'));

  const superResult = await customerService.restoreCustomer({
    custNo: 'C0001',
    requester: { role: 'Superadmin', email: 'super@hope.com' },
  });
  assert.equal(superResult.custNo, 'C0001');
  assert.equal(superResult.status, 'Active');
  assert.ok(superResult.stamp.startsWith('RESTORED super@hope.com'));
});

test('restoreCustomer returns 404 if customer does not exist', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM CUSTOMER WHERE custNo')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      customerService.restoreCustomer({
        custNo: 'NONEXISTENT',
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 404 && err.message.includes('Customer not found')
  );
});

test('restoreCustomer returns 400 if customer is already Active', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM CUSTOMER WHERE custNo')) {
      return {
        rows: [{ custNo: 'C0001', custName: 'Acme Corp', status: 'Active', stamp: 'CREATED admin@hope.com 2026-01-01 10:00 AM' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () =>
      customerService.restoreCustomer({
        custNo: 'C0001',
        requester: { role: 'Admin', email: 'admin@hope.com' },
      }),
    (err) => err.status === 400 && err.message.includes('already active')
  );
});

test('restoreCustomer updates audit stamp and logs entry to audit_log (§2.3)', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT * FROM CUSTOMER WHERE custNo')) {
      return {
        rows: [{ custNo: 'C0001', custName: 'Acme Corp', status: 'Inactive' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  };

  await customerService.restoreCustomer({
    custNo: 'C0001',
    requester: { role: 'Admin', email: 'admin@hope.com' },
  });

  const auditLogQuery = mockQueries.find((q) => q.sql.includes('INSERT INTO audit_log'));
  assert.ok(auditLogQuery, 'Expected audit_log INSERT query');
  assert.equal(auditLogQuery.params[0], 'admin@hope.com');
  assert.equal(auditLogQuery.params[1], 'C0001');
  const loggedDetails = JSON.parse(auditLogQuery.params[2]);
  assert.equal(loggedDetails.before.status, 'Inactive');
  assert.equal(loggedDetails.after.status, 'Active');
});

// ==============================================================================
// 3. Express HTTP Integration Tests: DELETE /api/customers/:custNo & PUT /:custNo/restore
// ==============================================================================

test('HTTP DELETE and PUT /api/customers/:custNo/restore enforce auth, RBAC, soft delete, and restore', async () => {
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
      if (sql.includes("LIKE 'customer.%'")) {
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }
      // User #5 has customer.delete
      if (params && params[1] === 'customer.delete') {
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('SELECT * FROM CUSTOMER WHERE custNo')) {
      const custNo = params[0];
      if (custNo === 'C0001') {
        return {
          rows: [{ custNo: 'C0001', custName: 'Acme Corp', address: '123 Main', payTerms: 'Net 30', status: 'Active' }],
          rowCount: 1,
        };
      }
      if (custNo === 'C0002') {
        return {
          rows: [{ custNo: 'C0002', custName: 'Beta Corp', address: '456 Elm', payTerms: 'COD', status: 'Inactive' }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 1 };
  };

  try {
    // 1. Unauthenticated DELETE -> 401
    const unauthDel = await fetch(`${baseUrl}/api/customers/C0001`, {
      method: 'DELETE',
    });
    assert.equal(unauthDel.status, 401);

    // 2. User without customer.delete right -> 403 Forbidden
    const noRightDel = await fetch(`${baseUrl}/api/customers/C0001`, {
      method: 'DELETE',
      headers: {
        'x-user-role': 'User',
        'x-user-id': '99',
        'x-user-email': 'norights@hope.com',
      },
    });
    assert.equal(noRightDel.status, 403);

    // 3. User with customer.delete right -> 200 OK (soft deleted)
    const userDel = await fetch(`${baseUrl}/api/customers/C0001`, {
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
    const userRestore = await fetch(`${baseUrl}/api/customers/C0002/restore`, {
      method: 'PUT',
      headers: {
        'x-user-role': 'User',
        'x-user-id': '5',
        'x-user-email': 'user@hope.com',
      },
    });
    assert.equal(userRestore.status, 403);

    // 5. Admin attempting restore -> 200 OK (restored)
    const adminRestore = await fetch(`${baseUrl}/api/customers/C0002/restore`, {
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
