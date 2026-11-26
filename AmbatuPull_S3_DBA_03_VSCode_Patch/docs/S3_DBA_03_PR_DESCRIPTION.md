## [S3-DBA-03] Enforce Employee and JobHistory HR Domain Rules

### Summary
Add non-destructive HR domain validation in SQLite and a PostgreSQL migration for the corresponding available columns.

### Changes
- Add SQLite INSERT/UPDATE triggers for `gender` (`M/F/O`), canonical dates, separation order, birth-before-hire, and nonnegative salary.
- Keep salary `>= 0`, with zero allowed; retain existing schema nullability.
- Reuse the existing `JOBHISTORY.effDate NOT NULL` constraint and validate canonical dates in SQLite.
- Add reversible SQLite migrations for both schema variants and PostgreSQL named constraints with `NOT VALID`/`VALIDATE`.
- Add preflight read-only queries and automated tests covering valid and invalid INSERT/UPDATE cases, real-data compatibility, and up/down/up.

### Testing
- [x] SQLite constraint tests on both schemas
- [x] Existing bundled database copies pass preflight
- [x] SQLite up/down/up and Node migration runner
- [ ] PostgreSQL staging validation (no Supabase connection)

### Risks and product decisions
- The committed Supabase EMPLOYEE schema lacks `gender` and `birthDate`. This patch does not fabricate them; PostgreSQL cannot enforce those two requirements until the schema owner approves an extension.
- Confirm M/F/O vs another nonbinary format, zero salary policy, and allowed NULLs.
- Avoid exposing salary/HR information through public API roles or the S3-DBA-01 `SELECT *` views.
- Never deploy to production without verifying the current migration sequence, backing up, and testing on staging.
