# S2-DBA-04 — Restrict hard deletes and allow safe soft deletes

This source-only patch is intended for an **existing AmbatuPull checkout** that
already includes the earlier S2-DBA-01/02/03 changes. Extract it at your VS Code
project root, keeping the directory names. Review changes to `package.json`,
`scripts/regenerate_hope.py`, and `docs/DATABASE_SETUP.md` before merging if your
branch has additional edits. Do **not** overwrite your existing `.db` files.

## What changed

The three required FKs already restrict hard deletion in SQLite (`NO ACTION`,
equivalent to `RESTRICT` for this check) and PostgreSQL (`RESTRICT`):

- `SALES.custNo -> CUSTOMER.custNo`
- `SALESDETAIL.prodCode -> PRODUCT.prodCode`
- `PRICEHIST.prodCode -> PRODUCT.prodCode`

No FK rebuild is needed. S2-DBA-04 adjusts S2-DBA-03 domain validation so
setting `status = 'Inactive'` and updating `stamp` works even for legacy
payment-term and unit values. Inserts and edits to validated fields still
reject newly invalid values.

## Run locally (SQLite)

Back up your local database, then apply the next ordered migration:

```bash
node scripts/migrate/index.js up --db=./data/erp_local.db --dir=./migrations
python tests/verify_customer_product_restrict.py
npm test
```

The SQL verification source is `db/verify/verify_customer_product_restrict.sql`.
The Python test runner catches its deliberately invalid DELETE operations and
executes everything on in-memory copies: no real records are deleted or edited.

If you need to roll back the **latest** local migration:

```bash
node scripts/migrate/index.js down --steps=1 --db=./data/erp_local.db --dir=./migrations
```

The older `HopeERP.db` / `HOPE_Model1.db` files use
`db/migrations/008_customer_product_referential_soft_delete.sql` and must be
migrated through your established SQLite deployment procedure. The ZIP does
not include or replace database files.

## Supabase (PostgreSQL)

Have an authorized operator deploy
`supabase/migrations/20261118_008_customer_product_referential_soft_delete.sql`
with the team's normal workflow, then run the corresponding SQL verifier:

`supabase/verify/20261118_customer_product_restrict.sql`

This PostgreSQL script uses `saleNo`/`saleDate` from the repository's Supabase
schema, whereas SQLite uses `transNo`/`salesDate`. It creates temporary
fixtures inside a transaction and ends with `ROLLBACK`; it has not been run on
the remote Supabase database.

## Note about `C-001`

The historical HOPE dataset uses customer IDs like `C0001`, not `C-001`.
The verifier creates a temporary `C-001` with linked sales so that the exact
acceptance test can run, then rolls it back. It also checks actual historical
customer `C0001` and product `NB0005` with their existing linked sales data.
