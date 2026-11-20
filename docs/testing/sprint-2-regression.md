# Sprint 2 Regression Test Log

**Task:** S2-TST-05
**Issue:** #123
**Role:** Test Engineer
**Status:** Regression coverage added; runtime execution is blocked because
Node.js/npm is unavailable in the current environment.

## Sprint 1 regression matrix

| Area | Regression check | Automated check |
|---|---|---|
| Registration | Default User role, bcrypt password hash, and no password response leak | `tests/s2-tst-05-sprint1-regression.test.cjs` |
| Login/logout | Valid login issues a session cookie and logout remains available | `tests/s2-tst-05-sprint1-regression.test.cjs` |
| Blocked accounts | Blocked session token is rejected by Customer and Product APIs | `tests/s2-tst-05-sprint1-regression.test.cjs` |
| User management | Admin results exclude Superadmin accounts and peer Admins are not manageable | `tests/s2-tst-05-sprint1-regression.test.cjs` |
| Last Superadmin | Sole active Superadmin cannot be demoted, blocked, or deactivated | `tests/s2-tst-05-sprint1-regression.test.cjs` |
| Smoke suite | Dashboard access, restricted navigation, and blocked-login scenarios remain defined | `tests/s2-tst-05-sprint1-regression.test.cjs` |

## Execution

Run the focused regression suite:

```powershell
node --test tests/s2-tst-05-sprint1-regression.test.cjs tests/auth-flow.test.js tests/user-management.test.js tests/superadmin-governance.test.js tests/smoke.test.js
```

Run the required smoke command:

```powershell
npm run test:smoke
```

| Check | Result |
|---|---|
| Focused Node test command | Not run: Node.js is unavailable in the current environment |
| `npm run test:smoke` | Not run: npm is unavailable in the current environment |
| `git diff --check` | Passed |
