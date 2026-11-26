# Employee Master Test Results

**Task:** S3-TST-02
**Issue:** #196
**Role:** Test Engineer
**Scope:** Employee CRUD, business-date validation, separation versus soft-delete status, restore, and role-based visibility.

## Automated cases

| Case | Scenario | Result |
|---|---|---|
| EMP-CRUD-01 | Create employee with demographics and valid dates; default status is Active and stamp is `CREATED` | Passed |
| EMP-CRUD-02 | Reject duplicate employee number with HTTP 409 | Passed |
| EMP-DATE-01 | Reject `sepDate` before `hireDate` with HTTP 400; accept equality at the boundary | Passed |
| EMP-DATE-02 | Reject `birthDate` equal to or later than `hireDate` with HTTP 400 | Passed |
| EMP-DATE-03 | Reject impossible calendar dates and invalid edits without changing stored data | Passed |
| EMP-SEP-01 | Employee `E-004 Garcia` with `sepDate = 2025-12-31` remains Active until explicitly soft-deleted | Passed |
| EMP-CRUD-03 | Edit employee details and verify the `EDITED` audit stamp | Passed |
| EMP-DELETE-01 | Soft-delete preserves `sepDate`, sets status to Inactive, and records a `DELETED` stamp | Passed |
| EMP-ROLE-01 | Admin can see inactive employee and audit fields; User listing enforces `status = 'Active'` and omits status/stamp/count fields | Passed |
| EMP-RESTORE-01 | User restore is denied; Admin restore returns the record to Active while preserving `sepDate` | Passed |
| EMP-UI-01 | Assert employee form date constraints and Admin-only status/stamp columns plus inactive-row shading | Passed |

The UI case checks the existing component source contract; no interactive browser/manual session was run.

## Execution

```powershell
node --test --test-reporter=spec tests/employee-crud.test.js
```

**Result:** Passed — 7 tests, 7 passed, 0 failed, including separate subtests for create/edit, date validation, User listing, and soft-delete/restore. The User listing test also asserts the emitted SQL forces Active-only results. Expected duplicate and invalid-date HTTP errors are logged by the existing API error handler during negative cases.
