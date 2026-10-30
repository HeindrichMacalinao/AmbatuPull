# Sprint 1 QA Master Test Plan and Acceptance Criteria

**Issue:** #25 — `[S1-TST-01] Sprint 1 Quality Assurance Master Plan & Acceptance Criteria`  
**Status:** Draft; application sign-off is blocked pending implementation.

## 1. Objective, scope, and out-of-scope

### Objective

Define repeatable acceptance tests for Sprint 1 authentication, user
management, role hierarchy, rights assignment, account state, and dashboard
visibility. Authorization must be enforced server-side, not only by hidden UI.

### In scope

- Public registration, authentication/logout, and password reset.
- User Management create, read, update, and soft delete.
- Account blocking and unblocking.
- `Superadmin`, `Admin`, and `User` role hierarchy.
- The 36-rights catalogue and user-right assignment/revocation.
- Role- and right-based dashboard visibility.
- `status` and `stamp` soft-delete/audit behavior.
- Password hashing, session invalidation, reset-token expiry/single use, and
  last-active-Superadmin protection.

### Out of scope

Functional testing of Customers, Products, Human Resources, Sales, and Reports;
performance/load, penetration, accessibility, localization, disaster recovery,
production data, and production credentials. Only future-module visibility and
rights catalogue entries are covered for those modules.

## 2. Verified repository baseline

The repository currently contains Node.js ESM test contracts using `node --test`,
PostgreSQL-compatible SQL conventions, and bcrypt requirements. No application
source, schema, migration runner, controllers, routes, or CI workflow exists.
Existing tests use `/api/auth/register`, `/api/auth/login`, and `/dashboard` as
contract examples; these are not verified implemented routes.

Documented table names are `app_user`, `role`, `module`, `rights`,
`user_permission`, and `audit_log`. Existing fixture conventions identify
`email`, `password_hash`, `role`, `status`, `is_blocked`, and `stamp`. Exact
keys, foreign keys, right columns, reset-token columns, audit columns, and
implemented routes remain open questions.

The verified 36-rights catalogue is in `docs/testing/permission-matrix.md`.

## 3. Test Scope & Coverage Matrix

| Feature | Test types | Priority | Role |
|---|---|---:|---|
| Public Registration | Functional, negative, boundary, regression | P0 | Anonymous; resulting User |
| Authentication | Functional, negative, boundary, RBAC, regression | P0 | All roles; blocked/deleted User |
| Password Reset | Functional, negative, boundary, security regression | P0 | Anonymous and account owner |
| User Management CRUD | Functional, negative, soft-delete boundary, RBAC | P0 | Superadmin; Admin for eligible Users |
| Account Blocking | Functional, negative, session invalidation, RBAC | P0 | Superadmin; Admin for eligible Users |
| Role Hierarchy | RBAC, privilege-escalation negative, regression | P0 | Superadmin, Admin, User |
| 36-Rights Matrix | Allow/deny, assignment, revoke, All/None boundary | P1 | Superadmin; Admin within boundary; User |
| Dashboard visibility | Functional, RBAC, response filtering, regression | P1 | All roles |

For every right, verify both UI visibility and direct API authorization. Repeat
after relogin. Superadmin must see inactive rows with `status` and `stamp`;
User must receive active rows only and no administrative fields.

## 4. Methodology, entry/exit criteria, and severity

### Methodology

- **Functional:** successful flows and persistence.
- **Negative:** malformed/duplicate input, wrong credentials, blocked accounts,
  expired/reused tokens, forbidden routes, and escalation attempts.
- **Boundary:** empty/maximum fields, replay submissions, last active
  Superadmin, status transitions, and All/None rights.
- **Role-based access:** exercise UI and direct server/API calls as each role.
- **Regression:** rerun all P0 and affected P1 cases after security, schema, or
  user-management changes.

### Entry criteria

- Application and migrations are available.
- Disposable database is reset and approved test fixtures seed successfully.
- Environment URL, migration version, and commit SHA are recorded.

### Exit criteria

- All P0/P1 cases pass or have approved waivers.
- No open Critical or High defect remains.
- Cleanup succeeds and removes test-only data.
- This plan and evidence are signed off.

### Defect severity

| Severity | Definition |
|---|---|
| Critical | Authentication bypass, privilege escalation, plaintext credentials, or destructive production-data risk |
| High | Required role boundary, blocking control, reset security property, or soft-delete invariant fails |
| Medium | Required non-critical workflow/right fails or dashboard data is materially incorrect |
| Low | Cosmetic, wording, layout, or non-blocking evidence issue |

