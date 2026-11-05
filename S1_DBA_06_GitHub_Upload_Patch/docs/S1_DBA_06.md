# S1-DBA-06 | Audit Trail: `audit_user()` and SQLite triggers

## Scope and source provenance

Implements the supplied S1-DBA-06 ticket against the **available Activities 1–5
SQLite project archive**. The live `HeindrichMacalinao/AmbatuPull` branch and its
existing Node.js/Express DB provider could not be read from this environment.
Consequently `src/db/audit-context.cjs` is a self-contained **integration hook**,
not a claim that an inaccessible Express app was automatically wired.

Existing SQL schema uses `app_user`, `user_permission`, and `rights`. Before this
patch, account and permission rows had a textual `stamp` but **no audit trail,
actor-context enforcement, or stored before/after events**. The `rights` catalog
had no `stamp` column. The implementation leaves old column sets unchanged.

## Files and behavior

- `db/migrations/004_audit_trail.sql`: Creates `audit_log` with `id`, `performedBy`,
  `action`, `tableName`, `recordId`, JSON-valid `details` stored as `TEXT`, and
  UTC `timestamp`. Indexes: `(tableName,recordId,timestamp)` and
  `(performedBy,timestamp)`.
- AFTER INSERT/UPDATE/DELETE triggers on `app_user`, `user_permission`, `rights`.
  `app_user` writes emit `CREATED`, `EDITED`, `DELETED`, `RESTORED`, `BLOCKED`,
  `UNBLOCKED`. Grant/revoke/status changes emit `RIGHTS_UPDATED` on
  `user_permission`. `rights` catalog insert/edit/delete emits
  `CREATED`/`EDITED`/`DELETED`.
- Account and grant inserts/updates overwrite preexisting `stamp` with
  `ACTION actor YYYY-MM-DD HH:MM:SS` in UTC. The old schema requires callers
  to supply a valid nonempty initial `stamp` placeholder, e.g. `PENDING`, on
  INSERT; the trigger replaces it. Authorized, explicit stamp-only edits are
  also attributed and overwritten.
- Triggers require `audit_user()` on the *same connection executing the write*.
  If the function or actor is absent, the SQL statement aborts and rolls back
  its audit changes. Audit details include before/after business values and a
  boolean `passwordHashChanged`; they deliberately exclude password hashes
  and reset tokens. `audit_log` rejects edits, deletes, and mismatched actor
  inserts in ordinary application SQL (not protection against a DBA/file owner).
- `scripts/regenerate_hope.py` installs the audit migration last, after the
  historical and S1-DBA-05 right-catalog seed, and refuses to overwrite a
  target containing account, token, grant, **or audit** rows. Both regenerated
  DBs have **zero fabricated audit events** and retain the original 928 records,
  36 rights, and five modules.
- `scripts/seed_superadmins.py` now requires explicit `--actor` for authenticated
  or trusted operator attribution. Python helpers in `scripts/audit_sqlite.py`
  register a trusted actor for administrative scripts; tests use test-only IDs.

### Audit action precedence

When a single account UPDATE changes more than one state, the action is chosen
in this order: `BLOCKED`/`UNBLOCKED`, `DELETED`/`RESTORED`, otherwise `EDITED`.
The JSON before/after fields still capture *all* changed account fields.
`DELETED` also covers physical deletion; for `status=Inactive` it is a
logical deletion. `RIGHTS_UPDATED` captures grant creation, update, revocation,
and deletion, including FK-driven cascades.

### SQLite actor/session integration (Node 22, CommonJS)

The new module requires only Node's `AsyncLocalStorage`. It registers a
non-deterministic SQLite scalar function with a connection exposing
`.function(name, options, fn)`, such as `better-sqlite3` or Node's
`node:sqlite` `DatabaseSync` (experimental in Node 22). This specific SQLite
connection API **must match the actual backend database driver** before
merging. It is not a PostgreSQL implementation.

