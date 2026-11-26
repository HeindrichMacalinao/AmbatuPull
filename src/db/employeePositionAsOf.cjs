'use strict';

// S3-DBA-02: read-only, parameterized SQLite HR history lookup.
// Never expose this helper directly to untrusted HTTP requests. Salary data
// requires a trusted server-side authorization check (jobhistory.view).
const { assertTargetDate } = require('./productPrices.cjs');

function getHistoryShape(db) {
  const cols = new Set(db.prepare('PRAGMA table_info("JOBHISTORY")').all().map(r => r.name));
  for (const required of ['empNo', 'jobCode', 'effDate', 'salary', 'status']) {
    if (!cols.has(required)) throw new Error(`Missing JOBHISTORY.${required}`);
  }
  return { historicalDepartment: cols.has('deptCode') };
}

// All SQL variations are fixed literals selected by *trusted schema metadata*,
// not string-concatenated user inputs. Values use SQLite parameters.
function sqlForShape({ historicalDepartment }, single) {
  const deptProjection = historicalDepartment ? 'jh."deptCode" AS "deptCode"' : 'NULL AS "deptCode"';
  const deptJoin = historicalDepartment
    ? 'LEFT JOIN "DEPARTMENT" d ON d."deptCode" = ranked."deptCode"'
    : '';
  const deptName = historicalDepartment ? 'd."deptName"' : 'NULL';
  return `
    WITH ranked AS (
      SELECT jh."empNo", jh."jobCode", jh."salary", jh."effDate",
             ${deptProjection},
             ROW_NUMBER() OVER (
               PARTITION BY jh."empNo" ORDER BY jh."effDate" DESC, jh."jobCode"
             ) AS rn,
             COUNT(*) OVER (PARTITION BY jh."empNo", jh."effDate") AS tie_count
      FROM "JOBHISTORY" jh
      WHERE jh."status" = 'Active' AND jh."effDate" <= ?
    )
    SELECT e."empNo", ranked."jobCode", j."jobDesc", ranked."deptCode",
           ${deptName} AS "deptName", ranked."salary", ranked."effDate",
           ranked.tie_count AS _tie_count
    FROM "EMPLOYEE" e
    LEFT JOIN ranked ON ranked."empNo" = e."empNo" AND ranked.rn = 1
    LEFT JOIN "JOB" j ON j."jobCode" = ranked."jobCode"
    ${deptJoin}
    WHERE e."status" = 'Active' ${single ? 'AND e."empNo" = ?' : ''}
    ORDER BY e."empNo"
  `;
}

function toPublicRow(row) {
  const { _tie_count, ...result } = row;
  if (_tie_count > 1) {
    throw new Error(`Ambiguous JOBHISTORY assignment on latest effDate for ${row.empNo}; request a business-approved tie-breaker`);
  }
  return result;
}

function assertEmpNo(empNo) {
  if (typeof empNo !== 'string' || empNo.length === 0 || empNo.length > 10) {
    throw new RangeError('empNo must be a non-empty string of at most 10 characters');
  }
  return empNo;
}

function assertSalaryAccess(context) {
  // Context MUST originate from verified server-side authentication and resolved
  // permissions, never from role headers or arbitrary client-supplied JSON.
  if (!context || context.authenticated !== true || !(
    context.role === 'Superadmin' ||
    (Array.isArray(context.rights) && context.rights.includes('jobhistory.view'))
  )) throw new Error('Forbidden: jobhistory.view permission required');
}

function getEmployeePositionAsOfSqlite(db, context, empNo, asOfDate) {
  assertSalaryAccess(context);
  const day = assertTargetDate(asOfDate);
  const id = assertEmpNo(empNo);
  const sql = sqlForShape(getHistoryShape(db), true);
  const row = db.prepare(sql).get(day, id);
  // Includes a row of NULL assignment fields for an existing active employee
  // without eligible history. An unknown or inactive employee returns null.
  return row ? toPublicRow(row) : null;
}

function listActiveEmployeePositionsAsOfSqlite(db, context, asOfDate) {
  assertSalaryAccess(context);
  const day = assertTargetDate(asOfDate);
  const sql = sqlForShape(getHistoryShape(db), false);
  return db.prepare(sql).all(day).map(toPublicRow);
}

module.exports = {
  getHistoryShape,
  sqlForShape,
  assertEmpNo,
  assertSalaryAccess,
  getEmployeePositionAsOfSqlite,
  listActiveEmployeePositionsAsOfSqlite,
};
