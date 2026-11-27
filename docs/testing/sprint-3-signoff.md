# Sprint 3 Quality Sign-Off

**Task:** S3-TST-06
**Issue:** #200
**Role:** Test Engineer
**Review date:** 2026-11-27
**Disposition:** Conditional QA sign-off. Automated checks pass and no Critical or High defects are open. Live smoke/manual validation remains a release gate; production readiness is not unconditionally approved.

## Defect triage

| Triage item | Finding |
|---|---|
| Open Critical defects | 0 |
| Open High defects | 0. The open High issues #175 (Sprint review/demo coordination) and #200 (this sign-off task) are project tasks, not defect reports. |
| Sprint 3 bug-labeled issues | None found. Defect closure percentage is N/A because no defect issues were logged; outstanding Critical/High defect count is 0. |
| Sprint 3 implementation issues | Issues #176–#194 are closed. Their database, HR API, and HR UI implementation PRs are merged into `main`. |
| Sprint 3 test issues | Issues #195–#199 are closed; test PRs #222–#226 are merged into `main`. |
| Regression finding | The Sprint 2 soft-delete UI contract test referenced a removed `action` object pattern. It was updated to assert the current Restore/Delete handlers; no production defect was found. |
| Known non-production limitation | The S3-DBA-05 demo HR seed is explicitly partial because source Figures 16–17 were unavailable and the PostgreSQL schema differs. The seed verifier documents that full seed acceptance is not claimed. |

## HR coverage and permission tiers

| Area | Automated coverage | Roles/permissions exercised |
|---|---|---|
| Jobs and departments | Lookup/search, CRUD, active/inactive visibility, child-record restrictions, and audit stamps | User and Admin role views; action rights and Admin/Superadmin restore restrictions |
| Employees | List/search, create/edit validation, status visibility, separation dates, soft delete/restore, and stamps | User and Admin views; `emp.add`, `emp.edit`, `emp.delete`; Admin-only restore |
| Job history and salary privacy | Composite key/FK integrity, salary progression, salary access gate, and salary omission from employee lists | `jobhistory.view` grant/revocation; standard User and elevated-role behavior |
| HR permission matrix | All 13 HR API actions tested for denied and exact-grant behavior; matching UI control gates checked | Standard User per-action rights; Admin/Superadmin bypass and restore behavior in related route/service tests |

The relevant suites are `tests/hr-lookups.test.js`, `tests/employee-crud.test.js`, `tests/hr-employees-list.test.js`, `tests/hr-job-history.test.js`, `tests/job-history.test.js`, and `tests/hr-permission-matrix.test.js`. All six are included in `npm test`.

## Commands

Run the complete Node suite without the Python prerequisite:

```powershell
node --test --test-reporter=spec tests/customer-list-api.test.js tests/customer-crud.test.js tests/customer-delete-restore.test.js tests/dashboard-navigation-rbac.test.js tests/current-product-price.test.cjs tests/hr-job-history.test.js tests/job-history.test.js tests/hr-permission-matrix.test.js tests/auth-flow.test.js tests/user-management.test.js tests/superadmin-governance.test.js tests/s2-tst-05-sprint1-regression.test.cjs tests/smoke.test.js tests/product-crud.test.js tests/product-list-api.test.js tests/price-history.test.js tests/s2-tst-02-product-price-acceptance.test.cjs tests/product-delete-restore.test.js tests/s2-tst-03-soft-delete-restore-acceptance.test.cjs tests/s2-tst-04-permission-matrix-acceptance.test.cjs tests/permission-matrix.test.js tests/hr-lookups.test.js tests/employee-crud.test.js tests/hr-employees-list.test.js
```

Run the six HR suites:

```powershell
node --test --test-reporter=spec tests/hr-lookups.test.js tests/employee-crud.test.js tests/hr-employees-list.test.js tests/hr-job-history.test.js tests/job-history.test.js tests/hr-permission-matrix.test.js
```

Run the repository command and the live smoke suite:

```powershell
npm test
$env:BASE_URL = "http://localhost:3000"
npm run test:smoke
```

## Verification results

| Verification | Result |
|---|---|
| `node --test --test-reporter=spec` over the 24 Sprint 1–3 Node test files | Passed: 220 total, 205 passed, 15 skipped, 0 failed. Skips require `BASE_URL` for live HTTP cases. |
| Focused HR suite (six files above) | Passed: 37 tests, 0 failures. |
| Latest `main` CI before this sign-off branch (`npm test`, run `46011558643`) | Passed: 13 Python verification scripts and 206 Node tests (191 passed, 15 skipped, 0 failed). |
| Local `npm test` on Windows | Blocked before Python verification: the `python` command is unavailable. |
| Live smoke/manual regression | Not run. No application server or test database was provisioned; the three `tests/smoke.test.js` HTTP cases require `BASE_URL`. |
| `git diff --check` | Passed. |

The current branch adds the three HR suites that were not yet part of the `main` test command; branch CI is required to validate the expanded 220-test command. The local Node run found no failures, but skipped live cases are not counted as passed.

## Sign-off

The merged Sprint 3 HR implementation and test PRs are present on `main`, and the latest main CI run passed. No open Critical or High defects were found. QA sign-off is **conditional**: run the live smoke suite and manual acceptance checks against the coordinated Sprint 3 demo environment before claiming production readiness.
