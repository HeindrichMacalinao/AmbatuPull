# S2-DBA-06 — Customer/Product Search and Price-History Performance Review

**Date:** 2026-11-20  
**Scope:** query plans, disposable local profiling, index/security recommendations only.  
**Change policy:** **no application changes, no index migrations, no production DB writes, no `EXPLAIN ANALYZE`**.

## 1. Schema, engines, and query paths reviewed

The repository has **two database paths**; they must not be treated as identical:

| Path | Source of truth inspected | Runtime/engine evidence |
| --- | --- | --- |
| Local ERP | `migrations/001_init_core_schema.sql`, `src/lib/erp-db.ts`, `src/db/productPrices.cjs` | SQLite; measured `sqlite3.sqlite_version = 3.53.1`, Python 3.12.14 on this Linux test host. |
| Historical bundled ERP | `db/migrations/001_hope_base_tables.sql`, `db/migrations/006_active_customer_product_views_indexes.sql`, `HopeERP.db` | SQLite; bundled database opened **read-only**, then cloned to memory for all execution. |
| Supabase/PG | `supabase/migrations/20261108_001_core_erp_schema.sql`, `20261117_005_active_customer_product_views_indexes.sql`, `20261117_006_product_prices_as_of.sql`, `src/services/customerService.js` | PostgreSQL syntax. Actual deployed PostgreSQL version, statistics, extensions, grants and query plans **not available**; no remote connection was attempted. The view migration specifies PG 15+ for `security_invoker`. |

`CUSTOMER(custNo, custName, address, payTerms, status, stamp)` and
`PRODUCT(prodCode, description, unit, status, stamp)` both use `status = 'Active'`
for ordinary-list views. `PRICEHIST(prodCode, effDate, unitPrice, status, stamp)`
has a composite primary key `(prodCode, effDate)`. SQLite stores effective dates
as ISO `YYYY-MM-DD` text. The two views are `v_active_customer` and
`v_active_product` (active records only).

Existing relevant indexes in **both** SQLite migration variants and the
PostgreSQL/Supabase migration:

- `idx_customer_status_custname` on `CUSTOMER(status, custName)`.
- `idx_product_status_description` on `PRODUCT(status, description)`.
- `idx_pricehist_prodcode_effdate_status` on `PRICEHIST(prodCode, effDate, status)`.
- Implicit primary-key index on `CUSTOMER(custNo)`, `PRODUCT(prodCode)`, and
  `PRICEHIST(prodCode, effDate)`. SQLite index names for these are generated.

Actual call paths:

1. `src/services/customerService.js::listCustomers()` (PostgreSQL pool) and
   `src/lib/erp-db.ts::getCustomers()` (SQLite) use a three-field, bound
   case-insensitive `LIKE '%term%'` search across `custNo`, `custName`, and
   `address`. Ordinary users read `v_active_customer`; authorized admin
   inactive/all views use `CUSTOMER`. Both return `ORDER BY custNo ASC`.
2. `src/db/productPrices.cjs::PRODUCT_PRICES_AS_OF_SQL` reads **all** `PRODUCT`
   rows and uses a correlated `PRICEHIST` subquery with bound `effDate <= ?`,
   `status = 'Active'`, `ORDER BY effDate DESC LIMIT 1`. The equivalent Supabase
   function is `product_prices_as_of(p_target_date DATE)`. **No product search
   or description-filter API was found** in these paths; the filtered product
   plan below is a proposed query shape, *not* existing application behavior.
3. The dashboard reads only active customer/product **counts** from their
   views. Product pricing does not currently filter inactive parent products;
   callers must enforce the intended product visibility and rights before
   exposing this all-product result.

## 2. Non-executing `EXPLAIN` evidence (existing SQLite DB)

Opened `HopeERP.db` using SQLite URI `mode=ro`, issued only
`EXPLAIN QUERY PLAN` (not `EXPLAIN ANALYZE`), with bound placeholders. **No
customer names, addresses or row values were emitted.** Bundled baseline size:
82 customers, 57 products, 79 price-history records.

