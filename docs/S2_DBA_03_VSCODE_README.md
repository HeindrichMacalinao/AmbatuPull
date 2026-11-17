# S2-DBA-03 (#102) — VS Code installation and validation

Copy this archive's files into the **root** of the existing AmbatuPull project,
keeping the `migrations/`, `db/`, `supabase/`, `scripts/`, `tests/`, and `docs/`
folder structure. This patch builds on the previous S2-DBA-01 and S2-DBA-02
changes; do not replace unrelated work or overwrite existing database files.

## Check the existing database first

```bash
python scripts/check_domain_constraint_readiness.py HopeERP.db
```

The historical baseline has 58 customer payment-term values (`30D`/`45D`) and
57 product unit values (`ea`/`pc`) outside issue #102's allowed lists. The
existing `License`, `Service`, and `User/Mo` values in `data/erp_local.db` are
preserved as valid units. An exit code of **2** is the expected warning, not a
script crash. Consult the team for approved mappings; never guess or silently
rewrite historical rows.

## Apply local SQLite migration

Back up your database before migrating. The normal migration command targets
`data/erp_local.db` unless `DB_PATH` or `--db` overrides it:

```bash
node scripts/migrate/index.js up --db=./data/erp_local.db --dir=./migrations
node scripts/migrate/index.js status --db=./data/erp_local.db --dir=./migrations
```

For existing historical `HopeERP.db`/`HOPE_Model1.db` files managed outside the
runner, apply `db/migrations/007_customer_product_domain_constraints.sql`
through your existing SQLite deployment process. Do not re-seed or overwrite
a database that contains user data. `scripts/regenerate_hope.py` installs these
checks *after* historical seeding when building a disposable baseline database.

To undo the last local runner migration (only if it is S2-DBA-03):

```bash
node scripts/migrate/index.js down --steps=1 --db=./data/erp_local.db --dir=./migrations
```

## Supabase / PostgreSQL

Deploy `supabase/migrations/20261117_007_customer_product_domain_constraints.sql`
with the team's approved Supabase migration workflow. It uses `CHECK ... NOT VALID`:
new writes are checked while incompatible historical rows remain unchanged.
After approved cleanup, validate each named constraint in a later migration.
This ZIP does not deploy or modify your live Supabase project.

## Verify

```bash
python tests/verify_domain_constraints.py
npm test
npm run build
```

Both existing `status` constraints and the `(prodCode, effDate)` composite
primary key remain in force. `custNo` is required, nonblank and at most 10
characters, rather than forcing the incompatible `C-` prefix; nullable
`payTerms` and `unit` are preserved as specified by the original schema.

**Important cross-task decision:** S2-DBA-02's Figure 11 test fixture includes
`P-003 = 0.00`, but issue #102 now disallows zero-valued `PRICEHIST.unitPrice`.
That test-only fixture is not seeded into the live historical database.
