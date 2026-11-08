'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const express = require('express');
const poolModule = require('../src/db/pool');
const dashboardService = require('../src/services/dashboardService');
const {
  requireRole,
  requireRight,
  authenticate,
} = require('../src/middleware/authMiddleware');
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
// 1. RBAC Middleware: requireRole & requireRight (§4.2, S1-DEV-08)
// ==============================================================================

test('requireRole middleware enforces session role boundaries (401 unauthenticated, 403 forbidden)', async () => {
  const adminOnly = requireRole('Admin', 'Superadmin');

  // 1. Unauthenticated -> 401
  let status = null;
  let jsonBody = null;
  const res1 = {
    status: (s) => {
      status = s;
      return { json: (b) => { jsonBody = b; } };
    },
  };
  let calledNext1 = false;
  adminOnly({}, res1, () => { calledNext1 = true; });
  assert.equal(status, 401);
  assert.equal(calledNext1, false);

  // 2. Disallowed role ('User') -> 403
  status = null;
  const res2 = {
    status: (s) => {
      status = s;
      return { json: (b) => { jsonBody = b; } };
    },
  };
  let calledNext2 = false;
  adminOnly({ user: { role: 'User' } }, res2, () => { calledNext2 = true; });
  assert.equal(status, 403);
  assert.equal(calledNext2, false);

  // 3. Allowed role ('Admin') -> next()
  let calledNext3 = false;
  adminOnly({ user: { role: 'Admin' } }, {}, () => { calledNext3 = true; });
  assert.equal(calledNext3, true);

  // 4. Allowed role ('Superadmin') -> next()
  let calledNext4 = false;
  adminOnly({ user: { role: 'Superadmin' } }, {}, () => { calledNext4 = true; });
  assert.equal(calledNext4, true);
});

test('requireRight middleware allows Superadmin and Admin without querying user_permission', async () => {
  const checkDelete = requireRight('customer.delete');

  let calledNextSuper = false;
  await checkDelete({ user: { role: 'Superadmin' } }, {}, () => { calledNextSuper = true; });
  assert.equal(calledNextSuper, true);
  assert.equal(mockQueries.length, 0, 'Superadmin should bypass database query');

  let calledNextAdmin = false;
  await checkDelete({ user: { role: 'Admin' } }, {}, () => { calledNextAdmin = true; });
  assert.equal(calledNextAdmin, true);
  assert.equal(mockQueries.length, 0, 'Admin should bypass database query');
});

test('requireRight middleware checks user_permission for standard User and permits access when active', async () => {
  const checkAdd = requireRight('customer.add');

  queryHandler = async (sql, params) => {
    assert.ok(sql.includes('SELECT 1 FROM user_permission'));
    assert.equal(params[0], 42);
    assert.equal(params[1], 'customer.add');
    return { rows: [{ '?column?': 1 }], rowCount: 1 };
  };

  let calledNext = false;
  await checkAdd({ user: { userId: 42, role: 'User' } }, {}, () => { calledNext = true; });
  assert.equal(calledNext, true);
});

test('requireRight middleware rejects standard User when right is missing or inactive with HTTP 403', async () => {
  const checkDelete = requireRight('customer.delete');

  queryHandler = async () => {
    return { rows: [], rowCount: 0 };
  };

  let status = null;
  let jsonBody = null;
  const res = {
    status: (s) => {
      status = s;
      return { json: (b) => { jsonBody = b; } };
    },
  };
  let calledNext = false;

  await checkDelete({ user: { userId: 42, role: 'User' } }, res, () => { calledNext = true; });
  assert.equal(status, 403);
  assert.equal(calledNext, false);
  assert.ok(jsonBody.error.includes("missing required permission 'customer.delete'"));
});

// ==============================================================================
// 2. Navigation Endpoint: GET /api/navigation (§1.2, §3.2, S1-DEV-08)
// ==============================================================================

