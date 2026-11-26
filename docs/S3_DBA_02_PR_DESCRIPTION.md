## [S3-DBA-02] Parameterized employee as-of position lookup

Added a parameterized SQLite single/batch lookup, a SECURITY INVOKER
PostgreSQL function, safe schema-specific SQL verification scripts, and tests.

- Retrieves the latest Active JOBHISTORY row with `effDate <= asOfDate`.
- Keeps an employee visible with NULL assignment values when history is absent.
- Restricts batch output to Active employees.
- Fails on ambiguous same-date latest assignments rather than choosing silently.
- Returns NULL department details in PostgreSQL/historical SQLite because
  those JOBHISTORY tables do not store historical `deptCode`.

**Security:** Salary is sensitive; no public view or route was created. The
PostgreSQL function uses SECURITY INVOKER and revokes anon/authenticated
EXECUTE privileges. Only a server-side, authenticated HR endpoint may use
service-role credentials, after checking `jobhistory.view` permission.

**Required decisions:** Confirm whether inactive JOB/DEPARTMENT labels should
remain visible, which roles may view salary, and the same-date tie-breaker if
that is ever allowed. Existing SQL base query does not filter inactive labels;
the helper preserves historical labels by default.

**Validation:** SQLite fixture tests passed. PostgreSQL staging execution
remains required before deploying the function.
