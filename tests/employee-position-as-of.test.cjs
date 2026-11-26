'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const {
  getEmployeePositionAsOfSqlite,
  listActiveEmployeePositionsAsOfSqlite,
  getHistoryShape, sqlForShape,
} = require('../src/db/employeePositionAsOf.cjs');

const root = path.resolve(__dirname, '..');
const ACCESS = Object.freeze({ authenticated: true, role: 'Admin', rights: ['jobhistory.view'] });
function fixture(schema = 'main') {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const schemaFile = schema === 'main' ? 'migrations/001_init_core_schema.sql' : 'db/migrations/001_hope_base_tables.sql';
  db.exec(fs.readFileSync(path.join(root, schemaFile), 'utf8'));
  const stmts = {
    job: db.prepare("INSERT INTO JOB (jobCode,jobDesc,status,stamp) VALUES (?,?,?,'TEST')"),
    dep: db.prepare("INSERT INTO DEPARTMENT (deptCode,deptName,status,stamp) VALUES (?,?,'Active','TEST')"),
    employee: db.prepare("INSERT INTO EMPLOYEE (empNo,lastName,firstName,hireDate,status,stamp) VALUES (?,?,? ,? ,?,'TEST')"),
    hist: db.prepare(schema === 'main'
      ? "INSERT INTO JOBHISTORY (empNo,jobCode,deptCode,effDate,salary,status,stamp) VALUES (?,?,?,?,?,?,'TEST')"
      : "INSERT INTO JOBHISTORY (empNo,jobCode,effDate,salary,status,stamp) VALUES (?,?,?,?,?,'TEST')"),
  };
  stmts.job.run('J-A', 'Previous role', 'Active');
  stmts.job.run('J-B', 'New role', 'Inactive');
  stmts.dep.run('D-A', 'Original department');
  stmts.dep.run('D-B', 'New department');
  stmts.employee.run('E-001', 'One', 'Test', '2020-01-01', 'Active');
  stmts.employee.run('E-002', 'Two', 'Test', '2020-01-01', 'Active');
  stmts.employee.run('E-003', 'Three', 'Test', '2020-01-01', 'Inactive');
  const add = (id, job, dept, date, salary, status) => {
    if (schema === 'main') stmts.hist.run(id, job, dept, date, salary, status);
    else stmts.hist.run(id, job, date, salary, status);
  };
  add('E-001', 'J-A', 'D-A', '2026-01-10', 1000, 'Active');
  add('E-001', 'J-B', 'D-B', '2026-03-10', 2000, 'Active');
  add('E-001', 'J-A', 'D-A', '2026-06-10', 9000, 'Inactive');
  add('E-001', 'J-A', 'D-A', '2026-12-10', 9999, 'Active');
  add('E-003', 'J-A', 'D-A', '2026-01-10', 3000, 'Active');
  return { db, add };
}
function withDb(schema, cb) {
  const o = fixture(schema);
  try { cb(o); } finally { o.db.close(); }
}

