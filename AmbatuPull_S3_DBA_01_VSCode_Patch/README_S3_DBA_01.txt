S3-DBA-01 — HR active views and indexes, VS Code patch
======================================================

This is an ADDITIVE patch for your existing AmbatuPull project; extract it at
repository ROOT and keep its folder structure. It is NOT a full project copy.

Migration paths observed from the November 12 archived repository plus S2
patches available through November 20:
  migrations/008_active_hr_views_indexes.sql
  migrations/008_active_hr_views_indexes.down.sql
  db/migrations/009_active_hr_views_indexes.sql
  supabase/migrations/20261126_009_active_hr_views_indexes.sql
  supabase/rollback/20261126_009_active_hr_views_indexes.down.sql

IMPORTANT: Check CURRENT branch before copying. A more recent migration may
already use number 008/009. If so, choose the next unused ordered number and
update matching references. The live GitHub repository could not be accessed.

Run on your existing project from a FEATURE branch:
  python3 -B tests/verify_active_hr_views.py

Optional, on a disposable SQLite database ONLY:
  node scripts/migrate/index.js up --db=/tmp/hr_test.db --dir=./migrations
  node scripts/migrate/index.js down --steps=1 --db=/tmp/hr_test.db --dir=./migrations
  node scripts/migrate/index.js up --db=/tmp/hr_test.db --dir=./migrations

WARNING: The local runner applies ALL pending migrations, not only S3-DBA-01.
Use a disposable database and ensure you have the earlier migrations first.

Supabase/PostgreSQL migration requires PG 15+; test in staging, back up before
production. It does not grant SELECT to anon/authenticated. Direct SELECT *
HR views can expose salary and personal data; restrict to authorized server
roles or obtain approval for a narrower projection. See docs/S3_DBA_01.md.

Local test results: docs/verification_results_S3_DBA_01.txt
Short PR description: docs/S3_DBA_01_PR_DESCRIPTION.md
