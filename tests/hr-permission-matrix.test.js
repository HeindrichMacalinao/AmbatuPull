'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const dbPool = require('../src/db/pool');
const { createApp } = require('../src/expressApp');

const root = path.resolve(__dirname, '..');
const salarySentinel = 987654.32;

const HR_ACTIONS = [
  { right: 'job.add', method: 'POST', path: '/api/hr/jobs', body: { jobCode: 'J-NEW', jobDesc: 'New position' }, component: 'JobManagement.tsx', control: 'canAdd' },
  { right: 'job.edit', method: 'PUT', path: '/api/hr/jobs/J-001', body: { jobDesc: 'Updated position' }, component: 'JobManagement.tsx', control: 'canEdit' },
  { right: 'job.delete', method: 'DELETE', path: '/api/hr/jobs/J-001', component: 'JobManagement.tsx', control: 'canDelete' },
  { right: 'dept.add', issueName: 'department.add', method: 'POST', path: '/api/hr/departments', body: { deptCode: 'D-NEW', deptName: 'New department' }, component: 'DepartmentManagement.tsx', control: 'canAdd' },
  { right: 'dept.edit', issueName: 'department.edit', method: 'PUT', path: '/api/hr/departments/D-001', body: { deptName: 'Updated department' }, component: 'DepartmentManagement.tsx', control: 'canEdit' },
  { right: 'dept.delete', issueName: 'department.delete', method: 'DELETE', path: '/api/hr/departments/D-001', component: 'DepartmentManagement.tsx', control: 'canDelete' },
  { right: 'emp.add', issueName: 'employee.add', method: 'POST', path: '/api/hr/employees', body: { empNo: 'E-NEW', lastName: 'New', firstName: 'Employee', gender: 'F', birthDate: '1990-01-01', hireDate: '2020-01-01' }, component: 'EmployeeManagement.tsx', control: 'canAdd' },
  { right: 'emp.edit', issueName: 'employee.edit', method: 'PUT', path: '/api/hr/employees/E-001', body: { lastName: 'Updated', firstName: 'Employee', gender: 'M', birthDate: '1990-01-01', hireDate: '2020-01-01' }, component: 'EmployeeManagement.tsx', control: 'canEdit' },
  { right: 'emp.delete', issueName: 'employee.delete', method: 'DELETE', path: '/api/hr/employees/E-001', component: 'EmployeeManagement.tsx', control: 'canDelete' },
  { right: 'jobhistory.view', method: 'GET', path: '/api/hr/employees/E-001/history', component: 'EmployeeManagement.tsx', control: 'canViewHistory' },
  { right: 'jobhistory.add', method: 'POST', path: '/api/hr/employees/E-001/history', body: { jobCode: 'J-001', deptCode: 'D-001', effDate: '2025-01-01', salary: 60000 }, component: 'JobHistoryModal.tsx', control: 'canAdd' },
  { right: 'jobhistory.edit', method: 'PUT', path: '/api/hr/employees/E-001/history/J-001/2024-01-01', body: { deptCode: 'D-001', salary: 65000 }, component: 'JobHistoryModal.tsx', control: 'canEdit' },
  { right: 'jobhistory.delete', method: 'DELETE', path: '/api/hr/employees/E-001/history/J-001/2024-01-01', component: 'JobHistoryModal.tsx', control: 'canDelete' },
];

const employee = {
  empNo: 'E-001',
  lastName: 'Santos',
  firstName: 'Alex',
  gender: 'M',
  birthDate: '1990-01-01',
  hireDate: '2020-01-01',
  sepDate: null,
  salary: salarySentinel,
  status: 'Active',
  stamp: 'CREATED test',
};
const job = { jobCode: 'J-001', jobDesc: 'Engineer', status: 'Active', stamp: 'CREATED test' };
const department = { deptCode: 'D-001', deptName: 'Engineering', status: 'Active', stamp: 'CREATED test' };
const history = {
  empNo: 'E-001',
  jobCode: 'J-001',
  effDate: '2024-01-01',
  salary: salarySentinel,
  deptCode: 'D-001',
  status: 'Active',
  stamp: 'CREATED test',
};

function rowResult(rows = []) {
  return { rows, rowCount: rows.length };
}

