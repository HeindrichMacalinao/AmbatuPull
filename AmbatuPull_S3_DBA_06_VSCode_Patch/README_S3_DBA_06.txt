S3-DBA-06 — HR Lookup & Career Query Performance

PATCH CONTENTS
- migrations/011_hr_lookup_performance_indexes.sql (+ down)
- db/migrations/012_hr_lookup_performance_indexes.sql (+ down)
- supabase/migrations/20261126_013_hr_lookup_performance_indexes.sql
- supabase/rollback/20261126_013_hr_lookup_performance_indexes.down.sql
- db/verify/verify_hr_lookup_performance.sql
- supabase/verify/20261126_hr_lookup_performance.sql
- supabase/verify/20261126_hr_benchmark_fixture.sql
- scripts/benchmark/generate_hr_benchmark.py
- scripts/benchmark/profile_hr_queries.py
- tests/verify_hr_lookup_performance.py
- docs/database/sprint-3-performance.md
- docs/S3_DBA_06.md
- docs/S3_DBA_06_PR_DESCRIPTION.md

LOCAL SQLITE
1. Extract patch contents into the repository root, preserving folders.
2. Generate a disposable 10k/100k benchmark DB:
   python3 -B scripts/benchmark/generate_hr_benchmark.py --output ./data/hr_s3_dba06_benchmark.sqlite --employees 10000 --history-rows 100000 --confirm-non-production
3. Profile before/after and write docs/database/sprint-3-performance.md:
   python3 -B scripts/benchmark/profile_hr_queries.py --database ./data/hr_s3_dba06_benchmark.sqlite --confirm-non-production
4. Run tests:
   python3 -B tests/verify_hr_lookup_performance.py

The generator refuses to overwrite an existing file. The profiler opens the input DB read-only and profiles disposable copies. Do not use a production DB.

POSTGRESQL
- Migration: supabase/migrations/20261126_013_hr_lookup_performance_indexes.sql
- Rollback: supabase/rollback/20261126_013_hr_lookup_performance_indexes.down.sql
- Use supabase/verify/20261126_hr_benchmark_fixture.sql on a disposable local/test/staging database before and after the migration. It inserts fake rows in a transaction and rolls them back.
- PostgreSQL was not available for execution in this workspace; staging validation remains pending.

IMPORTANT
- No pg_trgm extension or SQLite FTS5 virtual table is enabled. Ask for explicit approval before adding either.
- PostgreSQL JOBHISTORY has no deptCode. A join to EMPLOYEE.deptCode returns current department only, not historical department.
- The batch query did not meet the 50ms target in the local SQLite run; see the actual report.
