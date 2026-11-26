# S3-DBA-05 — Sprint 3 HR demo seed (partial, non-production)

## Source and completion status

This patch uses only the exact HR values in the ticket dated 2026-11-26. The ticket says the JobHistory for **E-002, E-003 and E-004** is in **Student Guide Figures 16–17**, but those figures are **not attached/available** in this workspace. Figures 15–22 cannot be checked against source pages. No unknown job code, effective date, department, salary, status, actor or timestamp was invented.

**Status: PARTIAL.** The SQLite SQL adds **4 jobs, 4 departments, 4 employees, and 2 E-001 history rows**. It does **not** satisfy the complete Figure 15–22 acceptance criterion or full PostgreSQL portability. Supply the missing figures and approve a PostgreSQL schema mapping before marking complete.

## Actual schema and design decisions

| Database variant | EMPLOYEE | JOBHISTORY | Outcome |
| --- | --- | --- | --- |
| `migrations/001_init_core_schema.sql` (local SQLite runner) | `empNo,lastName,firstName,gender,birthDate,hireDate,sepDate,deptCode,jobCode,status,stamp`; `deptCode/jobCode` nullable | `empNo,jobCode,deptCode,effDate,salary,status,stamp`; key `(empNo,jobCode,effDate)` | Seed supported; current `EMPLOYEE.deptCode/jobCode` left `NULL` because ticket supplies historical assignments only, not current employee fields |
| `db/migrations/001_hope_base_tables.sql` (historical SQLite) | Same required demo columns, but no EMPLOYEE current `deptCode/jobCode` | Contains `deptCode`, key `(empNo,jobCode,effDate)` | Seed supported |
| `supabase/migrations/20261108_001_core_erp_schema.sql` (PostgreSQL) | `dateHired,dateSeparated` instead of `hireDate,sepDate`; no `gender`/`birthDate`; `deptCode/jobCode` **NOT NULL** | No `deptCode`; key `(empNo,effDate)` | **BLOCKED:** Cannot represent all specified fields or insert E-002 through E-004 without inventing mandatory current assignments. No PG seed was deployed |

`status` is Active/Inactive and `stamp` is NOT NULL. The ticket does not provide audit authors/timestamps. The technical stamp **`SEED S3-DBA-05`** is a transparent, stable demo identifier, **not** a fabricated activity log. E-004 is represented as `Inactive` with `sepDate='2025-12-31'`; no actual account or user action is claimed.

Both SQLite schema variants have S3-DBA-03 domain triggers, S3-DBA-04 parent/child protection, and S3-DBA-01 active views. The seed does not change or disable any of them. `J-004`/`D-004` are inactive and have **no active child history**, consistent with S3-DBA-04. E-001 history references only active J-001/D-001.

## Idempotency and collision policy

The chosen policy is **skip identical existing primary keys** (`ON CONFLICT(... ) DO NOTHING`), **never reset values**. Before any inserts, the same SQL transaction checks whether an existing demo key has different specified values; if so, the CHECK guard aborts. The script contains no DELETE/TRUNCATE/application-table DROP. `PRAGMA foreign_keys=ON` executes before `BEGIN IMMEDIATE`. Both SQLite variants were tested against their migrations in memory. All changes roll back together on a failed statement when run through the included Python runner.

This policy avoids silently overwriting user records. Do not use a live production database for demonstration data.

## Files

- `db/seeds/004_human_resources_seed.sql`: transaction-scoped SQLite demo seed (partial).
- `scripts/migrate/apply_sprint3_hr_demo_seed.py`: explicit non-production file runner; refuses missing schemas or S3-DBA-03/04 triggers.
- `db/verify/verify_sprint3_hr_demo_seed.sql`: read-only expected-result queries.
- `tests/verify_sprint3_hr_demo_seed.py`: in-memory repeatability, constraints, and negative tests on **both SQLite schema variants**.
- `supabase/verify/20261126_s3_dba05_schema_preflight.sql`: **read-only** PostgreSQL schema compatibility query, not a seed migration.

## Validation on a disposable SQLite database

From repository root:

```bash
python3 -B tests/verify_sprint3_hr_demo_seed.py
```

The automated test initializes each variant's actual migration sequence, applies the seed **twice**, confirms only 4/4/4/2 new rows and checks that the snapshots match byte-for-byte. It also tests `E-004` inactive filtering; the two salary dates; a pre-existing conflicting demo key; foreign-key checks; and SQLite integrity checks.

To seed a pre-migrated *disposable local copy* (not production):

```bash
cp ./data/hr_dev.db ./data/hr_demo_copy.db
python3 -B scripts/migrate/apply_sprint3_hr_demo_seed.py ./data/hr_demo_copy.db --confirm-non-production
```

The copy must already have S3-DBA-01, 03 and 04 installed. In SQLite, `PRAGMA foreign_keys=ON` is per connection, so do not bypass the runner with a connection that disables FKs. To inspect the results with a SQLite client, execute `db/verify/verify_sprint3_hr_demo_seed.sql` as a read-only query script.

**Expected verified values:** J-001/002/003 Active, J-004 Inactive; D-001/002/003 Active, D-004 Inactive; E-001/002/003 Active; E-004 Inactive with `sepDate=2025-12-31`; exactly two supplied E-001 history rows; E-001 salary = **52,000** at **2026-11-26**, **45,000** at **2022-12-31**; no E-004 row in `v_active_employees`. The E-002/003/004 histories are *not* asserted complete.

## PostgreSQL/Supabase migration blocker

Run the **read-only** `supabase/verify/20261126_s3_dba05_schema_preflight.sql` against an authorized staging copy. The committed PostgreSQL schema has incompatible column names, no gender/birth-date fields, no historical `JOBHISTORY.deptCode`, and requires current `EMPLOYEE.jobCode` and `EMPLOYEE.deptCode` for which the ticket supplies no values for E-002/003/004. Adding nullable columns or a mapping, and deciding how to model history, is a separate schema design decision; do not silently infer it. No PostgreSQL insert SQL was fabricated or executed; the seed cannot yet be said to run on both engines.

**Privacy:** Salary and employee birth date are sensitive. Limit access to demo databases and HR views/functions. Use `security_invoker=true` for PostgreSQL views only where supported and enforce application permissions before showing salary. Do not deploy demo records or grant new permissions in production.

## Required follow-up

1. Supply actual Student Guide **Figures 16–17** (and Figures 15–22 if exact visual matching is required). The three missing histories must be transcribed, not inferred.
2. Approve skip-identical vs. reset seed behavior (implemented choice: skip, no updates).
3. Decide PostgreSQL schema mapping: gender/birthDate storage, historical department, and each employee's required current job/dept.
4. Test a complete PostgreSQL seed in staging only, after the schema is approved.