function createPermissionTestPool(sqlQueries = []) {
  let activeRights = [];
  return {
    setRights(rights) {
      activeRights = rights;
    },
    query: async (sql, params = []) => {
      sqlQueries.push(sql);
      if (sql.startsWith('SELECT * FROM app_user WHERE userId = $1')) {
        return rowResult([{
          userId: 77,
          email: 'matrix-user@hope.local',
          role: 'User',
          status: 'Active',
          isBlocked: false,
        }]);
      }
      if (sql.includes('SELECT rightCode FROM user_permission')) {
        return rowResult(activeRights.map((rightCode) => ({ rightCode })));
      }
      if (sql.includes('SELECT 1 FROM user_permission')) {
        return rowResult(activeRights.includes(params[1]) ? [{ '?column?': 1 }] : []);
      }

      if (sql.startsWith('SELECT 1 FROM EMPLOYEE WHERE empNo')) {
        return rowResult(params[0] === employee.empNo ? [{ empNo: employee.empNo }] : []);
      }
      if (sql.startsWith('SELECT 1 FROM JOB WHERE jobCode')) {
        return rowResult(params[0] === job.jobCode ? [{ jobCode: job.jobCode }] : []);
      }
      if (sql.startsWith('SELECT 1 FROM DEPARTMENT WHERE deptCode')) {
        return rowResult(params[0] === department.deptCode ? [{ deptCode: department.deptCode }] : []);
      }
      if (sql.startsWith('SELECT 1 FROM JOBHISTORY')) return rowResult();

      if (sql.includes('GROUP BY status')) {
        return rowResult([
          { status: 'Active', count: 1 },
          { status: 'Inactive', count: 0 },
        ]);
      }
      if (sql.includes('FROM JOBHISTORY')) return rowResult([history]);
      if (sql.includes('FROM EMPLOYEE')) return rowResult([employee]);
      if (sql.includes('FROM DEPARTMENT')) return rowResult([department]);
      if (sql.includes('FROM JOB')) return rowResult([job]);

      if (sql.startsWith('INSERT INTO JOBHISTORY')) return rowResult([history]);
      if (sql.startsWith('INSERT INTO EMPLOYEE')) return rowResult([employee]);
      if (sql.startsWith('INSERT INTO DEPARTMENT')) return rowResult([department]);
      if (sql.startsWith('INSERT INTO JOB')) return rowResult([job]);
      if (sql.startsWith('UPDATE JOBHISTORY')) return rowResult([history]);
      if (sql.startsWith('UPDATE EMPLOYEE')) return rowResult([employee]);
      if (sql.startsWith('UPDATE DEPARTMENT')) return rowResult([department]);
      if (sql.startsWith('UPDATE JOB')) return rowResult([job]);
      return rowResult();
    },
  };
}

function installPool(t, pool) {
  const originalGetPool = dbPool.getPool;
  dbPool.getPool = () => pool;
  t.after(() => {
    dbPool.getPool = originalGetPool;
  });
  return pool;
}

async function startServer(t) {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

async function requestApp(baseUrl, route, { method = 'GET', body } = {}) {
  // Use the session-token path so authenticate loads active rights from user_permission.
  const headers = { Authorization: `Bearer ${Buffer.from('77').toString('base64')}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const responseBody = await response.json();
  return { status: response.status, body: responseBody };
}

test('all 13 HR actions allow their exact granted right and reject the revoked state', async (t) => {
  const pool = installPool(t, createPermissionTestPool());
  const baseUrl = await startServer(t);

  for (const action of HR_ACTIONS) {
    await t.test(action.right, async () => {
      pool.setRights(['hr.view']);
      const revoked = await requestApp(baseUrl, action.path, {
        method: action.method,
        body: action.body,
      });
      assert.equal(revoked.status, 403, `${action.issueName || action.right} (${action.right}) must be denied without its grant`);

      pool.setRights([action.right]);
      const granted = await requestApp(baseUrl, action.path, {
        method: action.method,
        body: action.body,
      });
      assert.ok(
        granted.status >= 200 && granted.status < 300,
        `${action.issueName || action.right} (${action.right}) must allow the matching API action; received ${granted.status}: ${JSON.stringify(granted.body)}`
      );
    });
  }
});

test('HR UI controls are conditional on the corresponding per-action right', () => {
  for (const action of HR_ACTIONS) {
    const source = fs.readFileSync(path.join(root, 'src', 'components', action.component), 'utf8');
    const declaration = source.match(new RegExp(`const\\s+${action.control}\\s*=\\s*([^;]+);`));
    assert.ok(declaration, `${action.component} must define ${action.control} for ${action.right}`);
    assert.ok(
      declaration[1].includes(`rights.includes('${action.right}')`),
      `${action.component} must check ${action.right} for ${action.control}`
    );
    const renderStart = source.indexOf('return (', declaration.index);
    assert.notEqual(renderStart, -1, `${action.component} must render its controls`);
    const renderSource = source.slice(renderStart);
    const usesConditionalRender = new RegExp(`\\b${action.control}\\s*(?:&&|\\?)`);
    assert.ok(
      usesConditionalRender.test(renderSource),
      `${action.component} must conditionally render the ${action.control} control`
    );
  }
});

test('RA 10173 salary privacy: history requires jobhistory.view and employee lists omit salary', async (t) => {
  const queries = [];
  const pool = installPool(t, createPermissionTestPool(queries));
  const baseUrl = await startServer(t);

  pool.setRights(['emp.view']);
  const noHistoryRight = await requestApp(baseUrl, '/api/hr/employees/E-001/history', {
  });
  assert.equal(noHistoryRight.status, 403);

  pool.setRights(['jobhistory.view']);
  const authorizedHistory = await requestApp(baseUrl, '/api/hr/employees/E-001/history', {
  });
  assert.equal(authorizedHistory.status, 200);
  assert.equal(authorizedHistory.body.history[0].salary, salarySentinel);

  pool.setRights([]);
  const noHrAccess = await requestApp(baseUrl, '/api/hr/employees');
  assert.equal(noHrAccess.status, 403);

  pool.setRights(['emp.view']);
  const employeeListStart = queries.length;
  const employeeList = await requestApp(baseUrl, '/api/hr/employees');
  assert.equal(employeeList.status, 200);
  assert.equal(employeeList.body.employees[0].salary, undefined);
  assert.equal(JSON.stringify(employeeList.body).includes(String(salarySentinel)), false);
  const employeeListQuery = queries
    .slice(employeeListStart)
    .find((sql) => sql.includes('FROM EMPLOYEE') && !sql.includes('GROUP BY status'));
  assert.ok(employeeListQuery, 'employee-list query must be issued');
  assert.doesNotMatch(employeeListQuery, /salary/i, 'employee list SQL must not select salary');
});
