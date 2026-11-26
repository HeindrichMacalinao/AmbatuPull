'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const dbPool = require('../src/db/pool');
const hrService = require('../src/services/hrService');
const { createApp } = require('../src/expressApp');

function requestApp(app, { method = 'DELETE', path, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const req = http.request({ hostname: '127.0.0.1', port, path, method, headers }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          server.close();
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });

      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      req.end();
    });
  });
}

test('softDeleteEmployee rejects unauthenticated (401) and missing emp.delete right (403)', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({ query: async () => ({ rows: [] }) });

  await assert.rejects(
    () => hrService.softDeleteEmployee({ empNo: 'E-001', requester: null }),
    (err) => err.status === 401
  );

  await assert.rejects(
    () =>
      hrService.softDeleteEmployee({
        empNo: 'E-001',
        requester: { userId: 5, role: 'User', rights: ['emp.edit'] },
      }),
    (err) => err.status === 403
  );
});

test('softDeleteEmployee sets Inactive, DELETED stamp, and preserves sepDate', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  const queries = [];
  dbPool.getPool = () => ({
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('SELECT * FROM EMPLOYEE')) {
        return {
          rows: [
            {
              empNo: 'E-004',
              lastName: 'Garcia',
              firstName: 'Maria',
              sepDate: '2025-12-31',
              status: 'Active',
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const deleted = await hrService.softDeleteEmployee({
    empNo: 'E-004',
    requester: { userId: 1, role: 'Admin', email: 'admin@hope.local' },
  });

  assert.equal(deleted.status, 'Inactive');
  assert.equal(deleted.sepDate, '2025-12-31');
  assert.match(deleted.stamp, /^DELETED admin@hope\.local /);
  assert.ok(queries.some((q) => q.sql.includes("UPDATE EMPLOYEE") && q.sql.includes("status = 'Inactive'")));
  assert.ok(!queries.some((q) => q.sql.includes('DELETE FROM')));
  assert.ok(queries.some((q) => q.sql.includes('INSERT INTO audit_log')));
});

test('restoreEmployee restricts to Admin/Superadmin (403 for User) and sets Active + EDITED stamp', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('SELECT * FROM EMPLOYEE')) {
        return {
          rows: [
            {
              empNo: 'E-004',
              lastName: 'Garcia',
              firstName: 'Maria',
              sepDate: '2025-12-31',
              status: 'Inactive',
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  await assert.rejects(
    () =>
      hrService.restoreEmployee({
        empNo: 'E-004',
        requester: { userId: 5, role: 'User', rights: ['emp.add'] },
      }),
    (err) => err.status === 403
  );

  const restored = await hrService.restoreEmployee({
    empNo: 'E-004',
    requester: { userId: 1, role: 'Admin', email: 'admin@hope.local' },
  });

  assert.equal(restored.status, 'Active');
  assert.equal(restored.sepDate, '2025-12-31');
  assert.match(restored.stamp, /^EDITED admin@hope\.local /);
});

test('Express HTTP integration: DELETE and POST /restore /api/hr/employees/:empNo', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  let currentStatus = 'Active';
  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('SELECT * FROM EMPLOYEE')) {
        return {
          rows: [
            {
              empNo: 'E-004',
              lastName: 'Garcia',
              firstName: 'Maria',
              sepDate: null,
              status: currentStatus,
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const app = createApp();
  const adminHeaders = { 'x-user-id': '1', 'x-user-role': 'Admin', 'x-user-email': 'admin@hope.local' };
  const userHeaders = {
    'x-user-id': '5',
    'x-user-role': 'User',
    'x-user-email': 'user@hope.local',
    'x-user-rights': JSON.stringify(['emp.view']),
  };

  const unauthRes = await requestApp(app, { method: 'DELETE', path: '/api/hr/employees/E-004' });
  assert.equal(unauthRes.status, 401);

  const forbiddenRes = await requestApp(app, {
    method: 'DELETE',
    path: '/api/hr/employees/E-004',
    headers: userHeaders,
  });
  assert.equal(forbiddenRes.status, 403);

  const delRes = await requestApp(app, {
    method: 'DELETE',
    path: '/api/hr/employees/E-004',
    headers: adminHeaders,
  });
  assert.equal(delRes.status, 200);
  assert.equal(delRes.body.status, 'Inactive');

  currentStatus = 'Inactive';
  const restoreRes = await requestApp(app, {
    method: 'POST',
    path: '/api/hr/employees/E-004/restore',
    headers: adminHeaders,
  });
  assert.equal(restoreRes.status, 200);
  assert.equal(restoreRes.body.status, 'Active');
});
