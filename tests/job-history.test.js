'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

let Database;
try {
  Database = require('better-sqlite3');
} catch {
  Database = require('node:sqlite').DatabaseSync;
}

const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'migrations');
const migrationDownMarker = /--\s*(?:---+)?\s*(?:DOWN|@down|Rollback)\s*(?:---+)?/i;

function createDatabase(t) {
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');

  const migrations = fs
    .readdirSync(migrationsDir)
    .filter((file) => /^\d+[-_].*\.sql$/i.test(file) && !file.endsWith('.down.sql'))
    .sort((left, right) => {
      const leftNumber = Number.parseInt(left, 10);
      const rightNumber = Number.parseInt(right, 10);
      return leftNumber - rightNumber || left.localeCompare(right);
    });

  for (const migration of migrations) {
    const sql = fs
      .readFileSync(path.join(migrationsDir, migration), 'utf8')
      .split(migrationDownMarker)[0]
      .replace(/^[ \t]*BEGIN(?:\s+(?:IMMEDIATE|EXCLUSIVE))?(?:\s+TRANSACTION)?;[ \t]*$/gim, '')
      .replace(/^[ \t]*(?:COMMIT|END)(?:\s+TRANSACTION)?;[ \t]*$/gim, '');
    db.exec(sql);
  }

  t.after(() => db.close());
  return db;
}

function seedReferences(db) {
  db.prepare(
    `INSERT INTO DEPARTMENT (deptCode, deptName, stamp)
     VALUES (?, ?, ?)`
  ).run('ENG', 'Engineering', 'CREATED test');
  db.prepare(
    `INSERT INTO JOB (jobCode, jobDesc, stamp)
     VALUES (?, ?, ?)`
  ).run('DEV', 'Developer', 'CREATED test');
  db.prepare(
    `INSERT INTO JOB (jobCode, jobDesc, stamp)
     VALUES (?, ?, ?)`
  ).run('LEAD', 'Team Lead', 'CREATED test');
  db.prepare(
    `INSERT INTO EMPLOYEE (empNo, lastName, firstName, hireDate, stamp)
     VALUES (?, ?, ?, ?, ?)`
  ).run('E-001', 'Santos', 'Alex', '2020-01-01', 'CREATED test');
}

function insertHistory(db, {
  empNo = 'E-001',
  jobCode = 'DEV',
  effDate = '2021-01-01',
  salary = 50000,
  deptCode = 'ENG',
  status = 'Active',
} = {}) {
  db.prepare(
    `INSERT INTO JOBHISTORY (empNo, jobCode, effDate, salary, deptCode, status, stamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(empNo, jobCode, effDate, salary, deptCode, status, 'CREATED test');
}

test('job history enforces its composite key and parent references', (t) => {
  const db = createDatabase(t);
  seedReferences(db);
  insertHistory(db);

  assert.throws(() => insertHistory(db), /UNIQUE constraint failed/);
  assert.doesNotThrow(() => insertHistory(db, { effDate: '2022-01-01' }));
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM JOBHISTORY').get().count,
    2,
    'the same employee can hold the same job on a different effective date'
  );

  for (const [index, invalidReference] of [
    { empNo: 'E-MISSING' },
    { jobCode: 'JOB-MISSING' },
    { deptCode: 'DEPT-MISSING' },
  ].entries()) {
    assert.throws(
      () =>
        insertHistory(db, {
          ...invalidReference,
          effDate: `2030-01-0${index + 1}`,
          status: 'Inactive',
        }),
      /FOREIGN KEY constraint failed/
    );
  }
});

test('job history lists salary progression newest-first and selects the latest position', (t) => {
  const db = createDatabase(t);
  seedReferences(db);
  insertHistory(db, { effDate: '2021-01-01', salary: 50000 });
  insertHistory(db, {
    jobCode: 'LEAD',
    effDate: '2023-06-01',
    salary: 70000,
  });
  insertHistory(db, {
    jobCode: 'DEV',
    effDate: '2022-02-01',
    salary: 60000,
  });

  const history = db
    .prepare(
      `SELECT jobCode, effDate, salary
       FROM JOBHISTORY
       WHERE empNo = ?
       ORDER BY effDate DESC`
    )
    .all('E-001');

  assert.deepEqual(
    history.map(({ jobCode, effDate, salary }) => [jobCode, effDate, salary]),
    [
      ['LEAD', '2023-06-01', 70000],
      ['DEV', '2022-02-01', 60000],
      ['DEV', '2021-01-01', 50000],
    ]
  );

  const currentPosition = db
    .prepare(
      `SELECT jobCode, effDate, salary
       FROM JOBHISTORY
       WHERE empNo = ?
       ORDER BY effDate DESC
       LIMIT 1`
    )
    .get('E-001');
  assert.deepEqual(
    [currentPosition.jobCode, currentPosition.effDate, currentPosition.salary],
    ['LEAD', '2023-06-01', 70000]
  );

  db.prepare(
    `UPDATE JOBHISTORY
     SET salary = ?
     WHERE empNo = ? AND jobCode = ? AND effDate = ?`
  ).run(72000, 'E-001', 'LEAD', '2023-06-01');
  assert.equal(
    db
      .prepare(
        `SELECT salary FROM JOBHISTORY
         WHERE empNo = ? AND jobCode = ? AND effDate = ?`
      )
      .get('E-001', 'LEAD', '2023-06-01').salary,
    72000
  );
  assert.throws(
    () =>
      db
        .prepare(
          `UPDATE JOBHISTORY
           SET salary = ?
           WHERE empNo = ? AND jobCode = ? AND effDate = ?`
        )
        .run(-1, 'E-001', 'LEAD', '2023-06-01'),
    /salary_nonnegative|CHECK constraint failed/
  );
});

test('job history entries can be soft-deleted and restored independently', (t) => {
  const db = createDatabase(t);
  seedReferences(db);
  insertHistory(db, { effDate: '2021-01-01' });
  insertHistory(db, { effDate: '2022-01-01' });

  db.prepare(
    `UPDATE JOBHISTORY
     SET status = 'Inactive'
     WHERE empNo = ? AND jobCode = ? AND effDate = ?`
  ).run('E-001', 'DEV', '2021-01-01');

  assert.deepEqual(
    db
      .prepare('SELECT effDate FROM v_active_jobhistory WHERE empNo = ? ORDER BY effDate DESC')
      .all('E-001')
      .map(({ effDate }) => effDate),
    ['2022-01-01'],
    'deleting one history row must leave the other active'
  );

  db.prepare(
    `UPDATE JOBHISTORY
     SET status = 'Active'
     WHERE empNo = ? AND jobCode = ? AND effDate = ?`
  ).run('E-001', 'DEV', '2021-01-01');

  assert.deepEqual(
    db
      .prepare('SELECT effDate FROM v_active_jobhistory WHERE empNo = ? ORDER BY effDate DESC')
      .all('E-001')
      .map(({ effDate }) => effDate),
    ['2022-01-01', '2021-01-01']
  );
});
