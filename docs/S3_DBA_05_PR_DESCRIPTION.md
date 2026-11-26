## [S3-DBA-05] Add guarded Sprint 3 HR demo seed (partial)

### Summary
Adds a transaction-safe, idempotent **SQLite demo seed** for the HR values explicitly provided in the ticket: four jobs, four departments, four employees, and two career-history rows for E-001.

### Changes
- Created `db/seeds/004_human_resources_seed.sql` in foreign-key order with an existing-value guard and `ON CONFLICT DO NOTHING`.
- Created an opt-in non-production runner and read-only verification SQL.
- Added repeatability and integrity tests for both SQLite schemas.
- Added a PostgreSQL staging schema preflight and documented blockers.

### Local verification
- [x] Two consecutive SQLite seed runs on each schema variant
- [x] E-004 excluded from active view; separated on 2025-12-31
- [x] E-001 salary 52,000 on 2026-11-26 and 45,000 on 2022-12-31
- [x] Conflicting existing demo key rejected; foreign keys preserved
- [ ] E-002/003/004 history (Figures 16–17 missing)
- [ ] Exact Figures 15–22 matching
- [ ] PostgreSQL staging seed (source schema incompatible)

### Security / data integrity
No user data is rewritten; the seed is non-production only. Existing HR domain/foreign-key triggers remain enforced. No schema changes, permissions, or salary API exposure were added. The PostgreSQL migration is intentionally blocked pending approved schema mapping rather than inventing personal or employment details.

**Status: PARTIAL; do not merge as full acceptance of S3-DBA-05.**
