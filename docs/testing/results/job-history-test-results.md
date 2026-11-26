# Job History Test Results

**Task:** S3-TST-03
**Issue:** #197
**Role:** Test Engineer
**Status:** Automated job-history acceptance coverage added and passing.

## Test cases

| ID | Scenario | Expected result | Automated check |
|---|---|---|---|
| TC-JH-01 | Insert an exact duplicate `(empNo, jobCode, effDate)` | Composite primary key rejects the duplicate | `tests/job-history.test.js` |
| TC-JH-02 | Record the same employee/job on another effective date | Both tenure records are stored | `tests/job-history.test.js` |
| TC-JH-03 | Insert history with a missing employee, job, or department | Each invalid foreign-key reference is rejected | `tests/job-history.test.js` |
| TC-JH-04 | Read a multi-entry career timeline | Entries are ordered by descending effective date; the newest entry is current | `tests/job-history.test.js` |
| TC-JH-05 | Update historical salary and attempt a negative salary | Valid changes persist; negative salary is rejected without replacing the valid value | `tests/job-history.test.js` |
| TC-JH-06 | Soft-delete and restore one history entry | Only the selected row leaves and re-enters the active-history view | `tests/job-history.test.js` |

The tests initialize an isolated in-memory SQLite database with the repository's
migrations, so they exercise the schema constraints, triggers, and active
history view without modifying application code or a local database.

## Execution

Run the new database-backed suite together with the existing job-history API
regressions:

```powershell
node --test tests/job-history.test.js tests/hr-job-history.test.js
```

| Command | Result |
|---|---|
| `node --test tests/job-history.test.js tests/hr-job-history.test.js` | Passed: 7 tests, 0 failures |
| `git diff --check` | Passed |

The broader `npm test` suite was not run; this change adds a separate focused
suite and does not change the existing test command.
