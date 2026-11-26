'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const dbPool = require('../src/db/pool');
const hrService = require('../src/services/hrService');
const { createApp } = require('../src/expressApp');

function requestApp(app, { method = 'GET', path, headers: extraHeaders = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const payload = body ? JSON.stringify(body) : null;
      const headers = { ...extraHeaders };
      if (payload) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(payload);
      }

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

      if (payload) req.write(payload);
      req.end();
    });
  });
}

test('listDepartments masks status/stamp and forces Active for User role', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('FROM user_permission')) {
        return { rows: [{ '?column?': 1 }] };
      }
      if (sql.includes('FROM DEPARTMENT')) {
        assert.ok(sql.includes("status = 'Active'"));
        return {
          rows: [
            { deptCode: 'HR', deptName: 'Human Resources', status: 'Active', stamp: 'CREATED admin 2026-01-01 09:00 AM' },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const result = await hrService.listDepartments({
    requester: { userId: 10, role: 'User', rights: ['dept.add'] },
    status: 'All',
  });

  assert.equal(result.total, 1);
  assert.deepEqual(result.departments[0], { deptCode: 'HR', deptName: 'Human Resources' });
  assert.equal(result.counts, undefined);
});

test('listDepartments returns status, stamp, and counts for Admin role', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('GROUP BY status')) {
        return {
          rows: [
            { status: 'Active', count: 3 },
            { status: 'Inactive', count: 1 },
          ],
        };
      }
      if (sql.includes('FROM DEPARTMENT')) {
        return {
          rows: [
            { deptCode: 'IT', deptName: 'Information Tech', status: 'Active', stamp: 'CREATED admin 2026-01-01 09:00 AM' },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const result = await hrService.listDepartments({
    requester: { userId: 1, role: 'Admin' },
    status: 'All',
  });

  assert.equal(result.total, 1);
  assert.equal(result.departments[0].status, 'Active');
  assert.ok(result.departments[0].stamp);
  assert.deepEqual(result.counts, { active: 3, inactive: 1, all: 4 });
});

test('createDepartment rejects unauthenticated (401) and missing dept.add right (403)', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({ query: async () => ({ rows: [] }) });

  await assert.rejects(
    () => hrService.createDepartment({ data: { deptCode: 'FIN', deptName: 'Finance' }, requester: null }),
    (err) => err.status === 401
  );

  await assert.rejects(
    () =>
      hrService.createDepartment({
        data: { deptCode: 'FIN', deptName: 'Finance' },
        requester: { userId: 5, role: 'User', rights: ['dept.edit'] },
      }),
    (err) => err.status === 403
  );
});

test('createDepartment rejects duplicate deptCode (409) and missing fields (400)', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('SELECT 1 FROM DEPARTMENT')) {
        return { rows: [{ '?column?': 1 }] };
      }
      return { rows: [] };
    },
  });

  await assert.rejects(
    () =>
      hrService.createDepartment({
        data: { deptCode: '', deptName: 'Finance' },
        requester: { userId: 1, role: 'Admin' },
      }),
    (err) => err.status === 400
  );

  await assert.rejects(
    () =>
      hrService.createDepartment({
        data: { deptCode: 'FIN', deptName: 'Finance' },
        requester: { userId: 1, role: 'Admin' },
      }),
    (err) => err.status === 409
  );
});

test('createDepartment succeeds with CREATED stamp and audit_log', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  const queries = [];
  dbPool.getPool = () => ({
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [] };
    },
  });

  const dept = await hrService.createDepartment({
    data: { deptCode: 'FIN', deptName: 'Finance' },
    requester: { userId: 2, role: 'Admin', email: 'admin@hope.local' },
  });

  assert.equal(dept.deptCode, 'FIN');
  assert.equal(dept.deptName, 'Finance');
  assert.equal(dept.status, 'Active');
  assert.match(dept.stamp, /^CREATED admin@hope\.local \d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/);
  assert.ok(queries.some((q) => q.sql.includes('INSERT INTO audit_log')));
});

