'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { afterEach, beforeEach, test } = require('node:test');
const poolModule = require('../src/db/pool');
const { createApp } = require('../src/expressApp');

const root = path.resolve(__dirname, '..');
let originalGetPool;
let queries;
let activeDepartmentHistory;
let jobs;
let departments;

const fakePool = {
  query: async (sql, params = []) => {
    queries.push({ sql, params });

    if (sql.includes('FROM user_permission')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }

    if (sql.includes('FROM JOBHISTORY')) {
      const code = params[0];
      return {
        rows: activeDepartmentHistory.has(code) ? [{ '?column?': 1 }] : [],
        rowCount: activeDepartmentHistory.has(code) ? 1 : 0,
      };
    }

    if (sql.startsWith('SELECT 1 FROM JOB WHERE jobCode')) {
      return { rows: jobs.has(params[0]) ? [{ '?column?': 1 }] : [], rowCount: jobs.has(params[0]) ? 1 : 0 };
    }
    if (sql.startsWith('SELECT * FROM JOB WHERE jobCode')) {
      const record = jobs.get(params[0]);
      return { rows: record ? [{ ...record }] : [], rowCount: record ? 1 : 0 };
    }
    if (sql.startsWith('SELECT status, COUNT(*) AS count FROM JOB')) {
      return {
        rows: ['Active', 'Inactive'].map((status) => ({
          status,
          count: [...jobs.values()].filter((job) => job.status === status).length,
        })),
        rowCount: 2,
      };
    }
    if (sql.startsWith('SELECT jobCode, jobDesc, status, stamp FROM JOB')) {
      return { rows: filterLookupRows(sql, params, jobs, ['jobCode', 'jobDesc']), rowCount: jobs.size };
    }
    if (sql.startsWith('INSERT INTO JOB')) {
      const [jobCode, jobDesc, stamp] = params;
      jobs.set(jobCode, { jobCode, jobDesc, status: 'Active', stamp });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith('UPDATE JOB')) {
      if (sql.includes('SET jobDesc =')) {
        const [jobDesc, stamp, jobCode] = params;
        jobs.set(jobCode, { ...jobs.get(jobCode), jobDesc, stamp });
      } else {
        const [stamp, jobCode] = params;
        const status = sql.includes("status = 'Inactive'") ? 'Inactive' : 'Active';
        jobs.set(jobCode, { ...jobs.get(jobCode), status, stamp });
      }
      return { rows: [], rowCount: 1 };
    }

    if (sql.startsWith('SELECT 1 FROM DEPARTMENT WHERE deptCode')) {
      return { rows: departments.has(params[0]) ? [{ '?column?': 1 }] : [], rowCount: departments.has(params[0]) ? 1 : 0 };
    }
    if (sql.startsWith('SELECT * FROM DEPARTMENT WHERE deptCode')) {
      const record = departments.get(params[0]);
      return { rows: record ? [{ ...record }] : [], rowCount: record ? 1 : 0 };
    }
    if (sql.startsWith('SELECT status, COUNT(*) AS count FROM DEPARTMENT')) {
      return {
        rows: ['Active', 'Inactive'].map((status) => ({
          status,
          count: [...departments.values()].filter((department) => department.status === status).length,
        })),
        rowCount: 2,
      };
    }
    if (sql.startsWith('SELECT deptCode, deptName, status, stamp FROM DEPARTMENT')) {
      return {
        rows: filterLookupRows(sql, params, departments, ['deptCode', 'deptName']),
        rowCount: departments.size,
      };
    }
    if (sql.startsWith('INSERT INTO DEPARTMENT')) {
      const [deptCode, deptName, stamp] = params;
      departments.set(deptCode, { deptCode, deptName, status: 'Active', stamp });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith('UPDATE DEPARTMENT')) {
      if (sql.includes('SET deptName =')) {
        const [deptName, stamp, deptCode] = params;
        departments.set(deptCode, { ...departments.get(deptCode), deptName, stamp });
      } else {
        const [stamp, deptCode] = params;
        const status = sql.includes("status = 'Inactive'") ? 'Inactive' : 'Active';
        departments.set(deptCode, { ...departments.get(deptCode), status, stamp });
      }
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 1 };
  },
};

function filterLookupRows(sql, params, records, searchFields) {
  let matches = [...records.values()];
  if (sql.includes("status = 'Active'")) matches = matches.filter((record) => record.status === 'Active');
  if (sql.includes("status = 'Inactive'")) matches = matches.filter((record) => record.status === 'Inactive');

  const search = params.find((param) => typeof param === 'string' && param.startsWith('%') && param.endsWith('%'));
  if (search) {
    const needle = search.slice(1, -1).toLowerCase();
    matches = matches.filter((record) =>
      searchFields.some((field) => String(record[field]).toLowerCase().includes(needle))
    );
  }

  return matches.sort((a, b) => a[searchFields[0]].localeCompare(b[searchFields[0]])).map((record) => ({ ...record }));
}

