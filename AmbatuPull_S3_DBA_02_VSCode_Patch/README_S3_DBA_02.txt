S3-DBA-02 VS Code Patch for the existing AmbatuPull repository
==============================================================

Extract the ZIP to your project ROOT with the supplied relative paths.
Do NOT extract it into a separate nested folder inside the repository.
No previous migration or database asset is overwritten.

Main commands (run from project root):
  node --test tests/employee-position-as-of.test.cjs
  python3 -B tests/verify_current_job_sql.py
  python3 -B tests/verify_active_hr_views.py

Read docs/S3_DBA_02.md for schema differences, security gates,
and PostgreSQL staging/rollback steps.

Important: This patch adds no SQLite migration because the parameterized
SQL helper changes no SQLite database schema. The PostgreSQL migration
creates one SECURITY INVOKER function, with a paired rollback file.
The salary-returning function is not exposed to browser Supabase roles.

No service credentials included. Production databases not accessed.
