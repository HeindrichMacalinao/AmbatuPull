# PR: [S3-DBA-01] Add active HR views and query indexes

## Summary
- Add `v_active_employees`, `v_active_jobs`, `v_active_departments`, and `v_active_jobhistory` with `SELECT *` and `status = 'Active'` filtering.
- Add four indexes on employee names, job/department lookups, and chronological employee job history.
- Provide SQLite up/down migrations, an alternate asset-schema migration, a PostgreSQL 15+ Supabase migration and manual rollback, plus EXPLAIN-based verification.
- Update the historical SQLite regeneration script to install S3 views/indexes.

## Validation
- `python3 -B tests/verify_active_hr_views.py` — passed for both SQLite schema variants and runner up/down/up.
- SQLite EXPLAIN QUERY PLAN selects all four new indexes with the tested queries.
- `npm test` against the available archived source — blocked by a missing pre-existing `tests/verify_user_registration_time.py` file; not attributable to this migration.
- Supabase PostgreSQL migration not executed (staging access unavailable).

## Security and release notes
- PostgreSQL views use `security_invoker = true`; migration grants no new client/API privileges and revokes access from PUBLIC/anon/authenticated.
- `SELECT *` includes sensitive personnel and `JOBHISTORY.salary`; only authorized backend/admin use is appropriate until narrower view columns are approved.
- PostgreSQL 15+ and actual RLS/table grants must be verified on staging. Indexes can affect write performance/locks on large tables.
- Do not deploy to production without review of the current migration numbers, staging checks, and a rollback plan.
