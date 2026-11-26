# S3-TST-04 HR Permission Matrix

**Issue:** #198
**Role:** Test Engineer
**Scope:** Per-action HR API authorization, matching UI control gates, and employee salary privacy under R.A. 10173.

The application names department rights `dept.*` and employee rights `emp.*`; these are the canonical codes for the `department.*` and `employee.*` rights described in the issue. Tests use the actual API/UI permission codes without changing application behavior.

## Per-action matrix

Each server case calls the corresponding endpoint twice as a standard User: once with no grant (expected HTTP 403) and once with only that action's exact grant (expected HTTP 2xx). The UI checks confirm that the matching control's permission expression checks the same right and that the control is conditionally rendered.

| Issue right | Application right | Direct API action | UI control |
|---|---|---|---|
| `job.add` | `job.add` | `POST /api/hr/jobs` | Job Management `canAdd` |
| `job.edit` | `job.edit` | `PUT /api/hr/jobs/:jobCode` | Job Management `canEdit` |
| `job.delete` | `job.delete` | `DELETE /api/hr/jobs/:jobCode` | Job Management `canDelete` |
| `department.add` | `dept.add` | `POST /api/hr/departments` | Department Management `canAdd` |
| `department.edit` | `dept.edit` | `PUT /api/hr/departments/:deptCode` | Department Management `canEdit` |
| `department.delete` | `dept.delete` | `DELETE /api/hr/departments/:deptCode` | Department Management `canDelete` |
| `employee.add` | `emp.add` | `POST /api/hr/employees` | Employee Management `canAdd` |
| `employee.edit` | `emp.edit` | `PUT /api/hr/employees/:empNo` | Employee Management `canEdit` |
| `employee.delete` | `emp.delete` | `DELETE /api/hr/employees/:empNo` | Employee Management `canDelete` |
| `jobhistory.view` | `jobhistory.view` | `GET /api/hr/employees/:empNo/history` | Employee Management `canViewHistory` |
| `jobhistory.add` | `jobhistory.add` | `POST /api/hr/employees/:empNo/history` | Job History `canAdd` |
| `jobhistory.edit` | `jobhistory.edit` | `PUT /api/hr/employees/:empNo/history/:jobCode/:effDate` | Job History `canEdit` |
| `jobhistory.delete` | `jobhistory.delete` | `DELETE /api/hr/employees/:empNo/history/:jobCode/:effDate` | Job History `canDelete` |

## Salary privacy checks

- A User without `jobhistory.view` receives HTTP 403 from the job-history endpoint; a User with that right can access the history and salary.
- The employee list test seeds a salary sentinel in the mocked database row and verifies that the response omits both the salary property and sentinel value. It also checks that the employee-list query does not select salary.

## Execution and limitations

Run the focused matrix:

```powershell
node --test --test-reporter=spec tests/hr-permission-matrix.test.js
```

Run the full repository suite with the matrix included:

```powershell
npm test
```

The Node portion can also be run without the Python prerequisites:

```powershell
node --test --test-reporter=spec tests/customer-list-api.test.js tests/customer-crud.test.js tests/customer-delete-restore.test.js tests/dashboard-navigation-rbac.test.js tests/current-product-price.test.cjs tests/hr-job-history.test.js tests/job-history.test.js tests/hr-permission-matrix.test.js
```

| Command | Result |
|---|---|
| `node --test --test-reporter=spec tests/hr-permission-matrix.test.js` | Passed: 16 tests, 0 failures |
| Node test command above | Passed: 78 tests, 0 failures |
| `npm test` in GitHub Actions `verify` (run `45900899786`) | Passed on Ubuntu, including the HR matrix suite |
| `npm test` on this Windows host | Blocked before tests started: the `python` command is unavailable |
| `git diff --check` | Passed |

The UI verification is a source-contract check of permission expressions and conditional rendering; no browser session or rendered-DOM test was run. Tests exercise the production Express authorization middleware/routes with a database-pool test double; no production source or schema was changed.
