# Sprint 1 Smoke Test Results

**Task:** S1-TST-05  
**Status:** Headless HTTP smoke suite ready; live cases remain pending until an
application server is available.

| ID | Scenario | Expected result | Automated check |
|---|---|---|---|
| SMOKE-001 | Superadmin login and dashboard | Session is issued; dashboard/KPI and full navigation load | `tests/smoke.test.js` |
| SMOKE-002 | Restricted User dashboard | Only authorized navigation is visible; admin links are absent | `tests/smoke.test.js` |
| SMOKE-003 | Blocked login | Login returns 403 and a blocked notification | `tests/smoke.test.js` |

## Running

```powershell
$env:BASE_URL = "http://localhost:3000"
npm run test:smoke
```

The suite uses Node's built-in test runner and HTTP requests, so it has no
browser-driver dependency and is intended to complete in under 30 seconds.
Without `BASE_URL`, the three live smoke cases are skipped rather than reported
as passed. Use the disposable accounts in
`docs/testing/02_test_accounts.sql`.