| Query shape | Observed SQLite plan lines (significant parts) | Interpretation |
| --- | --- | --- |
| Active customer live search, `LOWER(...) LIKE '%term%'` on three fields, `ORDER BY custNo` | `SEARCH CUSTOMER USING INDEX idx_customer_status_custname (status=?)`; `USE TEMP B-TREE FOR ORDER BY` | Index narrows by active status, **not by name substring**; another sort is necessary. |
| Active customer exact `custName = ?` | `SEARCH CUSTOMER USING INDEX idx_customer_status_custname (status=? AND custName=?)` | Good fit for active + exact-name lookup. |
| Admin all-status substring search | `SCAN CUSTOMER USING INDEX sqlite_autoindex_CUSTOMER_1` | Customer PK scan; no active-status narrowing. |
| Existing all-product current-price lookup | `SCAN p USING INDEX sqlite_autoindex_PRODUCT_1`; `CORRELATED SCALAR SUBQUERY 1`; `SEARCH ph USING INDEX sqlite_autoindex_PRICEHIST_1 (prodCode=? AND effDate<?)` | Product code ordering uses PK; each product resolves a price via the price-history composite PK and filters status afterward. |
| **Hypothetical** active product description substring filter + price subquery | `SEARCH PRODUCT USING INDEX idx_product_status_description (status=?)`; correlated price subquery via `sqlite_autoindex_PRICEHIST_1`; `USE TEMP B-TREE FOR ORDER BY` | Description substring is not index-seekable; separate sort remains. |
| Latest active price for one product | `SEARCH PRICEHIST USING INDEX sqlite_autoindex_PRICEHIST_1 (prodCode=? AND effDate<?)` | `(prodCode, effDate)` PK can traverse backward for `DESC`; the additional status filter is evaluated after the index seek. |

Representative customer predicate (SQLite uses `?`; PostgreSQL uses `$1`):

```sql
SELECT custNo, custName, address, payTerms, status, stamp
FROM v_active_customer
WHERE LOWER(custNo) LIKE ?
   OR LOWER(custName) LIKE ?
   OR LOWER(address) LIKE ?
ORDER BY custNo ASC;
```

Representative effective-date lookup (already present in the codebase):

```sql
SELECT ph.unitPrice
FROM PRICEHIST AS ph
WHERE ph.prodCode = ?
  AND ph.status = 'Active'
  AND ph.effDate <= ?
ORDER BY ph.effDate DESC
LIMIT 1;
```

`EXPLAIN QUERY PLAN` does **not** execute the SELECT or prove actual elapsed
time. It is only plan evidence for the local SQLite planner/statistics.

## 3. Disposable staging timings and covering-index experiment

**Conditions:** Read-only backup of bundled `HopeERP.db` into a separate
`:memory:` database; added **synthetic, non-customer** test records only to the
in-memory copy. Totals: **12,082 customers, 4,057 products, 48,079 PRICEHIST
rows** (including the baseline counts above). SQLite 3.53.1 / Python 3.12.14.
Run `ANALYZE` **only inside the disposable copy**. Prepared statements used
bound parameters; each SELECT fetched all result rows; 8 warm-up executions,
then 20 or 35 timed repetitions with `time.perf_counter_ns()`. Numbers below
are per-query **median** and **95th percentile**, in milliseconds. These are
cached, single-process, in-memory *diagnostics*, **not** realistic production
HTTP latency, concurrency, or guaranteed speedups.

| Query on in-memory test set | Existing indexes: median / p95 | With candidate covering index: median / p95 |
| --- | ---: | ---: |
| Customer active three-field substring search | **4.476 / 4.966 ms** | Not retested; price index is irrelevant |
| All-product current-price correlated query | **5.851 / 7.504 ms** | **4.594 / 5.013 ms** |
| **Hypothetical** active filtered product + current price | **0.524 / 0.768 ms** | **0.536 / 0.857 ms** |
| Single-product latest-price lookup | 0.002 / 0.002 ms | 0.001 / 0.002 ms |
| Active customer exact-name lookup | 0.001 / 0.002 ms | Not retested |

Small single-row timings are below useful precision for a production claim;
they are shown only to document the actual measurement rather than claim
sub-millisecond service performance. Repeat on representative infrastructure
with concurrent workload before making a deployment decision.

