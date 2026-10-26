# S1-DBA-02 — HOPE ERP base tables (SQLite)

## Files

- `db/migrations/001_hope_base_tables.sql` — creates exactly the ten required ERP tables.
- `db/seeds/002_hope_sample_data.sql` — fictional baseline data for testing.
- `db/verify/verify_hope.sql` — SQL queries for inspection, audit columns, FKs and seed rows.
- `tests/verify_hope.py` — automated assertions, including deliberately rejected orphan records.
- `HOPE_Model1.db` — copy of the supplied `Model1.db` with the 10 ERP tables and the sample records applied. The original simulation tables remain unchanged.
- `HopeERP.db` — standalone clean SQLite sample database containing **only** the ten HOPE tables, already migrated and seeded.

## Engine and assumptions

The uploaded `Model1.db` is a **SQLite 3** database with 15 unrelated simulation tables. The source file has **no** HOPE ERP tables; existing simulation data cannot truthfully be converted to HOPE's customer/product/sales history. Thus the deliverable preserves all simulation tables and **adds** the required 10 HOPE tables to a copy.

The source material `HopeDB_audit.sql` was **not provided**. The seed data in this submission is **fictional demonstration data**, not extracted historical records. Replace it with the actual seed when available.

The issue does not define types for `EMPLOYEE.lastName` or `EMPLOYEE.firstName`; both are defined as `VARCHAR(100)` and nullable. Dates use SQLite's declared `DATE` type; money uses the required `DECIMAL(p,s)` declaration. SQLite stores these with affinity and does not strictly validate DATE formatting or monetary decimal precision. The application must validate them if required. `stamp` is mandatory input and is not auto-generated. The sample uses the documented `CREATED system YYYY-MM-DD HH:MM AM/PM` format.

**IMPORTANT:** `PRAGMA foreign_keys = ON` is a connection-level SQLite setting. Your application must execute it for **every connection**, not only the migration connection.

## Windows / Python quick start

Python 3 includes SQLite support; no Docker required. Place the files in the indicated repository folders.

To apply the scripts to a **new blank database** without needing the `sqlite3` CLI:

```powershell
python -c "import sqlite3, pathlib; c=sqlite3.connect('HopeERP.db'); c.executescript(pathlib.Path('db/migrations/001_hope_base_tables.sql').read_text(encoding='utf-8')); c.executescript(pathlib.Path('db/seeds/002_hope_sample_data.sql').read_text(encoding='utf-8')); c.close()"
python tests/verify_hope.py HopeERP.db
```

To apply to a **copy of `Model1.db`**:

```powershell
Copy-Item Model1.db HOPE_Model1.db
python -c "import sqlite3, pathlib; c=sqlite3.connect('HOPE_Model1.db'); c.executescript(pathlib.Path('db/migrations/001_hope_base_tables.sql').read_text(encoding='utf-8')); c.executescript(pathlib.Path('db/seeds/002_hope_sample_data.sql').read_text(encoding='utf-8')); c.close()"
python tests/verify_hope.py HOPE_Model1.db
```

**Note:** The ZIP already includes `HOPE_Model1.db` and `HopeERP.db` fully migrated and seeded. Do **not** execute the migration or seed again against either populated copy. Run verification directly:

```powershell
python tests/verify_hope.py HOPE_Model1.db
```

If the `sqlite3` CLI is installed, you can inspect the SQL verification with:

```powershell
sqlite3 HOPE_Model1.db < db/verify/verify_hope.sql
```

If a team migration runner from S1-DBA-01 is present, register the migration with that runner instead of executing it manually. Verify the runner targets SQLite; the repository's final DB engine had not been established in its public main branch when this package was prepared.

## Expected verification

- All 10 named HOPE tables exist with required names, types, and audit columns.
- 9 foreign key relationships are declared.
- Both `status` values are valid, and invalid statuses are rejected.
- Every table has records, and joins work.
- A bad reference in every one of the 9 FK relationships throws `sqlite3.IntegrityError`.
- Original `Model1.db` remains untouched.