## 5. Role Testing Checklists — ERP Student Guide §4.3

### Superadmin

- [ ] Unrestricted access to all Sprint 1 modules and endpoints.
- [ ] Can assign `Superadmin`, `Admin`, or `User`.
- [ ] Can assign and revoke all 36 rights.
- [ ] Sees soft-deleted records, including `status` and `stamp`.
- [ ] Cannot remove or demote the last active Superadmin.

### Admin

- [ ] Can manage eligible Users and their rights.
- [ ] Cannot see Superadmin accounts.
- [ ] Cannot modify, block, delete, demote, or change rights for peer Admins.
- [ ] Cannot assign the Superadmin role.
- [ ] Sees only permitted modules and active operational rows.

### User

- [ ] Can use only explicitly granted rights.
- [ ] Sees active rows only.
- [ ] Does not receive `status` or `stamp` columns.
- [ ] Ungranted direct requests return HTTP 403.
- [ ] A blocked User is rejected at login and on protected requests.

## 6. Detailed test cases

`[ ]` is the execution pass/fail checkbox. All cases are pending AUT until an
application and migration exist.

| ID | Title | Role | Preconditions | Steps | Test data | Expected result | Pass/Fail |
|---|---|---|---|---|---|---|---|
| TC-AUTH-001 | Register valid User | Anonymous | Registration enabled | Submit valid registration once | New email; `QaPassword!123` | One active User; salted bcrypt hash; no plaintext response | [ ] |
| TC-AUTH-002 | Reject duplicate registration | Anonymous | Account exists | Submit same email again | Existing test email | Validation/409; no second row | [ ] |
| TC-AUTH-003 | Reject invalid registration boundaries | Anonymous | Registration enabled | Try missing, malformed, and short/common password fields | Invalid inputs | Validation errors; no account | [ ] |
| TC-AUTH-004 | Authenticate and logout | User | Active/unblocked User exists | Login, protected request, logout, protected request | `test_user` | Session works, then is invalidated | [ ] |
| TC-AUTH-005 | Reject wrong/unknown credentials | Anonymous | None | Submit wrong password and unknown email | Invalid credentials | Safe 401/validation response; no session | [ ] |
| TC-AUTH-006 | Reject blocked/deleted login | User | Blocked/inactive fixtures exist | Attempt login for each | `test_blocked`, `test_deleted` | Rejected; no usable session | [ ] |
| TC-AUTH-007 | Complete password reset once | Account owner | Reset delivery works | Request, use token, login new password, reuse token | New password; valid token | Token expires/is single-use; old password fails | [ ] |
| TC-AUTH-008 | Reject reset abuse | Anonymous | Reset supports expiry/replay | Use unknown, expired, and replayed tokens | Invalid tokens | Safe response; password unchanged | [ ] |
| TC-RBAC-001 | Superadmin manages all roles | Superadmin | Logged in as `test_superadmin` | Create/update users and assign each role | All role values | Permitted changes succeed and audit | [ ] |
| TC-RBAC-002 | Admin manages eligible User | Admin | Logged in as `test_admin` | Create/edit/block/unblock/soft-delete User | `test_user` | Permitted changes succeed; status/stamp update | [ ] |
| TC-RBAC-003 | Admin cannot see Superadmin | Admin | Superadmin exists | List, search, direct-read | `test_superadmin` | Hidden or documented not-found/403 | [ ] |
| TC-RBAC-004 | Admin cannot modify peer Admin | Admin | Peer Admin exists | Edit/block/delete/demote/change rights | `test_admin_peer` | All rejected; target unchanged | [ ] |
| TC-RBAC-005 | User cannot escalate | User | Logged in as `test_user` | Attempt role/right management directly | Admin/Superadmin target | UI absent; API returns 403 | [ ] |
| TC-RBAC-006 | Preserve last active Superadmin | Superadmin | Exactly one remains | Delete/demote/block/deactivate it | `test_superadmin` | Rejected; one active Superadmin remains | [ ] |
| TC-CRUD-001 | Create and read User | Superadmin | User endpoint exists | Create then retrieve unique account | `test_created_user` | Active User row and creation stamp | [ ] |
| TC-CRUD-002 | Update User audit stamp | Superadmin | User exists | Change allowed field | `test_created_user` | Change persists; actor/action stamp recorded | [ ] |
| TC-CRUD-003 | Soft-delete and restore visibility | Superadmin | User exists | Delete/restore; list as Superadmin and User | `test_created_user` | No physical delete; role-specific visibility | [ ] |
| TC-CRUD-004 | Reject unauthorized CRUD | User | No management right | Direct create/update/delete | `test_user` | 403; data unchanged | [ ] |
| TC-BLOCK-001 | Block/unblock eligible User | Superadmin/Admin | Actor may manage target | Block, test access, unblock, login | `test_user` | Block invalidates access; unblock restores it | [ ] |
| TC-BLOCK-002 | Reject self/peer blocking | Admin | Admin and peer exist | Block self and peer | Admin fixtures | Rejected; accounts unchanged | [ ] |
| TC-RBAC-007 | Verify every right allow/deny | All roles | 36 rights seeded | Grant, exercise, revoke, retry each right | Every right | Grant allows; revoke hides and returns 403 | [ ] |
| TC-RBAC-008 | Verify rights All/None persistence | Superadmin | Rights editor exists | Select All/save/relogin; None/save/relogin | 36 rights | All grants 36; None clears 36 | [ ] |
| TC-DASH-001 | Verify role-specific dashboard | All roles | Fixtures can log in | Inspect navigation, modules, counts, rows | All role fixtures | Visibility matches role/effective rights | [ ] |
| TC-DASH-002 | Filter admin fields for User | User | Inactive fixture exists | Request dashboard/list payload | `test_deleted` | Active rows only; no status/stamp | [ ] |