The following **candidate was created only in the in-memory copy**:

```sql
CREATE INDEX idx_bench_pricehist_cover
ON PRICEHIST(prodCode, status, effDate DESC, unitPrice);
```

Before it: `SEARCH ph USING INDEX sqlite_autoindex_PRICEHIST_1
(prodCode=? AND effDate<?)`. After it: `SEARCH ph USING COVERING INDEX
idx_bench_pricehist_cover (prodCode=? AND status=? AND effDate<?)` for both the
correlated subquery and single-product latest-price query. On this simulated
48,079-row price table, the candidate allocated **526 additional 4-KiB SQLite
pages (~2.06 MiB)**, before counting WAL/journal or deployment costs. Its
measured benefit was **not uniform** (filtered catalogue was slightly slower).
SQLite integrity and foreign-key checks remained clean in the disposable copy.

## 4. Recommendations and trade-offs

**Customer `(status, custName)`: KEEP.** It is useful for active exact-name and
potential name-prefix queries, but the actual `LOWER(column)` plus leading
wildcard `%term%` across three OR branches prevents a selective name seek. Its
leading `status` helps only when sufficiently selective; the current active
baseline is small. Do **not** claim that this index makes substring search
fast. The `ORDER BY custNo` can still require sorting. A possible later
experiment is `(status, custNo)` for active ordered scans, but it increases
write/storage cost and should be benchmarked before any migration.

**Full-text / substring search: DEFER pending product requirements and scale.**
The tiny current dataset does not justify an FTS subsystem. If customer search
grows into many thousands of rows with high query volume:

- For **PostgreSQL**, first investigate `pg_trgm` with a GIN index and a
  parameterized `ILIKE '%term%'` or normalized expression for each searched
  field; trigram search more closely matches the existing substring UX than
  token-based full-text search. The extension, indexes, disk and write costs,
  minimum-term selectivity, and `EXPLAIN (FORMAT JSON)` plans need staged
  verification. Index creation may require `CONCURRENTLY` and must run outside
  transactional migration wrappers.
- For **SQLite**, FTS5 is present in this test build, but adoption would
  require a synchronized virtual table/triggers or external-content design,
  rebuilt indexes, authorized-result filtering, and a rollback strategy.
  Do not make an FTS virtual table a route around `status` or user rights.
- For either engine, cap input length, add bounded pagination/debounce and
  sensible minimum-term behavior before investing in specialized indexes.
  Escaping user `%`/`_` wildcards (when literal search is the intended UX)
  avoids accidentally unbounded matches; this is separate from SQL injection.

**Product catalogue: USE active-scoped reads for ordinary users.** The
`(status, description)` index aids `status='Active'` and exact/prefix description
predicates if written to support it, but **not** `LOWER(description) LIKE
'%term%'` as tested. An actual product filter API does not yet exist in the
inspected code; do not deploy the hypothetical query without a dedicated
authorization/visibility contract. Keep inactive products visible only to
verified privileged operations. The existing as-of helper intentionally
returns `NULL` when no active eligible price exists.

**Price history candidate: CONDITIONAL staging recommendation, not an
automatic migration.** `(prodCode, status, effDate DESC, unitPrice)` matches
equality predicates first, then the date range and descending top-one search;
`unitPrice` makes the lookup covering for SQLite. The existing `(prodCode,
effDate)` PK already supports a reverse date scan, so a small database may
gain little. The existing `idx_pricehist_prodcode_effdate_status` overlaps
the PK prefix, but **do not drop it** without reviewing every dependent query.
Additional indexes consume storage, slow PRICEHIST inserts/updates, need
statistics and backups, and can change plans unexpectedly. Prefer measuring
realistic distribution of active/inactive historic prices and date ranges.

**If later approved**, proposed **SQLite** migration/rollback pair would be:

```sql
-- Forward; schedule under the project's next ordered migration number.
CREATE INDEX IF NOT EXISTS idx_pricehist_prod_status_effdate_price
  ON PRICEHIST(prodCode, status, effDate DESC, unitPrice);

-- Separate rollback file (never run during a forward deployment).
DROP INDEX IF EXISTS idx_pricehist_prod_status_effdate_price;
```

