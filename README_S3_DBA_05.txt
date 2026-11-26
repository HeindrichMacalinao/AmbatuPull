AmbatuPull S3-DBA-05 — PARTIAL HR SEED (VS Code patch)

1. Extract ZIP into the root of your existing AmbatuPull project.
2. Do not replace database files, migrations, or production Supabase data.
3. Run: python3 -B tests/verify_sprint3_hr_demo_seed.py
4. See docs/S3_DBA_05.md for non-production seed application and verification.
5. Critical: Figures 16-17 are missing. Job history for E-002/E-003/E-004
   was NOT fabricated. PostgreSQL schema differs and cannot accept an exact
   seed without approved schema changes and the missing current assignments.
6. This patch is PARTIAL and not ready for a fully-complete ticket signoff.
