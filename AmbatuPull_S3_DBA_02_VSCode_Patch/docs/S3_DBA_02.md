# S3-DBA-02 — Employee assignment as of date (DevSecOps)

## Inspected schema and conventions

- `migrations/001_init_core_schema.sql` (SQLite local migration runner):
  `JOBHISTORY(empNo, jobCode, deptCode, effDate, salary, status, stamp)` and
  `PRIMARY KEY (empNo, jobCode, effDate)`; the same employee may have multiple
  active job assignments effective on the same date.
- `db/migrations/001_hope_base_tables.sql` (alternate SQLite/historical assets):
  `JOBHISTORY(empNo, jobCode, effDate, salary, status, stamp)` and
  `PRIMARY KEY (empNo, jobCode, effDate)`; no historical `deptCode`.
- `supabase/migrations/20261108_001_core_erp_schema.sql` (PostgreSQL):
  `JOBHISTORY(empNo, effDate, jobCode, salary, status, stamp)` and
  `PRIMARY KEY (empNo, effDate)`; no historical `deptCode`. The `EMPLOYEE`
  table's `deptCode` is the employee's *present* department, **not historical**.
- S3-DBA-01 provides the index on `JOBHISTORY(empNo, effDate, status)`.
  This ticket does **not** add a duplicate index or change schema/data.
- The bundled `HopeERP.db` and `HOPE_Model1.db` assets include
  `JOBHISTORY.deptCode`, even though the alternate `db/migrations/001`
  DDL does not; the SQLite helper checks actual column metadata before
  selecting a query shape. The bundled historical databases have zero duplicate active
  `(empNo, effDate)` pairs at inspection time. Do not assume this remains true.

## Behavior

1. For **one active employee**, return seven fields in this order:
   `empNo, jobCode, jobDesc, deptCode, deptName, salary, effDate`.
   Return `null` when the employee is missing/inactive.
2. For an active employee with **no qualifying active history on/before date**,
   return the employee ID and `null` in all six assignment fields.
3. For **all active employees**, use `ROW_NUMBER() OVER(PARTITION BY empNo
   ORDER BY effDate DESC, jobCode)` after filtering history by `status =
   'Active' AND effDate <= :asOfDate`; retain employees without history.
   Same-date ties at the *latest eligible date* cause an error; the
   secondary `jobCode` sort is only for deterministic processing, not an
   approved business tie-breaker.
4. The SQLite local-runner schema has historical department data in
   `JOBHISTORY.deptCode`; join to `DEPARTMENT` for the recorded department.
   PostgreSQL and historical SQLite do not. Return `NULL` for department fields,
   **not** the current employee department, which would misstate past history.
5. Job and department *descriptions* do not have status filters: this follows
   the ticket's base SQL and keeps historical labels visible after soft delete.
   Whether inactive labels should be shown is a **pending team policy**.
6. No `CURRENT_DATE` or fixed date is used. The caller must supply an explicit
   valid ISO date. Every value is bound, never concatenated into SQL.

## SQLite: server-side usage

The following API is **internal to trusted server-side code only**. Do not
pass client-supplied `role`, `rights`, or `authenticated` flags into it. The
context must be created by verified authentication middleware using permissions
resolved from the database. The helper enforces either the authenticated
`Superadmin` role or an explicit `jobhistory.view` right. The final
salary-access role matrix requires team approval before exposing any endpoint.

```js
const { DatabaseSync } = require('node:sqlite');
const {
  getEmployeePositionAsOfSqlite,
  listActiveEmployeePositionsAsOfSqlite,
} = require('./src/db/employeePositionAsOf.cjs');

const db = new DatabaseSync('/path/to/authorized-readonly-copy.db', { readOnly: true });
// This context must come from a verified server-side session and database rights lookup:
const verifiedAccess = {
  authenticated: true,
  role: 'Admin',
  rights: ['jobhistory.view'],
};
try {
  const one = getEmployeePositionAsOfSqlite(db, verifiedAccess, '00001', '2026-10-15');
  const all = listActiveEmployeePositionsAsOfSqlite(db, verifiedAccess, '2026-10-15');
  // Do not print salaries or return them to unauthorized clients.
} finally {
  db.close();
}
```