```js
const {
  registerAuditUser, auditMiddleware, withAuditUser,
} = require('./src/db/audit-context.cjs');

// Execute ONCE per SQLite connection, after creation, before any writes:
registerAuditUser(db);

// After your existing authentication middleware has set verified req.user.id:
app.use(authenticateExistingSession);
app.use(auditMiddleware());

// Existing handlers write through db as normal. The trigger reads the
// active request's actor; the request body/headers cannot set that value.
// Example worker job (must use an authorized service identity):
withAuditUser('system:nightly', () => {
  db.prepare('UPDATE app_user SET isBlocked = ? WHERE userId = ?').run(1, 123);
});
```

**Do not copy-paste the illustration into an uninspected server:** the actual
backend may use a different driver or have other authentication middleware.
`withAuditUser()` must span the **actual database operation**, including async
operations. Register for every pool connection; ensure the context is
propagated to async workers. Never use a caller-supplied `X-User` header,
request body, or unauthenticated username as actor. The actor must be a stable
trusted ID of 1–40 `[A-Za-z0-9_.@:-]` characters; the bound preserves the
legacy 80-character stamp field. Confirm `PRAGMA foreign_keys=ON` on every
SQLite connection. Use transactions around compound rights changes.

**Critical compatibility note:** Existing SQL written before S1-DBA-06 that
mutates `app_user`, `user_permission`, or `rights` without a registered function
will now correctly fail closed. Authenticated routes, job processors, test
fixtures, and trusted admin scripts MUST register the context. No synthetic
fallback actor is provided.

### PostgreSQL limitation

The migration file is intentionally **SQLite-specific**, as are the supplied
artifacts. PostgreSQL needs its own `CREATE FUNCTION` / PL/pgSQL triggers and
transaction-local actor setting, e.g. `SET LOCAL`, and must not use persistent
cross-request session state on a shared pool connection. Do not try to execute
this SQLite SQL on PostgreSQL. We could not verify a PostgreSQL runtime in the
unavailable live repository.

### `rights.stamp` and physical audit immutability

The existing `rights` table does **not** have a `stamp` field. The migration
logs `rights` catalog mutations but does not silently add a column and break
S1-DBA-03's required schema. The target stamp requirement is implemented for
`app_user` and `user_permission`. If product owners require a catalog-level
stamp, that needs an explicit backward-compatible schema change.

SQLite triggers do not make audit history tamper-proof against anyone with
file/DDL permissions. In production, restrict DB file and schema permissions,
back up or replicate audit records to a protected service, control access to
PII in audit details, and define retention/privacy policy. Actor tracking
supports accountability; it is not itself authorization.

## Run tests from repository root

```bash
python3 -B scripts/regenerate_hope.py
python3 -B tests/verify_audit_trail.py --check-artifacts
node --test tests/audit_context.test.cjs
python3 -B tests/verify_hope.py
python3 -B tests/verify_user_management.py
python3 -B tests/verify_password_reset_token.py --check-artifacts
python3 -B tests/verify_initial_access.py --check-artifacts
```

CI integration into the **existing** job (after migration/setup) can include:

```yaml
- name: Validate SQLite audit trail
  run: python3 -B tests/verify_audit_trail.py
- name: Validate Node SQLite audit context
  run: node --test tests/audit_context.test.cjs
```

The Node test uses Node 22+ built-in `node:sqlite` for an end-to-end function
integration test; on Node 22 it may print a harmless ExperimentalWarning.
No npm dependency or Docker is required for these specific tests.

## Assumptions and remaining integration checks

- Running SQLite migrations **in order**: 001 base, 002 user management, 003
  password-reset, S1-DBA-05 catalog seed, then 004 audit. Historical seed is
  applied between base and user management.
- The actual backend driver supports SQLite custom scalar functions; otherwise
  an adapter or transaction-local alternative is necessary.
- No authenticated application routes were available to inspect or patch.
  Install the connection and middleware hooks in the actual DB initialization
  and authenticated routes before calling the deployment fully integrated.
- Validate against the real repository CI workflow and any other non-test
  writers before merge. Local tests alone cannot verify GitHub-hosted CI.
