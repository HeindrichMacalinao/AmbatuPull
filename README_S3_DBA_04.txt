S3-DBA-04 VS Code Patch — AmbatuPull

1. Extract this ZIP at the root of your EXISTING AmbatuPull repo.
2. Do not replace your checked-in databases or copy ZIP files into GitHub.
3. Confirm migration numbers are unused in your actual branch:
   migrations/010_*, db/migrations/011_*, supabase/migrations/20261126_012_*
4. Run:
   python3 -B tests/verify_hr_referential_integrity.py
   python3 -B tests/verify_hr_constraints.py
   python3 -B tests/verify_active_hr_views.py
   node --test tests/employee-position-as-of.test.cjs
5. Before Supabase deployment, read docs/S3_DBA_04.md, run its preflight on
   staging, verify your live schema, and obtain approval for missing relations.

Files are additive; no database files, app routes, or old migrations overwritten.