For **PostgreSQL**, adapt the quoting/schema and use a staged
`CREATE INDEX CONCURRENTLY` where supported and operationally appropriate;
account for extra locking considerations, distinct index-only scan visibility
rules, migration tool transaction behavior and the matching concurrent drop
on rollback. Confirm `EXPLAIN` on staging before and after. Neither variant
was added to the repository as a migration in this task.

## 5. Security findings (do not optimize around authorization)

1. **HIGH — Untrusted role header at the Next.js customer endpoint.**
   `src/app/api/customers/route.ts` reads the caller-controlled
   `x-user-role` request header and passes it directly to
   `getCustomers()`. The latter selects `CUSTOMER` instead of the active view
   for `Admin`/`Superadmin` status `all`/`inactive`, and includes `status` and
   `stamp`. This is **role spoofing / unauthorized access to inactive
   customer data** unless an external, enforced trust boundary strips and
   authenticates that header (none was demonstrated by this route). **Fix
   separately before production exposure:** derive role and customer rights
   from a verified server-side session/token and permission lookup; do not
   trust client identity headers. Add negative tests sending forged headers.
2. **GOOD — Bound search and date parameters.** The PostgreSQL customer
   service uses `$1` parameters; local SQLite uses `?`; the as-of price helper
   validates a calendar date and uses a prepared `?`, while Supabase calls a
   typed `DATE` RPC. Dynamic table names in the customer code are selected
   from fixed, role-controlled literals, not concatenated user input. No SQL
   injection via the *search term* was identified in these inspected paths.
3. **MEDIUM — Search abuse / broad reads.** An unbounded `%term%` match,
   including inputs of `%` or `_`, and no `LIMIT`/pagination can scan and
   return large portions of the customer table. Add strict length limits,
   pagination, request-rate controls, and literal-wildcard escaping if desired.
   Apply rate/authorization controls **before** expensive database work.
4. **MEDIUM — Product visibility and privileged RPC.**
   `getProductPricesAsOf()` returns data for `PRODUCT` including Inactive
   products. Its Supabase RPC is restricted to `service_role` and declared
   `SECURITY INVOKER`, which is appropriate for trusted server use but must
   not be exposed as an unrestricted endpoint; service-role clients bypass
   ordinary RLS. Ordinary product catalogue views should use
   `v_active_product`, after authenticated authorization.
5. **REVIEW REQUIRED — Supabase grants/RLS/tenant scope.** The inspected core
   migration does not define CUSTOMER/PRODUCT/PRICEHIST RLS policies. The
   active views are declared `security_invoker`, which is helpful but **does
   not substitute for underlying table grants and RLS**. Verify deployed
   grants/policies with the team; absence in migrations is *not proof* of
   current production exposure. No tenant identifier is specified in the
   inspected schema, so do not invent tenant filters; if the product becomes
   multi-tenant, add a verified tenant boundary before indexing/searching.

These findings were **reported, not patched**, because this task specifically
authorizes profiling/documentation and forbids unrelated behavior changes.

## 6. Deployment gate, rollback and limitations

1. Fix the client-controlled role/header trust issue before broad rollout.
   Verify grants/RLS and decide whether product data should be active-only.
2. Capture representative read-only staging/production **non-executing**
   plans, row/cardinality estimates and workload metrics under approved
   operational guidance; use targeted staged SELECT timings, never production
   `EXPLAIN ANALYZE` without explicit authorization.
3. If an index passes a staging decision gate, add it via the next ordered
   database-specific migration, deploy during a controlled window, monitor
   query plans, latency, lock time, write throughput and storage growth.
4. Roll back **only the new index** using the migration's paired DROP; do not
   rebuild/alter base tables or delete historical rows. On PostgreSQL, use
   concurrent index operations if indicated and permitted by the migration
   framework. For FTS experiments, plan trigger/backfill teardown separately.

**Limits:** The bundled 82/57/79 baseline is far too small for reliable
production tuning decisions. Synthetic records are not real customer
distributions; in-memory cached results exclude network, serialization,
concurrent writes, locks, and server load. No PostgreSQL server/version or
production plans were available, and no remote database was accessed.
No production index or configuration was created, dropped or modified.
