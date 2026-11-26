'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const poolModule = require('../src/db/pool');
const { createApp } = require('../src/expressApp');

const root = path.resolve(__dirname, '..');
let originalGetPool;
let employees;
let employeeListQueries;

const fakePool = {
  query: async (sql, params = []) => {
    if (sql.includes('FROM user_permission')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }

    if (sql.startsWith('SELECT 1 FROM EMPLOYEE WHERE empNo')) {
      const exists = employees.has(params[0]);
      return { rows: exists ? [{ '?column?': 1 }] : [], rowCount: exists ? 1 : 0 };
    }
    if (sql.startsWith('SELECT * FROM EMPLOYEE WHERE empNo')) {
      const record = employees.get(params[0]);
      return { rows: record ? [{ ...record }] : [], rowCount: record ? 1 : 0 };
    }
    if (sql.startsWith('SELECT status, COUNT(*) AS count FROM EMPLOYEE')) {
      return {
        rows: ['Active', 'Inactive'].map((status) => ({
          status,
          count: [...employees.values()].filter((employee) => employee.status === status).length,
        })),
        rowCount: 2,
      };
    }
    if (sql.startsWith('SELECT empNo, lastName, firstName, gender, birthDate, hireDate, sepDate, status, stamp FROM EMPLOYEE')) {
      employeeListQueries.push({ sql, params });
      let matches = [...employees.values()];
      if (sql.includes("status = 'Active'")) matches = matches.filter((employee) => employee.status === 'Active');
      if (sql.includes("status = 'Inactive'")) matches = matches.filter((employee) => employee.status === 'Inactive');
      return { rows: matches.map((employee) => ({ ...employee })), rowCount: matches.length };
    }
    if (sql.startsWith('INSERT INTO EMPLOYEE')) {
      const [empNo, lastName, firstName, gender, birthDate, hireDate, sepDate, stamp] = params;
      employees.set(empNo, {
        empNo,
        lastName,
        firstName,
        gender,
        birthDate,
        hireDate,
        sepDate,
        status: 'Active',
        stamp,
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith('UPDATE EMPLOYEE')) {
      if (sql.includes('SET lastName =')) {
        const [lastName, firstName, gender, birthDate, hireDate, sepDate, stamp, empNo] = params;
        employees.set(empNo, {
          ...employees.get(empNo),
          lastName,
          firstName,
          gender,
          birthDate,
          hireDate,
          sepDate,
          stamp,
        });
      } else {
        const [stamp, empNo] = params;
        const status = sql.includes("status = 'Inactive'") ? 'Inactive' : 'Active';
        employees.set(empNo, { ...employees.get(empNo), status, stamp });
      }
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 1 };
  },
};

async function startServer(t) {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function apiRequest(baseUrl, method, route, { role = 'Admin', userId, body } = {}) {
  const headers = { 'x-user-role': role, 'x-user-email': `${role.toLowerCase()}@hope.com` };
  if (userId) headers['x-user-id'] = String(userId);
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const validEmployee = {
  empNo: 'E-004',
  lastName: 'Garcia',
  firstName: 'Maria',
  gender: 'F',
  birthDate: '1980-01-01',
  hireDate: '2010-03-10',
  sepDate: '2025-12-31',
};

function configureEmployeeDb(t) {
  originalGetPool = poolModule.getPool;
  poolModule.getPool = () => fakePool;
  employeeListQueries = [];
  employees = new Map([
    ['E-001', {
      empNo: 'E-001',
      lastName: 'Santos',
      firstName: 'Alex',
      gender: 'M',
      birthDate: '1990-02-10',
      hireDate: '2020-02-10',
      sepDate: null,
      status: 'Active',
      stamp: 'CREATED seed 2026-01-01 09:00 AM',
    }],
    // E-002 is intentionally absent; the scenarios only depend on E-001, E-003, and E-004.
    ['E-003', {
      empNo: 'E-003',
      lastName: 'Reyes',
      firstName: 'Jules',
      gender: 'F',
      birthDate: '1988-05-14',
      hireDate: '2018-06-01',
      sepDate: '2025-12-31',
      status: 'Active',
      stamp: 'EDITED seed 2026-01-01 09:00 AM',
    }],
  ]);
  t.after(() => {
    poolModule.getPool = originalGetPool;
  });
}

test('Employee API validates dates and keeps separation distinct from soft delete and restore', async (t) => {
  configureEmployeeDb(t);
  const { baseUrl } = await startServer(t);

  await t.test('create and edit employee records with audit stamps', async () => {
    const created = await apiRequest(baseUrl, 'POST', '/api/hr/employees', { body: validEmployee });
    assert.equal(created.status, 201);
    assert.equal(created.body.employee.empNo, 'E-004');
    assert.equal(created.body.employee.lastName, 'Garcia');
    assert.equal(created.body.employee.firstName, 'Maria');
    assert.equal(created.body.employee.gender, 'F');
    assert.equal(created.body.employee.birthDate, '1980-01-01');
    assert.equal(created.body.employee.hireDate, '2010-03-10');
    assert.equal(created.body.employee.status, 'Active');
    assert.equal(created.body.employee.sepDate, '2025-12-31');
    assert.match(created.body.employee.stamp, /^CREATED admin@hope\.com \d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/);
    assert.equal(employees.get('E-004').status, 'Active', 'A separation date must not soft-delete the employee');

    const duplicate = await apiRequest(baseUrl, 'POST', '/api/hr/employees', { body: validEmployee });
    assert.equal(duplicate.status, 409);

    const edited = await apiRequest(baseUrl, 'PUT', '/api/hr/employees/E-004', {
      body: { ...validEmployee, lastName: 'Garcia-Santos', sepDate: '2025-12-31' },
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.employee.lastName, 'Garcia-Santos');
    assert.equal(edited.body.employee.status, 'Active');
    assert.equal(edited.body.employee.sepDate, '2025-12-31');
    assert.match(edited.body.employee.stamp, /^EDITED admin@hope\.com /);
  });

  await t.test('reject invalid business dates without mutating employee data', async () => {
    const earlySeparation = await apiRequest(baseUrl, 'POST', '/api/hr/employees', {
      body: { ...validEmployee, empNo: 'E-005', sepDate: '2010-03-09' },
    });
    assert.equal(earlySeparation.status, 400, 'sepDate before hireDate must be rejected');

    const invalidBirthDate = await apiRequest(baseUrl, 'POST', '/api/hr/employees', {
      body: { ...validEmployee, empNo: 'E-006', birthDate: '2010-03-10' },
    });
    assert.equal(invalidBirthDate.status, 400, 'birthDate equal to hireDate must be rejected');

    const laterBirthDate = await apiRequest(baseUrl, 'POST', '/api/hr/employees', {
      body: { ...validEmployee, empNo: 'E-008', birthDate: '2010-03-11' },
    });
    assert.equal(laterBirthDate.status, 400, 'birthDate after hireDate must be rejected');

    // This impossible ISO date guards against runtimes that normalize overflow dates.
    const impossibleDate = await apiRequest(baseUrl, 'POST', '/api/hr/employees', {
      body: { ...validEmployee, empNo: 'E-007', birthDate: '1980-02-30' },
    });
    assert.equal(impossibleDate.status, 400, 'Impossible calendar dates must be rejected');

    const invalidEdit = await apiRequest(baseUrl, 'PUT', '/api/hr/employees/E-004', {
      body: { ...validEmployee, birthDate: '2010-03-10' },
    });
    assert.equal(invalidEdit.status, 400);
    assert.equal(employees.get('E-004').birthDate, '1980-01-01', 'Rejected edits must not change stored data');
  });

  await t.test('User listing is forced to Active rows and omits audit fields', async () => {
    const userBeforeDelete = await apiRequest(baseUrl, 'GET', '/api/hr/employees?status=inactive', {
      role: 'User',
      userId: 7,
    });
    assert.equal(userBeforeDelete.status, 200);
    const userListQuery = employeeListQueries[employeeListQueries.length - 1];
    assert.ok(userListQuery, 'User listing must issue an employee query');
    assert.match(userListQuery.sql, /status\s*=\s*'Active'/);
    assert.ok(userBeforeDelete.body.employees.some((employee) => employee.empNo === 'E-004'));
    assert.equal(userBeforeDelete.body.employees.find((employee) => employee.empNo === 'E-004').status, undefined);
    assert.equal(userBeforeDelete.body.employees.find((employee) => employee.empNo === 'E-004').stamp, undefined);
  });

  await t.test('soft-delete and restore affect only status while preserving separation date', async () => {
    const deleted = await apiRequest(baseUrl, 'DELETE', '/api/hr/employees/E-004');
    assert.equal(deleted.status, 200);
    assert.equal(employees.get('E-004').status, 'Inactive');
    assert.equal(employees.get('E-004').sepDate, '2025-12-31');
    assert.match(deleted.body.employee.stamp, /^DELETED admin@hope\.com /);

    const adminAll = await apiRequest(baseUrl, 'GET', '/api/hr/employees?status=all');
    assert.equal(adminAll.status, 200);
    assert.deepEqual(adminAll.body.counts, { active: 2, inactive: 1, all: 3 });
    const inactiveEmployee = adminAll.body.employees.find((employee) => employee.empNo === 'E-004');
    assert.equal(inactiveEmployee.status, 'Inactive');
    assert.equal(inactiveEmployee.sepDate, '2025-12-31');
    assert.ok(inactiveEmployee.stamp.startsWith('DELETED admin@hope.com'));

    const inactiveOnly = await apiRequest(baseUrl, 'GET', '/api/hr/employees?status=inactive');
    assert.deepEqual(inactiveOnly.body.employees.map((employee) => employee.empNo), ['E-004']);

    const userAfterDelete = await apiRequest(baseUrl, 'GET', '/api/hr/employees?status=all', {
      role: 'User',
      userId: 7,
    });
    assert.equal(userAfterDelete.status, 200);
    assert.ok(!userAfterDelete.body.employees.some((employee) => employee.empNo === 'E-004'));
    assert.ok(userAfterDelete.body.employees.some((employee) => employee.empNo === 'E-003'));
    assert.equal(userAfterDelete.body.counts, undefined);

    const deniedRestore = await apiRequest(baseUrl, 'PUT', '/api/hr/employees/E-004/restore', {
      role: 'User',
      userId: 7,
    });
    assert.equal(deniedRestore.status, 403);

    const restored = await apiRequest(baseUrl, 'PUT', '/api/hr/employees/E-004/restore');
    assert.equal(restored.status, 200);
    assert.equal(employees.get('E-004').status, 'Active');
    assert.equal(employees.get('E-004').sepDate, '2025-12-31');
    // The existing restore route records restoration with an EDITED audit stamp.
    assert.match(restored.body.employee.stamp, /^EDITED admin@hope\.com /);
  });
});

test('A separation date equal to the hire date is valid and does not change Active status', async (t) => {
  configureEmployeeDb(t);
  const { baseUrl } = await startServer(t);

  const boundaryEmployee = await apiRequest(baseUrl, 'POST', '/api/hr/employees', {
    body: { ...validEmployee, empNo: 'E-008', sepDate: '2010-03-10' },
  });
  assert.equal(boundaryEmployee.status, 201);
  assert.equal(boundaryEmployee.body.employee.sepDate, '2010-03-10');
  assert.equal(boundaryEmployee.body.employee.status, 'Active');
});

test('Employee form source validates business dates and gates Admin-only status fields', () => {
  const source = fs.readFileSync(path.join(root, 'src/components/EmployeeManagement.tsx'), 'utf8');

  assert.match(source, /birthDate >= hireDate/);
  assert.match(source, /sepDate < hireDate/);
  assert.match(source, /isAdmin\s*&&\s*\([\s\S]*?STATUS[\s\S]*?STAMP/);
  assert.match(source, /status === 'Inactive'\s*\?\s*'bg-slate-100/);
});