## 7. Test data and fixtures

All accounts are **test-only**, use `QaPassword!123`, and must be created by
the approved testing seed. The seed must use a bcrypt cost-12 hash and the
`test_` prefix.

| Account | Role | State | Purpose |
|---|---|---|---|
| `test_superadmin@hope.com` | Superadmin | Active, unblocked | Full authority |
| `test_superadmin.second@hope.com` | Superadmin | Active, unblocked | Last-Superadmin safeguard |
| `test_admin@hope.com` | Admin | Active, unblocked | Management boundary |
| `test_admin.peer@hope.com` | Admin | Active, unblocked | Peer immutability |
| `test_user@hope.com` | User | Active, unblocked | Granted-rights case |
| `test_user.norights@hope.com` | User | Active, unblocked | Denial baseline |
| `test_blocked@hope.com` | User | Active, blocked | Blocked rejection |
| `test_deleted@hope.com` | User | Inactive, unblocked | Soft-delete visibility |

`test_user` should receive the verified `customer.view` right; dashboard
visibility must be confirmed as either role-derived or backed by a future
catalogue entry. The no-rights User should receive no explicit rights.
Effective Superadmin/Admin rights need confirmation from the future
authorization implementation.

## 8. Acceptance Criteria

- [ ] Master Test Plan completed and signed off
- [ ] Test fixtures and predefined accounts documented for all roles
- [ ] Public registration, authentication, and reset cases pass or are waived
- [ ] CRUD, blocking, soft-delete, and last-Superadmin cases pass
- [ ] All 36 rights have allow/deny evidence
- [ ] Dashboard visibility and User filtering match the role checklist
- [ ] No open Critical or High defect remains

## 9. Sign-off

| Name | Role | Date | Signature |
|---|---|---|---|
|  | Test Engineer |  |  |
|  | Backend Developer |  |  |
|  | DevSecOps |  |  |
|  | Scrum Master |  |  |

## 10. Assumptions & Open Questions

- No schema, migration, application server, controller, or route is currently
  present; all route and schema details must be confirmed before execution.
- Confirm whether the canonical blocking column is `isBlocked` or the existing
  fixture convention `is_blocked`.
- Confirm primary/foreign keys and exact columns for `role`, `rights`, `module`,
  `user_permission`, reset tokens, sessions, and `audit_log`.
- Confirm final routes/status codes for registration, login/logout, reset,
  user CRUD, block/unblock, role/right management, and dashboard.
- Confirm reset-token hashing, expiry, single-use invalidation, and delivery.
- The permission matrix documents 36 codes such as `customer.view` and
  `customer.create`; roadmap prose also mentions `customer.add`. Confirm the
  migration's canonical codes.
- Confirm whether Admin may assign Admin or only manage User accounts.
- Confirm dashboard modules, counters, row filters, and field filtering rules.
- Run test seeds only after migrations are supplied; never run against production.