for (const schema of ['main', 'historical']) {
  test(`${schema}: latest Active assignment on/before date, excluding future and inactive history`, () => {
    withDb(schema, ({ db }) => {
      const prev = getEmployeePositionAsOfSqlite(db,ACCESS, 'E-001', '2026-03-09');
      assert.equal(prev.jobCode, 'J-A');
      assert.equal(prev.salary, 1000);
      const exact = getEmployeePositionAsOfSqlite(db,ACCESS, 'E-001', '2026-03-10');
      assert.equal(exact.jobCode, 'J-B');
      assert.equal(exact.jobDesc, 'New role', 'Preserve historical description, even if current JOB is inactive');
      assert.equal(exact.salary, 2000);
      assert.equal(exact.effDate, '2026-03-10');
      const afterInactive = getEmployeePositionAsOfSqlite(db,ACCESS, 'E-001', '2026-08-01');
      assert.equal(afterInactive.salary, 2000);
      const afterFuture = getEmployeePositionAsOfSqlite(db,ACCESS, 'E-001', '2026-12-10');
      assert.equal(afterFuture.salary, 9999);
      assert.deepEqual(Object.keys(exact), ['empNo','jobCode','jobDesc','deptCode','deptName','salary','effDate']);
      if (schema === 'main') {
        assert.equal(exact.deptCode, 'D-B'); assert.equal(exact.deptName, 'New department');
      } else {
        assert.equal(exact.deptCode, null); assert.equal(exact.deptName, null);
      }
    });
  });

  test(`${schema}: employee with no eligible history returns null assignment fields`, () => {
    withDb(schema, ({ db }) => {
      for (const id of ['E-001', 'E-002']) {
        const row = getEmployeePositionAsOfSqlite(db,ACCESS, id, '2025-01-01');
        assert.equal(row.empNo, id);
        for (const key of ['jobCode','jobDesc','deptCode','deptName','salary','effDate']) assert.equal(row[key], null);
      }
      assert.equal(getEmployeePositionAsOfSqlite(db,ACCESS, 'MISSING', '2026-04-01'), null);
    });
  });

  test(`${schema}: batch returns all Active employees once, excludes Inactive employee`, () => {
    withDb(schema, ({ db }) => {
      const rows = listActiveEmployeePositionsAsOfSqlite(db,ACCESS, '2026-04-01');
      assert.deepEqual(rows.map(r => r.empNo), ['E-001','E-002']);
      assert.equal(rows[0].salary, 2000);
      assert.equal(rows[1].salary, null);
      assert.equal(getEmployeePositionAsOfSqlite(db,ACCESS, 'E-003', '2026-04-01'), null);
      assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
    });
  });

  test(`${schema}: bound parameters reject malformed dates/injection, preserve tables`, () => {
    withDb(schema, ({ db }) => {
      assert.throws(() => getEmployeePositionAsOfSqlite(db,ACCESS,'E-001',"2026-04-01' OR 1=1--"), /valid YYYY-MM-DD/);
      assert.throws(() => listActiveEmployeePositionsAsOfSqlite(db,ACCESS,'2026-02-30'), /valid YYYY-MM-DD/);
      assert.equal(getEmployeePositionAsOfSqlite(db,ACCESS,"E' OR 1=1",'2026-04-01'),null);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM JOBHISTORY').get().count,5);
      assert.match(sqlForShape(getHistoryShape(db),true), /effDate"\s*<=\s*\?/);
    });
  });
}

test('main SQLite: same employee/date with different jobs fails closed pending tie-break rule', () => {
  withDb('main', ({ db, add }) => {
    add('E-001', 'J-A', 'D-A', '2026-03-10', 2222, 'Active');
    assert.throws(() => getEmployeePositionAsOfSqlite(db,ACCESS,'E-001','2026-04-01'), /Ambiguous JOBHISTORY/);
    assert.throws(() => listActiveEmployeePositionsAsOfSqlite(db,ACCESS,'2026-04-01'), /Ambiguous JOBHISTORY/);
    assert.equal(getEmployeePositionAsOfSqlite(db,ACCESS,'E-001','2026-12-10').salary,9999,
      'a newer unique date supersedes an older tied date');
  });
});

test('Postgres function is SECURITY INVOKER and service-role only; no public salary endpoint', () => {
  const sql = fs.readFileSync(path.join(root,'supabase/migrations/20261126_010_employee_position_as_of.sql'),'utf8');
  assert.match(sql,/SECURITY INVOKER/i);
  assert.match(sql,/FROM PUBLIC, anon, authenticated/i);
  assert.match(sql,/TO service_role/i);
  assert.match(sql,/jh\."effDate"\s*<=\s*p_as_of_date/i);
  assert.match(sql,/jh\."status"\s*=\s*'Active'/i);
  assert.match(sql,/e\."status"\s*=\s*'Active'/i);
  assert.match(sql,/NULL::text AS "deptCode"/i);
});

test('salary queries deny missing or insufficient server-side permission context', () => {
  withDb('main', ({ db }) => {
    for (const unauthorized of [undefined, {}, { authenticated: true, role: 'User', rights: [] },
      { authenticated: false, role: 'Superadmin', rights: ['jobhistory.view'] }]) {
      assert.throws(() => getEmployeePositionAsOfSqlite(db,unauthorized,'E-001','2026-04-01'), /Forbidden/);
      assert.throws(() => listActiveEmployeePositionsAsOfSqlite(db,unauthorized,'2026-04-01'), /Forbidden/);
    }
    const superadmin = { authenticated: true, role: 'Superadmin' };
    assert.equal(getEmployeePositionAsOfSqlite(db,superadmin,'E-001','2026-04-01').salary,2000);
  });
});