## Supabase/PostgreSQL: server-only RPC

The **up migration** is
`supabase/migrations/20261126_010_employee_position_as_of.sql`; rollback is
`supabase/rollback/20261126_010_employee_position_as_of.down.sql`.
The function uses `SECURITY INVOKER`; execute privilege is **revoked** from
`PUBLIC`, `anon` and `authenticated`, and granted only to `service_role`.
It is intended for a trusted server after it checks the authenticated
principal's HR rights. Never put the service role key in browser code, and
never expose this privileged RPC through an unguarded HTTP endpoint.

```sql
-- All active employees, as of the supplied date:
SELECT * FROM public.erp_employee_positions_as_of(date '2026-10-15');
-- A single active employee, as of the supplied date:
SELECT * FROM public.erp_employee_positions_as_of(date '2026-10-15', '00001');
```

Call the RPC from a server action only after verifying an HR permission, for
example with Supabase JS:

```js
const { data, error } = await adminClient.rpc('erp_employee_positions_as_of', {
  p_as_of_date: '2026-10-15',
  p_emp_no: '00001', // omit or use null for all Active employees
});
if (error) throw error;
```

The function **returns NULL department fields** because the inspected
PostgreSQL `JOBHISTORY` table lacks `deptCode`. Do not silently use the
employee's current department for an as-of answer. To return historical
housing/department, ask the team to approve a history design and backfill.

The function does not create public views. `SECURITY INVOKER` uses the caller's
RLS and table privileges (the Supabase service role typically bypasses RLS),
so server-side authorization is still mandatory.

## Test and verification commands

Run from the repository root, with Node.js 22.5+ and Python 3:

```bash
node --test tests/employee-position-as-of.test.cjs
python3 -B tests/verify_current_job_sql.py
python3 -B tests/verify_active_hr_views.py
```

The SQLite SQL verification file
`db/verify/verify_current_job.sql` accepts binds `:empNo` and `:asOfDate`
for the local-runner schema. Use
`db/verify/verify_current_job_historical.sql` for the alternate schema.
Both include a LEFT JOIN from EMPLOYEE so missing history is represented by
NULL values. The main file also contains `EXPLAIN QUERY PLAN` for indexed
history lookups; the query planner's exact choice depends on data.

PostgreSQL staging verification is in
`supabase/verify/20261126_current_employee_job.sql`. Apply migration in
staging, inspect its output and grants, test rollback and reapplication using
the paired rollback script, and only then arrange production deployment.
No live production database was accessed or modified here.

### Cases exercised on synthetic, disposable fixtures

| Case | Expected result |
| --- | --- |
| Multiple Active history rows | Most recent `effDate <= asOfDate` |
| `asOfDate` equals `effDate` | That record is eligible |
| Before first history row | Active employee with NULL assignment fields |
| Future-dated row | Ignored until its effective date |
| Latest row is Inactive | Skip; use latest earlier Active row |
| No history | Active employee with NULL assignment fields |
| Inactive employee | Excluded from batch; single returns null |
| Same-date latest assignments | Explicit ambiguity error (no silent tie-break) |
| Unauthorized caller | Access denied before SQLite query runs |

## Assumptions / open decisions

1. **Who can view salary?** Interim internal check accepts verified Superadmin
   or principals with the `jobhistory.view` right. Do not expose an HR salary
   route before the team approves the role/permission matrix and confirms
   current authentication can provide a trusted identity.
2. **Inactive JOB or DEPARTMENT labels:** Included as historical labels by
   default, mirroring the ticket's base SQL; confirm policy.
3. **Same-date tie-breaker:** If multiple active assignments on the same
   effective date are legitimate, the team must choose the authoritative one.
4. **Schema mismatch:** PostgreSQL/historical SQLite have no historical
   `deptCode`. No schema alteration or fabricated department was introduced.
5. PostgreSQL staging execution and rollback are **not verified locally**;
   only the SQLite variants and static PostgreSQL properties were tested.
