# S1-DBA-02 — HOPE ERP base tables and historical baseline (SQLite)

## Review fix summary

The historical dataset in the supplied `HopeDB_audit.sql.txt` is **available** and is the source for the seed. The earlier fictional `002_hope_sample_data.sql` is **removed** from this submission. The converted `002_hope_historical_data.sql` imports all 928 historical business records, preserving their source values.

## Deliverables

| Path | Purpose |
| --- | --- |
| `db/migrations/001_hope_base_tables.sql` | Exactly 10 ERP base tables with required PKs, FKs, `status`, and `stamp` |
| `db/seeds/002_hope_historical_data.sql` | 928 approved historical rows adapted to the SQLite schema |
| `db/verify/verify_hope.sql` | Read-only SQL inspection and expected counts |
| `tests/verify_hope.py` | Automated schema, FK, audit, record count, and **full source-to-target parity** tests |
| `scripts/regenerate_hope.py` | Rebuilds both database files from migration and historical seed |
| `HopeERP.db` | Integrated clean SQLite ERP database (10 S1-DBA-02 base tables plus 5 S1-DBA-03 user-management tables) |
| `HOPE_Model1.db` | SQLite copy of original simulation DB with 10 ERP tables added |
| `reference/HopeDB_audit.sql.txt` | Unmodified source historical SQL (PostgreSQL reference, **do not execute on SQLite**) |
| `reference/Model1.db` | Unmodified original simulation database used to reproduce `HOPE_Model1.db` |

## Source mappings and constraints

The historical SQL uses PostgreSQL syntax and the source `payterm` name, while the task requires SQLite `CUSTOMER.payTerms`. The seed explicitly maps that field. The historical `priceHist` inserts list `(effDate, prodCode, unitPrice)`, while the task's composite key is `(prodCode, effDate)`; the seed uses explicit column lists to preserve the correct values.

The source's `audit_log` table, PostgreSQL functions, views, and `is_deleted` soft-delete system are **not imported**: the S1-DBA-02 issue requires **exactly ten ERP tables** with `status VARCHAR(8) NOT NULL DEFAULT 'Active'` (allowed `Active`/`Inactive`) and `stamp VARCHAR(80) NOT NULL`. The historical baseline does not provide original status or stamp values for its records. Every row therefore uses the schema's `Active` default and a nonempty **import provenance stamp** (`ADD historical_import 2026-10-28`). This stamp is new metadata required by the task, not a claimed historical event time. No historical customer, product, employee, sale, payment, job, department, price, or detail values were fabricated or changed.

SQLite uses ISO `YYYY-MM-DD` date strings. **Original historical dates are preserved as supplied**, including any surprising values; source data should not be silently corrected. SQLite preserves `DATE` and `DECIMAL(p,s)` declarations but does not enforce strict date formats or fixed decimal precision by itself. `PRAGMA foreign_keys = ON` must be set **on every connection**.

## Regenerate and test

From the root of the extracted package (or the repository after placing the files at the same relative paths), with Python 3 installed:

```powershell
python scripts/regenerate_hope.py
python tests/verify_hope.py
```

Optional: if your original simulation database is located elsewhere:

```powershell
python scripts/regenerate_hope.py --model1 C:\path\to\Model1.db
```

The regeneration script overwrites only the **generated** `HopeERP.db` and `HOPE_Model1.db` after successfully building them. It does not change `reference/Model1.db` or `reference/HopeDB_audit.sql.txt`. Do **not** apply the historical seed on top of a populated database; rebuild instead.

Optional SQL inspection (if `sqlite3` CLI is installed):

```powershell
sqlite3 HopeERP.db ".read db/verify/verify_hope.sql"
```

### Expected historical counts

| Table | Rows |
| --- | ---: |
| CUSTOMER | 82 |
| PRODUCT | 57 |
| PRICEHIST | 79 |
| EMPLOYEE | 32 |
| JOB | 14 |
| DEPARTMENT | 8 |
| JOBHISTORY | 54 |
| SALES | 124 |
| SALESDETAIL | 313 |
| PAYMENT | 165 |
| **Total** | **928** |

For the combined S1-DBA-03 package, the clean ERP database additionally contains 5 user-management tables and SQLite’s internal `sqlite_sequence` table. See [S1_DBA_03.md](S1_DBA_03.md).

The automated verifier also checks exact columns/types, composite primary keys, all nine foreign keys, rejection of orphan inserts, invalid statuses and null stamps, joins, and exact values of **every historical business row** against the original source. For `HOPE_Model1.db`, it also checks that the original simulation tables and their contents were preserved.

## Repository integration

These files are prepared at repository-relative paths. Upload the **contents** of this package at the repo root, not an extra nested folder. The earlier PR uploaded files under `HOPE_S1_DBA_02_Historical_Updated/HOPE_S1_DBA_02_Historical/`; remove that duplicate directory after moving the corrected files. Delete the old fictional `db/seeds/002_hope_sample_data.sql` if it is still present. Do not replace the project's main `README.md` without merging its existing content; link to this document instead.

The public repository branch reviewed for PR #51 did not expose `migrations/001_init_core_schema.sql` or `scripts/migrate/index.js`; these files were **not modified or recreated speculatively**. If the team's S1-DBA-01 migration runner exists in a newer/private branch, register the SQL migration and seed with that runner following its own conventions before merge.
