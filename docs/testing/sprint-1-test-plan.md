# Sprint 1 QA Master Test Plan

**Task:** S1-TST-01  
**Scope:** registration, authentication, password reset, user management, blocking, role hierarchy, granular rights, and dashboard visibility.

## Strategy

Tests are organized in three layers:

1. **Unit/contract tests** validate password, token, permission, and role invariants without a browser.
2. **HTTP integration tests** validate status codes, session behavior, authorization, and persistence.
3. **Browser smoke tests** validate the highest-value navigation and visibility paths.

Every protected operation must be enforced on the server. Hiding a button is a usability rule, not an authorization control. Test data is isolated by run and reset before destructive cases.

## Role coverage

| Role | Required checks |
|---|---|
| Superadmin | Sees all modules and users, assigns any role, and sees soft-deleted records with status/stamp. |
| Admin | Manages users and rights, cannot see or modify Superadmin accounts, and cannot modify peer Admins. |
| User | Sees only granted modules, receives active rows without administrative status/stamp fields, and is rejected when blocked. |

## Acceptance matrix

| Area | Positive checks | Negative checks | Evidence |
|---|---|---|---|
| Registration | Valid account gets `User` role | Duplicate, malformed email, short password | HTTP result and database row |
| Authentication | Valid session and logout | Wrong password and blocked account | Cookie/session assertions |
| Reset | Single-use token changes password | Expired and reused token | Token and login assertions |
| User management | Role-specific CRUD | Privacy and peer boundaries | API/UI report |
| Rights | Granted operation succeeds | Unticked operation returns 403 | Matrix report and audit event |
| Dashboard | Correct KPI/navigation visibility | Restricted module is absent | Browser smoke report |

## Fixtures

The canonical accounts are documented in [`fixtures.sql`](fixtures.sql). Passwords are test-only values and must never be reused in production. The seed is idempotent and must be run against a disposable database.

## Execution and sign-off

Run the applicable unit, integration, and smoke commands in CI. Record the command, commit SHA, pass/fail count, and known defects in the result documents. A release candidate is acceptable only when all Critical/High cases pass or have an explicitly approved waiver.
