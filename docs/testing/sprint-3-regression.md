# Sprint 3 Regression Test Log

**Task:** S3-TST-05  
**Issue:** #199  
**Role:** Test Engineer  
**Status:** All executable local Node regression cases pass; live smoke and manual verification remain pending.

## Coverage

| Sprint area | Regression coverage | Automated checks |
|---|---|---|
| Sprint 1 authentication | Registration hashing and response privacy, session cookie/login/logout, blocked-account access, and password-reset contracts | `tests/auth-flow.test.js`, `tests/s2-tst-05-sprint1-regression.test.cjs` |
| Sprint 1 user administration | Admin visibility restrictions, Superadmin role protection, and last-active-Superadmin safeguards | `tests/user-management.test.js`, `tests/superadmin-governance.test.js`, `tests/s2-tst-05-sprint1-regression.test.cjs` |
| Sprint 1 smoke | Superadmin dashboard, restricted navigation, and blocked-login smoke scenarios | `tests/smoke.test.js`, `tests/s2-tst-05-sprint1-regression.test.cjs` |
| Sprint 2 customers | CRUD, role visibility, soft delete/restore, audit stamps, and foreign-key preservation | `tests/customer-list-api.test.js`, `tests/customer-crud.test.js`, `tests/customer-delete-restore.test.js`, `tests/s2-tst-03-soft-delete-restore-acceptance.test.cjs` |
| Sprint 2 products and prices | Product CRUD/list, chronological effective-price resolution, price history, soft delete/restore, and audit stamps | `tests/product-crud.test.js`, `tests/product-list-api.test.js`, `tests/current-product-price.test.cjs`, `tests/price-history.test.js`, `tests/product-delete-restore.test.js`, `tests/s2-tst-02-product-price-acceptance.test.cjs`, `tests/s2-tst-03-soft-delete-restore-acceptance.test.cjs` |
| Sprint 2 rights | Customer, product, and price add/edit/delete grants and direct-API enforcement | `tests/permission-matrix.test.js`, `tests/s2-tst-04-permission-matrix-acceptance.test.cjs`, `tests/dashboard-navigation-rbac.test.js` |

The soft-delete UI contract test was updated to check the current inactive-row Restore handler and Delete handler instead of the removed `action` object pattern.

## Execution

The full repository command includes the Python contract checks and the Sprint 1–3 Node suites:

```powershell
npm test
```

The Node regression set can be run without Python:

```powershell
node --test --test-reporter=spec tests/auth-flow.test.js tests/user-management.test.js tests/superadmin-governance.test.js tests/s2-tst-05-sprint1-regression.test.cjs tests/smoke.test.js tests/customer-list-api.test.js tests/customer-crud.test.js tests/customer-delete-restore.test.js tests/product-crud.test.js tests/product-list-api.test.js tests/current-product-price.test.cjs tests/price-history.test.js tests/s2-tst-02-product-price-acceptance.test.cjs tests/product-delete-restore.test.js tests/s2-tst-03-soft-delete-restore-acceptance.test.cjs tests/s2-tst-04-permission-matrix-acceptance.test.cjs tests/permission-matrix.test.js tests/dashboard-navigation-rbac.test.js tests/hr-job-history.test.js tests/job-history.test.js tests/hr-permission-matrix.test.js
```

Run the live HTTP smoke suite against a running application:

```powershell
$env:BASE_URL = "http://localhost:3000"
npm run test:smoke
```

| Check | Result |
|---|---|
| Sprint 1–2 and existing regression Node suites | Passed: 206 tests total, 191 passed, 15 skipped, 0 failed. Skips require `BASE_URL` for live HTTP cases. |
| `npm run test:smoke` without `BASE_URL` | Completed: 3 smoke cases skipped; no live server was available. |
| `npm test` on this Windows host | Blocked before Python verification or Node tests: the `python` command is unavailable. |
| Manual end-to-end regression | Not run: no live application/database environment was provisioned. |
| `git diff --check` | Passed. |

No production behavior was changed. The automated test results show no failures in the executable local Node cases; live smoke and manual checks are not claimed as passed.
