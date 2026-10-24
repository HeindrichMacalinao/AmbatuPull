# Sprint 1 QA Master Plan and Acceptance Criteria

**Issue:** S1-TST-01
**Status:** QA contract for Sprint 1
**System under test:** Hope ERP user, authentication, authorization, and dashboard modules

This plan is the executable QA contract for Sprint 1. The repository does not yet
contain an application server or database migration, so cases are written against
the interfaces and schema conventions in `docs/ROADMAP.md` and
`docs/DEFINITION_OF_DONE.md`. A case is **passed** only when both the user
interface and the server/API produce the stated result.

## 1. Scope and quality strategy

### In scope

- Public registration, authentication, logout, and password reset.
- User Management CRUD, account blocking, soft delete, and audit stamps.
- Role hierarchy: `Superadmin`, `Admin`, and `User`.
- The 36 per-action rights catalogue and user-right assignment.
- Role-specific dashboard modules, navigation, rows, and counters.
- Security properties: server-side authorization, session invalidation, password
  hashing, reset-token expiry/single use, and last-Superadmin protection.

### Out of scope

Business workflows for Customers, Products, HR, Sales, and Reports are not
functionally tested in Sprint 1; only their dashboard/module visibility and rights
catalogue entries are covered.

### Master QA strategy

1. **Shift left:** validate contracts and permission decisions with unit/contract
   tests before browser testing.
2. **Defense in depth:** every forbidden action must be rejected by the API (403,
   or 401 when unauthenticated), not merely hidden in the UI.
3. **Risk based execution:** run registration/login, blocked-login, role
   boundaries, and rights denial on every change; run the full matrix before
   release.
4. **Isolation and repeatability:** use a disposable database, deterministic
   accounts, unique run identifiers, and reset the fixtures before destructive
   cases.
5. **Evidence:** retain request/response, account, role/right, row-status, and
   audit-stamp evidence for each failed or release-blocking case.

## 2. Test methodology

| Layer | Method | Minimum evidence |
|---|---|---|
| Unit/contract | Password, token, role inheritance, rights, last-Superadmin invariants | Test output and fixture state |
| API/integration | HTTP status, response shape, cookie/session, persistence, audit stamp | Request, response, and database assertion |
| Browser smoke | Registration/login/reset, dashboard navigation, visible controls/rows | Screenshot or trace plus URL |
| Regression/security | Repeat all P0/P1 cases; verify direct URL/API calls and cross-tenant/role boundaries | CI report and defect link |

For each case, start from a clean seed, record the actor and target account,
perform the action, assert the HTTP result, assert the UI result where applicable,
then inspect persistence and audit data. Use UTC timestamps and do not assert
unstable generated IDs.

## 3. Scope and coverage matrix

| Area | P0/P1 coverage | Positive coverage | Negative/boundary coverage | Required evidence |
|---|---|---|---|---|
| Public Registration | P0 | Valid registration creates one active `User`; password is salted bcrypt/Argon2 hash | Duplicate email, malformed email, short/common password, missing fields, replay submission | 201/validation response and one database row |
| Authentication | P0 | Valid login creates a session; logout invalidates it | Wrong password, unknown email with non-enumerating error, inactive/deleted account, blocked account, session fixation | Cookie/session assertions and 401/403 |
| Password Reset | P0 | Request and complete reset once; new password logs in | Unknown email, expired token, reused token, old password, token leakage/plaintext storage | Token status/expiry and login assertions |
| User Management CRUD | P0 | Create, read, update, soft delete, restore (where supported), search | Duplicate email, invalid role, unauthorized direct API, physical delete, last-Superadmin removal | 2xx/4xx, `status`, `stamp`, audit log |
| Account Blocking | P0 | Block/unblock permitted target; blocked status is visible to permitted admin | Blocked login/API/session; self-block; blocking last Superadmin; unauthorized block | 403 and session revocation |
| Role Hierarchy | P0 | Role-specific dashboard and endpoint access | User escalation; Admin→Superadmin assignment; Admin access to Superadmin/peer Admin; direct URL/API | 200/401/403 and response filtering |
| 36-Rights Matrix | P1 | Each granted action succeeds; module “all” maps to its actions | Each ungranted action is hidden and returns 403; All/None persistence; revoked right | Matrix report, UI state, 403, audit event |
| Dashboard visibility | P1 | Correct modules, counts, active rows, and role labels | Restricted module/controls absent; inactive rows and admin fields filtered for User | Browser trace/screenshot and API payload |

### 36-rights test model

The rights catalogue is the source of truth, not a hard-coded UI list. For every
catalogue row, execute the same three assertions:

1. A Superadmin can assign and exercise it.
2. An Admin can manage rights for eligible users but cannot cross the hierarchy
   boundary (Superadmin or peer Admin).
3. A User can exercise it only when explicitly granted; removing it makes the
   control unavailable and the endpoint return 403.

Also test module-level **All** and **None** controls, persistence after relogin,
and a mixed grant set (first, middle, and last right in each module). The seed
script deliberately grants a small representative set; the full catalogue must
be loaded by the application migration.

## 4. Role testing checklists

### Superadmin

- [ ] Unrestricted access to every Sprint 1 module, endpoint, row, and dashboard.
- [ ] Can create, update, block/unblock, soft-delete/restore users, and assign
      `Superadmin`, `Admin`, or `User` roles.