test('updateDepartment updates deptName and writes EDITED stamp', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('SELECT * FROM DEPARTMENT')) {
        return { rows: [{ deptCode: 'FIN', deptName: 'Finance', status: 'Active' }] };
      }
      return { rows: [] };
    },
  });

  const dept = await hrService.updateDepartment({
    deptCode: 'FIN',
    data: { deptName: 'Finance & Accounting' },
    requester: { userId: 2, role: 'Admin', email: 'admin@hope.local' },
  });

  assert.equal(dept.deptName, 'Finance & Accounting');
  assert.match(dept.stamp, /^EDITED admin@hope\.local /);
});

test('softDeleteDepartment blocks deletion when active JOBHISTORY exists (409)', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('SELECT * FROM DEPARTMENT')) {
        return { rows: [{ deptCode: 'IT', deptName: 'IT', status: 'Active' }] };
      }
      if (sql.includes('FROM JOBHISTORY')) {
        return { rows: [{ '?column?': 1 }] };
      }
      return { rows: [] };
    },
  });

  await assert.rejects(
    () =>
      hrService.softDeleteDepartment({
        deptCode: 'IT',
        requester: { userId: 1, role: 'Admin' },
      }),
    (err) => err.status === 409
  );
});

test('softDeleteDepartment sets Inactive and DELETED stamp when no active children', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('SELECT * FROM DEPARTMENT')) {
        return { rows: [{ deptCode: 'MKT', deptName: 'Marketing', status: 'Active' }] };
      }
      return { rows: [] };
    },
  });

  const dept = await hrService.softDeleteDepartment({
    deptCode: 'MKT',
    requester: { userId: 1, role: 'Admin', email: 'admin@hope.local' },
  });

  assert.equal(dept.status, 'Inactive');
  assert.match(dept.stamp, /^DELETED admin@hope\.local /);
});

test('restoreDepartment restricts to Admin/Superadmin (403 for User) and sets Active + EDITED stamp', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('SELECT * FROM DEPARTMENT')) {
        return { rows: [{ deptCode: 'MKT', deptName: 'Marketing', status: 'Inactive' }] };
      }
      return { rows: [] };
    },
  });

  await assert.rejects(
    () =>
      hrService.restoreDepartment({
        deptCode: 'MKT',
        requester: { userId: 5, role: 'User', rights: ['dept.add'] },
      }),
    (err) => err.status === 403
  );

  const restored = await hrService.restoreDepartment({
    deptCode: 'MKT',
    requester: { userId: 1, role: 'Admin', email: 'admin@hope.local' },
  });

  assert.equal(restored.status, 'Active');
  assert.match(restored.stamp, /^EDITED admin@hope\.local /);
});

test('Express HTTP integration: /api/hr/departments CRUD & restore', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('FROM user_permission')) {
        return { rows: [] };
      }
      if (sql.includes('SELECT 1 FROM DEPARTMENT')) {
        return { rows: [] };
      }
      if (sql.includes('SELECT * FROM DEPARTMENT')) {
        return { rows: [{ deptCode: 'OPS', deptName: 'Operations', status: 'Inactive' }] };
      }
      if (sql.includes('GROUP BY status')) {
        return { rows: [{ status: 'Active', count: 1 }] };
      }
      if (sql.includes('FROM DEPARTMENT')) {
        return { rows: [{ deptCode: 'OPS', deptName: 'Operations', status: 'Active', stamp: 'CREATED admin 2026-01-01 09:00 AM' }] };
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
    'x-user-rights': JSON.stringify(['hr.view']),
  };

  const unauthRes = await requestApp(app, { method: 'GET', path: '/api/hr/departments' });
  assert.equal(unauthRes.status, 401);

  const forbiddenRes = await requestApp(app, {
    method: 'POST',
    path: '/api/hr/departments',
    headers: userHeaders,
    body: { deptCode: 'OPS', deptName: 'Operations' },
  });
  assert.equal(forbiddenRes.status, 403);

  const createRes = await requestApp(app, {
    method: 'POST',
    path: '/api/hr/departments',
    headers: adminHeaders,
    body: { deptCode: 'OPS', deptName: 'Operations' },
  });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.deptCode, 'OPS');

  const restoreRes = await requestApp(app, {
    method: 'POST',
    path: '/api/hr/departments/OPS/restore',
    headers: adminHeaders,
  });
  assert.equal(restoreRes.status, 200);
  assert.equal(restoreRes.body.status, 'Active');
});
