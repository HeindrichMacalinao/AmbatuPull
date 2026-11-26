## [S3-DBA-04] Enforce HR parent/child integrity and safe soft-deletion

### Summary
Added database-level hard-delete protections, active job/department guards, employee restoration checks, and active job-history parent validation. Existing foreign keys remain unchanged; no tables are rebuilt.

### Changes
- Reversible SQLite migrations for both the main and historical HR schema variants.
- PostgreSQL/Supabase trigger-based protections with carefully restricted function execution and row locking.
- Safe verification SQL plus negative/positive automated tests, including Node migration up/down/up.
- Preflight orphan detection with no automatic cleanup.

### Business rules
- Active history means any `JOBHISTORY.status='Active'` row, not only the latest assignment.
- Referenced JOB/DEPARTMENT hard-deletes are blocked even if history is inactive, preventing loss of historical references.
- A JOB/DEPARTMENT linked to active history cannot be soft-deleted.
- EMPLOYEE hard-delete is blocked when referenced by history or sales (where that FK exists); employee soft-delete keeps history intact.
- Restored/current employee references and new active history cannot point at inactive parents.

### Verification
- [x] Main SQLite: up/down/up and expected failures
- [x] Historical SQLite: up/down/up and expected failures
- [x] Both bundled DBs: cloned/data-preservation and integrity checks
- [x] Node migration runner: up/down/up on temporary DB
- [x] S3-DBA-01/02/03 targeted regression tests
- [ ] PostgreSQL staging migration, rollback, access-control and concurrent-write tests

### Risks / limitations
Supabase's committed schema has no `JOBHISTORY.deptCode` and no `SALES.empNo`. Thus direct historical department links and employee-sales dependencies cannot be enforced in PostgreSQL without an approved schema change. The migration preserves existing relations, warns about these gaps, and protects currently represented HR links. The PG functions require least-privileged ownership and staging concurrency verification. No production database was touched.
