'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const dbPool = require('../src/db/pool');
const hrService = require('../src/services/hrService');
const { createApp } = require('../src/expressApp');

function requestApp(app, { method = 'POST', path, headers: extraHeaders = {}, body } = {}) {
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

const validEmployee = {
  empNo: 'E-101',
  lastName: 'Reyes',
  firstName: 'Ana',
  gender: 'F',
  birthDate: '1995-04-10',
  hireDate: '2022-06-01',
  sepDate: null,
};

test('createEmployee rejects unauthenticated (401) and missing emp.add right (403)', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({ query: async () => ({ rows: [] }) });

  await assert.rejects(
    () => hrService.createEmployee({ data: validEmployee, requester: null }),
    (err) => err.status === 401
  );

  await assert.rejects(
    () =>
      hrService.createEmployee({
        data: validEmployee,
        requester: { userId: 5, role: 'User', rights: ['emp.edit'] },
      }),
    (err) => err.status === 403
  );
});

test('createEmployee validates gender, birthDate < hireDate, sepDate >= hireDate, and duplicate empNo', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('SELECT 1 FROM EMPLOYEE')) {
        return { rows: [{ '?column?': 1 }] };
      }
      return { rows: [] };
    },
  });

  const admin = { userId: 1, role: 'Admin', email: 'admin@hope.local' };

  await assert.rejects(
    () => hrService.createEmployee({ data: { ...validEmployee, gender: 'X' }, requester: admin }),
    (err) => err.status === 400
  );

  await assert.rejects(
    () =>
      hrService.createEmployee({
        data: { ...validEmployee, birthDate: '2022-06-01', hireDate: '2022-06-01' },
        requester: admin,
      }),
    (err) => err.status === 400
  );

  await assert.rejects(
    () =>
      hrService.createEmployee({
        data: { ...validEmployee, sepDate: '2022-05-01' },
        requester: admin,
      }),
    (err) => err.status === 400
  );

  await assert.rejects(
    () => hrService.createEmployee({ data: validEmployee, requester: admin }),
    (err) => err.status === 409
  );
});

test('createEmployee succeeds with CREATED stamp and audit_log', async (t) => {
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

  const emp = await hrService.createEmployee({
    data: validEmployee,
    requester: { userId: 1, role: 'Admin', email: 'admin@hope.local' },
  });

  assert.equal(emp.empNo, 'E-101');
  assert.equal(emp.status, 'Active');
  assert.match(emp.stamp, /^CREATED admin@hope\.local \d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/);
  assert.ok(queries.some((q) => q.sql.includes('INSERT INTO audit_log')));
});

test('updateEmployee returns 404 when not found and updates with EDITED stamp when found', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  let found = false;
  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('SELECT * FROM EMPLOYEE')) {
        return found
          ? { rows: [{ ...validEmployee, status: 'Active' }] }
          : { rows: [] };
      }
      return { rows: [] };
    },
  });

  const admin = { userId: 1, role: 'Admin', email: 'admin@hope.local' };

  await assert.rejects(
    () => hrService.updateEmployee({ empNo: 'E-999', data: validEmployee, requester: admin }),
    (err) => err.status === 404
  );

  found = true;
  const updated = await hrService.updateEmployee({
    empNo: 'E-101',
    data: { ...validEmployee, lastName: 'Reyes-Cruz', sepDate: '2025-01-15' },
    requester: admin,
  });

  assert.equal(updated.lastName, 'Reyes-Cruz');
  assert.equal(updated.sepDate, '2025-01-15');
  assert.match(updated.stamp, /^EDITED admin@hope\.local /);
});

test('Express HTTP integration: POST and PUT /api/hr/employees', async (t) => {
  const originalGetPool = dbPool.getPool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });

  dbPool.getPool = () => ({
    query: async (sql) => {
      if (sql.includes('SELECT 1 FROM EMPLOYEE')) {
        return { rows: [] };
      }
      if (sql.includes('SELECT * FROM EMPLOYEE')) {
        return { rows: [{ ...validEmployee, status: 'Active' }] };
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

  const unauthRes = await requestApp(app, { method: 'POST', path: '/api/hr/employees', body: validEmployee });
  assert.equal(unauthRes.status, 401);

  const forbiddenRes = await requestApp(app, {
    method: 'POST',
    path: '/api/hr/employees',
    headers: userHeaders,
    body: validEmployee,
  });
  assert.equal(forbiddenRes.status, 403);

  const createRes = await requestApp(app, {
    method: 'POST',
    path: '/api/hr/employees',
    headers: adminHeaders,
    body: validEmployee,
  });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.empNo, 'E-101');

  const updateRes = await requestApp(app, {
    method: 'PUT',
    path: '/api/hr/employees/E-101',
    headers: adminHeaders,
    body: { ...validEmployee, firstName: 'Anna' },
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.firstName, 'Anna');
});