test('getNavigation returns all 7 modules for Superadmin (including System Settings)', async () => {
  const nav = await dashboardService.getNavigation({
    user: { role: 'Superadmin', email: 'super@hope.com' },
  });

  assert.equal(nav.role, 'Superadmin');
  assert.deepEqual(nav.menuItems, [
    'Customers',
    'Products',
    'HR',
    'Sales',
    'Reports',
    'User Management',
    'System Settings',
  ]);
  assert.equal(nav.modules.length, 7);
  assert.ok(nav.modules.some((m) => m.name === 'System Settings'));
  assert.ok(nav.permittedActions.length >= 36);
});

test('getNavigation returns 6 modules for Admin (System Settings omitted)', async () => {
  const nav = await dashboardService.getNavigation({
    user: { role: 'Admin', email: 'admin@hope.com' },
  });

  assert.equal(nav.role, 'Admin');
  assert.deepEqual(nav.menuItems, [
    'Customers',
    'Products',
    'HR',
    'Sales',
    'Reports',
    'User Management',
  ]);
  assert.equal(nav.modules.length, 6);
  assert.ok(!nav.modules.some((m) => m.name === 'System Settings'), 'System Settings must be absent for Admin');
});

test('getNavigation returns only modules where standard User has active rights', async () => {
  queryHandler = async (sql, params) => {
    if (sql.includes('SELECT rightCode FROM user_permission')) {
      assert.equal(params[0], 15);
      return {
        rows: [
          { rightCode: 'customer.add' },
          { rightCode: 'customer.edit' },
          { rightCode: 'sale.add' },
        ],
        rowCount: 3,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const nav = await dashboardService.getNavigation({
    user: { userId: 15, role: 'User', email: 'user@hope.com' },
  });

  assert.equal(nav.role, 'User');
  assert.deepEqual(nav.menuItems, ['Customers', 'Sales']);
  assert.equal(nav.modules.length, 2);
  assert.deepEqual(nav.modules.map((m) => m.name), ['Customers', 'Sales']);
  assert.deepEqual(nav.permittedActions, ['customer.add', 'customer.edit', 'sale.add']);
});

test('getNavigation returns empty menu items when standard User has no active rights', async () => {
  queryHandler = async () => {
    return { rows: [], rowCount: 0 };
  };

  const nav = await dashboardService.getNavigation({
    user: { userId: 99, role: 'User', email: 'norights@hope.com' },
  });

  assert.equal(nav.role, 'User');
  assert.deepEqual(nav.menuItems, []);
  assert.deepEqual(nav.modules, []);
  assert.deepEqual(nav.permittedActions, []);
});

// ==============================================================================
// 3. Dashboard Metrics Endpoint: GET /api/dashboard/metrics (S1-DEV-08)
// ==============================================================================

test('getDashboardMetrics calculates live SQL counts for CUSTOMER, PRODUCT, SALES and total revenue', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('FROM CUSTOMER')) {
      return { rows: [{ count: 82 }], rowCount: 1 };
    }
    if (sql.includes('FROM PRODUCT')) {
      return { rows: [{ count: 57 }], rowCount: 1 };
    }
    if (sql.includes('FROM SALES WHERE status')) {
      return { rows: [{ count: 124 }], rowCount: 1 };
    }
    if (sql.includes('FROM PAYMENT')) {
      return { rows: [{ revenue: 665326.58 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const data = await dashboardService.getDashboardMetrics();

  assert.equal(data.totalCustomers, 82);
  assert.equal(data.totalProducts, 57);
  assert.equal(data.totalSales, 124);
  assert.equal(data.totalRevenue, 665326.58);
  assert.equal(data.metrics.totalCustomers, 82);
  assert.equal(data.metrics.totalRevenue, 665326.58);
});

// ==============================================================================
// 4. HTTP Integration via Express App (S1-DEV-08)
// ==============================================================================

test('HTTP GET /api/navigation and /api/dashboard/metrics enforce auth and return expected data', async () => {
  const app = createApp();

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  queryHandler = async (sql, params) => {
    if (sql.includes('FROM CUSTOMER')) return { rows: [{ count: 82 }] };
    if (sql.includes('FROM PRODUCT')) return { rows: [{ count: 57 }] };
    if (sql.includes('FROM SALES WHERE status')) return { rows: [{ count: 124 }] };
    if (sql.includes('FROM PAYMENT')) return { rows: [{ revenue: 665326.58 }] };
    if (sql.includes('SELECT rightCode FROM user_permission')) {
      return { rows: [{ rightCode: 'customer.add' }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  try {
    // 1. Unauthenticated navigation -> 401
    const unauthNav = await fetch(`${baseUrl}/api/navigation`);
    assert.equal(unauthNav.status, 401);

    // 2. Superadmin navigation -> 200 with 7 items
    const superNav = await fetch(`${baseUrl}/api/navigation`, {
      headers: { 'x-user-role': 'Superadmin' },
    });
    assert.equal(superNav.status, 200);
    const superNavBody = await superNav.json();
    assert.equal(superNavBody.menuItems.length, 7);
    assert.ok(superNavBody.menuItems.includes('System Settings'));

    // 3. Admin navigation -> 200 with 6 items (no System Settings)
    const adminNav = await fetch(`${baseUrl}/api/navigation`, {
      headers: { 'x-user-role': 'Admin' },
    });
    assert.equal(adminNav.status, 200);
    const adminNavBody = await adminNav.json();
    assert.equal(adminNavBody.menuItems.length, 6);
    assert.ok(!adminNavBody.menuItems.includes('System Settings'));

    // 4. User navigation -> 200 with active module only ('Customers')
    const userNav = await fetch(`${baseUrl}/api/navigation`, {
      headers: { 'x-user-role': 'User', 'x-user-id': '5' },
    });
    assert.equal(userNav.status, 200);
    const userNavBody = await userNav.json();
    assert.deepEqual(userNavBody.menuItems, ['Customers']);

    // 5. Dashboard metrics -> 200 with live counts
    const metricsRes = await fetch(`${baseUrl}/api/dashboard/metrics`, {
      headers: { 'x-user-role': 'Admin' },
    });
    assert.equal(metricsRes.status, 200);
    const metricsBody = await metricsRes.json();
    assert.equal(metricsBody.totalCustomers, 82);
    assert.equal(metricsBody.totalRevenue, 665326.58);
  } finally {
    server.close();
  }
});

test('HTTP Server-Side Enforcement (§4.2): direct route call without required right returns 403 Forbidden', async () => {
  const guardApp = express();
  guardApp.use(express.json());
  guardApp.delete('/api/customers/:id', authenticate, requireRight('customer.delete'), (req, res) => {
    res.status(200).json({ success: true, deleted: req.params.id });
  });

  const server = await new Promise((resolve) => {
    const s = guardApp.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  queryHandler = async (sql) => {
    if (sql.includes('FROM user_permission') && sql.includes('customer.delete')) {
      // User #5 does NOT have customer.delete
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  try {
    // 1. Direct API call without required right -> 403 Forbidden
    const forbiddenRes = await fetch(`${baseUrl}/api/customers/123`, {
      method: 'DELETE',
      headers: { 'x-user-role': 'User', 'x-user-id': '5' },
    });
    assert.equal(forbiddenRes.status, 403, 'Server must refuse unauthorized request with 403 Forbidden');
    const errBody = await forbiddenRes.json();
    assert.ok(errBody.error.includes("missing required permission 'customer.delete'"));

    // 2. Admin automatically bypasses granular right check -> 200 OK
    const adminAllowedRes = await fetch(`${baseUrl}/api/customers/123`, {
      method: 'DELETE',
      headers: { 'x-user-role': 'Admin' },
    });
    assert.equal(adminAllowedRes.status, 200);
  } finally {
    server.close();
  }
});
