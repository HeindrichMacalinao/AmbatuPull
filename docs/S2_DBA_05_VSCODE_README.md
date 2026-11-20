# S2-DBA-05 — Add demo customers, products and price history

Copy the supplied files to their matching paths under your **existing
AmbatuPull project root** in VS Code. Review `package.json` and
`docs/DATABASE_SETUP.md` before merging if your branch has newer edits.

The core deliverable is:

`scripts/migrate/seed_sprint2_demo_data.sql`

It is a **standalone SQLite seed**, not an ordered migration file. It requires
S2-DBA-03's constraints and the earlier core schema migrations first. It is
safe to rerun and does not overwrite existing demo IDs or non-demo records.

## Seed a local existing database

Back up your local database first. From your VS Code terminal:

```bash
python scripts/migrate/apply_sprint2_demo_seed.py HopeERP.db
```

Or change `HopeERP.db` to the explicit SQLite database you wish to seed, such
as `data/erp_local.db`. The runner refuses to create a missing database and
stops if an existing demo record has conflicting fields.

To verify without altering real data:

```bash
python tests/verify_sprint2_demo_seed.py
npm test
```

The tests use in-memory databases and read-only copies of the bundled assets.

## Known conflict requiring your team's decision

- All **5 customers** and **5 products**, including Inactive C-004 and P-004,
  are seeded exactly as specified.
- Four **positive** price-history rows are seeded for P-001, P-002 and P-005;
  P-004 intentionally has no price.
- The requested P-003 price (`2026-02-01`, `0.00`, Active) **cannot be inserted**
  because S2-DBA-03 enforces `PRICEHIST.unitPrice > 0`. P-003 therefore has
  no price-history row in this safe version, and its current price is `NULL`.

**Do not disable the check, change 0.00 to a fabricated price, or make the
record Inactive without approval.** The Student Guide Figures 9, 11 and 12
were not present in the repository; the seed reflects the values in the issue.

The SQL uses `ON CONFLICT ... DO NOTHING` specifically on demo primary keys so
reapplying it does not duplicate or overwrite records. Price-history `stamp`
reflects the actual import time because the prompt supplied no historical
price-stamp timestamps.
