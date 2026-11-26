S3-DBA-03 GitHub/VS Code patch — HR constraints

1. Extract the ZIP; copy files into the corresponding directories of your existing AmbatuPull checkout.
2. Review migration numbering before committing (migrations/009 and db/migrations/010 and Supabase ..._011).
3. Run the read-only HR preflight from docs/S3_DBA_03.md.
4. Run: python3 -B tests/verify_hr_constraints.py
5. Run existing regression tests: python3 -B tests/verify_active_hr_views.py
   and node --test tests/employee-position-as-of.test.cjs
6. Stage and review the patch in Git; deploy against a nonproduction database only.
7. DO NOT directly apply PostgreSQL migration to production; the provided PG schema has no employee gender/birthDate columns.

No database files, credentials, or historical employee rows are included in this ZIP.
