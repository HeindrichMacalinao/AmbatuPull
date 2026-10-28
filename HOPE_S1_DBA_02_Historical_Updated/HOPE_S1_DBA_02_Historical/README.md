# S1-DBA-02 — HOPE ERP base tables with historical seed (SQLite)

## What changed
The supplied `HopeDB_audit.sql.txt` contains the HOPE historical sample records. This revised package replaces the earlier fictional sample seed with the historical data adapted for the exact S1-DBA-02 ten-table schema.

## Files
- `db/migrations/001_hope_base_tables.sql`: original ten-table migration, unchanged.
- `db/seeds/002_hope_historical_data.sql`: converted historical INSERTs (run after migration).
- `db/verify/verify_hope.sql`: verification queries.
- `tests/verify_hope.py`: tests from earlier package; use only if compatible with historical IDs.
- `HopeERP_Historical.db`: clean ten-table SQLite database with historical records.
- `HOPE_Model1_Historical.db`: original Model1.db simulation tables preserved, plus HOPE tables with historical records.
- `reference/HopeDB_audit.sql.txt`: exact original PostgreSQL reference (DO NOT run against SQLite).

## Important schema differences
The supplied historical file targets **PostgreSQL**, uses `is_deleted` (boolean) rather than `status` (`Active`/`Inactive`), creates an extra `audit_log` table, and adds triggers/views. These audit features are NOT included in the SQLite migration because Task S1-DBA-02 explicitly requests exactly ten tables with `status VARCHAR(8)` and `stamp VARCHAR(80)`. The original reference is retained for the team to decide whether a separate audit-implementation task is required.

The original `customer.payterm` field maps to `CUSTOMER.payTerms` and `priceHist` source order is `(effDate, prodCode, unitPrice)`; explicit target column lists preserve values correctly. All imported records use default `Active` and the nonempty stamp `ADD historical_import 2026-10-28`. This stamp indicates import provenance, not an original historical event timestamp.

## Run on a fresh SQLite database
```powershell
python -c "import sqlite3, pathlib; c=sqlite3.connect('HopeERP.db'); c.executescript(pathlib.Path('db/migrations/001_hope_base_tables.sql').read_text()); c.executescript(pathlib.Path('db/seeds/002_hope_historical_data.sql').read_text()); c.close()"
```

Do NOT run the new seed over the previous fictional seed, or on a database already containing these historical records. Use a new empty database, or the pre-populated DB included in this ZIP.

SQLite requires `PRAGMA foreign_keys = ON` **on every connection**. To verify with CLI:
```powershell
sqlite3 HopeERP_Historical.db < db/verify/verify_hope.sql
```

This project is not automatically pushed to GitHub. Confirm the team's chosen DB engine before merging: PostgreSQL requires a PostgreSQL-specific version of the S1-DBA-02 migration.
