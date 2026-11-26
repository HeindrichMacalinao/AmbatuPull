# Jobs and Departments Lookup Test Results

**Task:** S3-TST-01
**Issue:** #195
**Role:** Test Engineer
**Scope:** Lookup CRUD, live search, role-specific views, soft delete/restore, and department-history restriction.

## Automated cases

| Case | Scenario | Result |
|---|---|---|
| JOB-CRUD-01 | Create a job with a unique code; reject a duplicate code with 409 | Passed |
| JOB-CRUD-02 | Edit the job description and record an `EDITED` audit stamp | Passed |
| JOB-STATUS-01 | Soft-delete without removing the row, set it Inactive with a `DELETED` stamp, then restore it to Active | Passed |
| JOB-SEARCH-ROLE-01 | Admin status filters/counts and case-insensitive description search; User is restricted to Active jobs and receives no `status`, `stamp`, or status counts | Passed |
| DEPT-CRUD-01 | Create a department with a unique code; reject a duplicate code with 409 | Passed |
| DEPT-CRUD-02 | Edit the department name and record an `EDITED` audit stamp | Passed |
| DEPT-STATUS-01 | Soft-delete without removing the row, set it Inactive with a `DELETED` stamp, then restore it to Active | Passed |
| DEPT-FK-01 | Reject department soft delete with 409 when an active job-history row references it; preserve its Active status | Passed |
| DEPT-SEARCH-ROLE-01 | Admin status filters/counts and department-name search; User is restricted to Active departments and receives no `status`, `stamp`, or status counts | Passed |
| UI-ROLE-01 | Assert privileged status filters, Admin status/stamp columns, shaded inactive rows and restore controls; User view excludes privileged filters | Passed |

The UI case checks the existing component source contract; no interactive browser/manual session was run.

## Execution

```powershell
node --test --test-reporter=spec tests/hr-lookups.test.js
```

**Result:** Passed — 2 tests, 2 passed, 0 failed. The expected duplicate-code and active-history 409 cases are logged by the existing API error handler during the test.