- [ ] Can assign, revoke, and inspect all 36 rights.
- [ ] Can see soft-deleted/inactive rows, including `status` and `stamp`.
- [ ] Can see all users, including Admins and other Superadmins.
- [ ] Cannot leave the system without at least one active Superadmin.

### Admin

- [ ] Can manage eligible User accounts and their rights.
- [ ] Can create/update/block/unblock Users and soft-delete eligible Users.
- [ ] Can view and assign rights only within the allowed management boundary.
- [ ] Cannot see, search, export, edit, block, delete, or assign rights to any
      Superadmin (**Superadmin invisibility**).
- [ ] Cannot edit, block, delete, demote, or change rights for a peer Admin
      (**peer Admin immutability**).
- [ ] Cannot assign the `Superadmin` role or elevate an account to Admin unless
      the product contract explicitly grants that operation.
- [ ] Sees only permitted dashboard modules and active operational rows.

### User

- [ ] Can log in only while active and unblocked.
- [ ] Sees only modules and actions represented by explicitly granted rights
      (**granted-rights restriction**).
- [ ] Direct navigation/API calls for an ungranted right return 403.
- [ ] Receives active rows only; inactive/soft-deleted rows are excluded.
- [ ] Does not receive administrative `status`/`stamp` fields unless a specific
      administrative read right explicitly permits them.
- [ ] A blocked User is rejected at login and by protected requests, with no
      usable session (**blocked rejection**).

## 5. Reusable test accounts and fixtures

The canonical disposable accounts are in [`fixtures.sql`](fixtures.sql). Use the
password shown there only in local/CI test environments:

| Account | Role/state | Password | Purpose |
|---|---|---|---|
| `qa.superadmin@hope.com` | Superadmin, Active, unblocked | `QaPassword!123` | unrestricted and hierarchy checks |
| `qa.superadmin2@hope.com` | Superadmin, Active, unblocked | `QaPassword!123` | last-Superadmin and peer checks |
| `qa.admin@hope.com` | Admin, Active, unblocked | `QaPassword!123` | Admin boundary checks |
| `qa.admin.peer@hope.com` | Admin, Active, unblocked | `QaPassword!123` | peer Admin immutability |
| `qa.user@hope.com` | User, Active, unblocked | `QaPassword!123` | granted-rights and CRUD checks |
| `qa.user.norights@hope.com` | User, Active, unblocked | `QaPassword!123` | no-rights baseline |
| `qa.blocked@hope.com` | User, Active, blocked | `QaPassword!123` | blocked rejection |
| `qa.deleted@hope.com` | User, Inactive, unblocked | `QaPassword!123` | soft-deleted visibility |

Never use these credentials in production. Tests that mutate an account must
restore the fixture or run in a transaction that is rolled back.

## 6. Detailed acceptance criteria

| ID | Acceptance criterion | Pass condition |
|---|---|---|
| AC-01 | Registration | Valid registration creates exactly one active User; duplicate and invalid input are rejected without a row. |
| AC-02 | Credential security | Passwords are never persisted or returned in plaintext; login verifies a salted adaptive hash. |
| AC-03 | Login/logout | Valid login creates a server-validated session; logout and blocking invalidate protected access. |
| AC-04 | Reset | Reset token is hashed, single-use, expires, and atomically invalidates; old password no longer works. |
| AC-05 | CRUD/soft delete | Authorized CRUD changes `status` and `stamp`; delete never executes physical `DELETE FROM app_user`. |
| AC-06 | Blocking | A blocked account cannot log in or use an existing protected session; authorized unblock restores access. |
| AC-07 | Superadmin authority | Superadmin has unrestricted access, can assign every role/right, and sees inactive rows with status/stamp. |
| AC-08 | Admin boundary | Admin manages eligible Users and rights, but Superadmins are invisible and peer Admins immutable. |
| AC-09 | User boundary | User receives only explicitly granted rights and active rows; every ungranted direct request is 403. |
| AC-10 | Dashboard | Dashboard modules, controls, counts, and row visibility match role and effective rights, after relogin. |
| AC-11 | Catalogue | All 36 rights exist uniquely, are assignable/revocable, and each action is covered by allow/deny tests. |
| AC-12 | Auditability | Security-sensitive changes record actor, action, target, timestamp, and resulting status/rights in audit data. |

Release sign-off requires all P0/P1 cases and AC-01 through AC-12 to pass, no
open Critical/High defect, and an explicit waiver for anything deferred.

## 7. Running and resetting the seed

The repository has no migration runner or database schema yet. Once the
PostgreSQL-compatible Sprint 1 migration exists, run from the repository root:

```powershell
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f docs\testing\fixtures.sql
```

Run the test suite with the disposable database selected:

```powershell
$env:BASE_URL = "http://localhost:3000"
node --test tests\auth-flow.test.mjs
```

To reset, restore the disposable database from its migration baseline, then
rerun `fixtures.sql`; do not run this script against production. The script uses
upserts for accounts and deletes only reset tokens for the `qa.*` accounts.

## 8. Test data and reporting rules

Use one database/schema per CI job where possible. Record test run ID, commit
SHA, migration version, browser/API version, fixture seed result, pass/fail
counts, and linked defects in `docs/testing/results/`. Mark unavailable
application-dependent cases as **Pending AUT**, not passed.