async function startServer() {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
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

beforeEach(() => {
  originalGetPool = poolModule.getPool;
  poolModule.getPool = () => fakePool;
  queries = [];
  activeDepartmentHistory = new Set(['BLOCK']);
  jobs = new Map([
    ['DEV', { jobCode: 'DEV', jobDesc: 'Software Engineer', status: 'Active', stamp: 'CREATED seed 2026-01-01 09:00 AM' }],
    ['OLD', { jobCode: 'OLD', jobDesc: 'Legacy Engineer', status: 'Inactive', stamp: 'DELETED seed 2026-01-01 09:00 AM' }],
  ]);
  departments = new Map([
    ['SALES', { deptCode: 'SALES', deptName: 'Sales and Marketing', status: 'Active', stamp: 'CREATED seed 2026-01-01 09:00 AM' }],
    ['OLD', { deptCode: 'OLD', deptName: 'Legacy Services', status: 'Inactive', stamp: 'DELETED seed 2026-01-01 09:00 AM' }],
    ['BLOCK', { deptCode: 'BLOCK', deptName: 'Referenced Department', status: 'Active', stamp: 'CREATED seed 2026-01-01 09:00 AM' }],
  ]);
});

afterEach(() => {
  poolModule.getPool = originalGetPool;
});

test('Jobs and departments support CRUD, status/search filters, and role-specific API views', async () => {
  const { server, baseUrl } = await startServer();

  try {
    const allJobs = await apiRequest(baseUrl, 'GET', '/api/hr/jobs?status=all');
    assert.equal(allJobs.status, 200);
    assert.deepEqual(allJobs.body.counts, { active: 1, inactive: 1, all: 2 });
    assert.equal(allJobs.body.jobs.find((job) => job.jobCode === 'OLD').status, 'Inactive');
    assert.ok(allJobs.body.jobs.find((job) => job.jobCode === 'OLD').stamp);

    const inactiveJobs = await apiRequest(baseUrl, 'GET', '/api/hr/jobs?status=inactive');
    assert.deepEqual(inactiveJobs.body.jobs.map((job) => job.jobCode), ['OLD']);
    const matchingJobs = await apiRequest(baseUrl, 'GET', '/api/hr/jobs?status=active&search=ENGINEER');
    assert.deepEqual(matchingJobs.body.jobs.map((job) => job.jobCode), ['DEV']);
    const jobSearchQuery = queries.find(
      ({ sql, params }) => sql.includes('FROM JOB') && params.includes('%engineer%')
    );
    assert.match(jobSearchQuery.sql, /LOWER\(jobCode\) LIKE \$\d+ OR LOWER\(jobDesc\) LIKE \$\d+/);

    const allDepartments = await apiRequest(baseUrl, 'GET', '/api/hr/departments?status=all');
    assert.equal(allDepartments.status, 200);
    assert.deepEqual(allDepartments.body.counts, { active: 2, inactive: 1, all: 3 });
    assert.equal(allDepartments.body.departments.find((department) => department.deptCode === 'OLD').status, 'Inactive');
    const inactiveDepartments = await apiRequest(baseUrl, 'GET', '/api/hr/departments?status=inactive');
    assert.deepEqual(inactiveDepartments.body.departments.map((department) => department.deptCode), ['OLD']);
    const matchingDepartments = await apiRequest(baseUrl, 'GET', '/api/hr/departments?status=active&search=sales');
    assert.deepEqual(matchingDepartments.body.departments.map((department) => department.deptCode), ['SALES']);
    const departmentSearchQuery = queries.find(
      ({ sql, params }) => sql.includes('FROM DEPARTMENT') && params.includes('%sales%')
    );
    assert.match(departmentSearchQuery.sql, /LOWER\(deptCode\) LIKE \$\d+ OR LOWER\(deptName\) LIKE \$\d+/);

    const userJobs = await apiRequest(baseUrl, 'GET', '/api/hr/jobs?status=inactive&search=engineer', {
      role: 'User',
      userId: 7,
    });
    assert.equal(userJobs.status, 200);
    assert.deepEqual(userJobs.body.jobs.map((job) => job.jobCode), ['DEV']);
    assert.equal(userJobs.body.jobs[0].status, undefined);
    assert.equal(userJobs.body.jobs[0].stamp, undefined);
    assert.equal(userJobs.body.counts, undefined);
    const userJobQuery = queries.find(
      ({ sql, params }) => sql.includes('FROM JOB') && params.includes('%engineer%')
    );
    assert.match(userJobQuery.sql, /status = 'Active'/);

    const userDepartments = await apiRequest(baseUrl, 'GET', '/api/hr/departments?status=all&search=sales', {
      role: 'User',
      userId: 7,
    });
    assert.equal(userDepartments.status, 200);
    assert.deepEqual(userDepartments.body.departments.map((department) => department.deptCode), ['SALES']);
    assert.equal(userDepartments.body.departments[0].status, undefined);
    assert.equal(userDepartments.body.departments[0].stamp, undefined);
    assert.equal(userDepartments.body.counts, undefined);
    const userDepartmentQuery = queries.find(
      ({ sql, params }) => sql.includes('FROM DEPARTMENT') && params.includes('%sales%')
    );
    assert.match(userDepartmentQuery.sql, /status = 'Active'/);

    const createdJob = await apiRequest(baseUrl, 'POST', '/api/hr/jobs', {
      body: { jobCode: 'QA-01', jobDesc: 'Quality Analyst' },
    });
    assert.equal(createdJob.status, 201);
    assert.equal(createdJob.body.job.status, 'Active');
    assert.match(createdJob.body.job.stamp, /^CREATED admin@hope\.com \d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/);
    const duplicateJob = await apiRequest(baseUrl, 'POST', '/api/hr/jobs', {
      body: { jobCode: 'QA-01', jobDesc: 'Duplicate' },
    });
    assert.equal(duplicateJob.status, 409);

    const editedJob = await apiRequest(baseUrl, 'PUT', '/api/hr/jobs/QA-01', {
      body: { jobDesc: 'Senior Quality Analyst' },
    });
    assert.equal(editedJob.status, 200);
    assert.equal(editedJob.body.job.jobDesc, 'Senior Quality Analyst');
    assert.match(editedJob.body.job.stamp, /^EDITED admin@hope\.com /);
    const deletedJob = await apiRequest(baseUrl, 'DELETE', '/api/hr/jobs/QA-01');
    assert.equal(deletedJob.status, 200);
    assert.equal(jobs.get('QA-01').status, 'Inactive');
    assert.match(deletedJob.body.job.stamp, /^DELETED admin@hope\.com /);
    const restoredJob = await apiRequest(baseUrl, 'PUT', '/api/hr/jobs/QA-01/restore');
    assert.equal(restoredJob.status, 200);
    assert.equal(jobs.get('QA-01').status, 'Active');
    assert.match(restoredJob.body.job.stamp, /^EDITED admin@hope\.com /);

    const createdDepartment = await apiRequest(baseUrl, 'POST', '/api/hr/departments', {
      body: { deptCode: 'QA', deptName: 'Quality Assurance' },
    });
    assert.equal(createdDepartment.status, 201);
    assert.equal(createdDepartment.body.department.status, 'Active');
    assert.match(createdDepartment.body.department.stamp, /^CREATED admin@hope\.com /);
    const duplicateDepartment = await apiRequest(baseUrl, 'POST', '/api/hr/departments', {
      body: { deptCode: 'QA', deptName: 'Duplicate' },
    });
    assert.equal(duplicateDepartment.status, 409);

    const editedDepartment = await apiRequest(baseUrl, 'PUT', '/api/hr/departments/QA', {
      body: { deptName: 'Quality and Compliance' },
    });
    assert.equal(editedDepartment.status, 200);
    assert.equal(editedDepartment.body.department.deptName, 'Quality and Compliance');
    assert.match(editedDepartment.body.department.stamp, /^EDITED admin@hope\.com /);
    const deletedDepartment = await apiRequest(baseUrl, 'DELETE', '/api/hr/departments/QA');
    assert.equal(deletedDepartment.status, 200);
    assert.equal(departments.get('QA').status, 'Inactive');
    assert.match(deletedDepartment.body.department.stamp, /^DELETED admin@hope\.com /);
    const restoredDepartment = await apiRequest(baseUrl, 'PUT', '/api/hr/departments/QA/restore');
    assert.equal(restoredDepartment.status, 200);
    assert.equal(departments.get('QA').status, 'Active');
    assert.match(restoredDepartment.body.department.stamp, /^EDITED admin@hope\.com /);

    const blockedDelete = await apiRequest(baseUrl, 'DELETE', '/api/hr/departments/BLOCK');
    assert.equal(blockedDelete.status, 409);
    assert.equal(departments.get('BLOCK').status, 'Active');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('Jobs and departments expose the expected Admin and User role-view controls', () => {
  const hrSource = fs.readFileSync(path.join(root, 'src/components/HumanResourcesManagement.tsx'), 'utf8');
  const jobsSource = fs.readFileSync(path.join(root, 'src/components/JobManagement.tsx'), 'utf8');
  const departmentsSource = fs.readFileSync(path.join(root, 'src/components/DepartmentManagement.tsx'), 'utf8');

  assert.match(hrSource, /isPrivileged\s*\?\s*\(/);
  assert.match(hrSource, /aria-label="Record status filter"/);
  assert.match(hrSource, /\{sessionRole\} view/);

  for (const [name, source] of [
    ['job', jobsSource],
    ['department', departmentsSource],
  ]) {
    assert.match(source, /isAdmin && <>.*STATUS.*STAMP/s, `${name} Admin view must include status and stamp headers`);
    assert.match(source, /status === 'Inactive' \? 'bg-slate-100/, `${name} inactive rows must be shaded`);
    assert.match(source, /action: 'restore'/, `${name} Admin view must offer restore for inactive rows`);
  }
});
