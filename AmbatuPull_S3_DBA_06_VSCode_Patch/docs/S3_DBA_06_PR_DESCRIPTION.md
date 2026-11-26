## [S3-DBA-06] Profile and tune HR lookup indexes

### Summary
Profiled employee search, employee ID lookup, JobHistory timeline/as-of queries, batch career joins, and S3-DBA-04 child-reference lookups. Added reversible SQLite and PostgreSQL indexes without changing application behavior or removing existing indexes.

### Changes
- Added a partial covering active employee-name index for the narrow search projection.
- Added child-side FK indexes for employee/job and job-history job/department references where those columns exist.
- Added a partial covering active JobHistory index for employee/date lookups and descending career history.
- Added deterministic synthetic benchmark generators, parameterized profiling queries, and automated migration/benchmark tests.
- Documented actual SQLite plans/timings and PostgreSQL limitations in `docs/database/sprint-3-performance.md`.

### Validation
- [x] SQLite benchmark with 10,000 employees and 100,000 JobHistory rows
- [x] SQLite `ANALYZE` + `EXPLAIN QUERY PLAN` before/after
- [x] SQLite runner migration up/down/up
- [x] Historical SQLite migration up/down/up
- [x] SQLite integrity and foreign-key checks
- [ ] PostgreSQL staging benchmark and migration execution pending

### Performance notes
The selective SQLite lookups were below 50 ms in the local run. The batch query returning 9,499 active employees remained above the target; actual measurements and plans are in the benchmark report. `LIKE '%term%'` remains a scan because B-tree indexes do not support leading-wildcard substring search.

### Security / risks
No extensions, credentials, RLS changes, grants, or application authorization changes were introduced. Salary authorization remains enforced by the existing server-side permission contract. PostgreSQL index creation should be tested on staging due to build locks and write overhead. The PostgreSQL schema lacks `JOBHISTORY.deptCode`, so its department join is current employee department, not historical department.
