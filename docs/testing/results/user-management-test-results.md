# User Management Test Results

**Task:** S1-TST-03  
**Status:** Contract suite ready; HTTP cases remain pending until the user
management routes and a disposable test server are available.

| ID | Scenario | Expected result | Automated check |
|---|---|---|---|
| TC-UM-01 | Admin lists users | Superadmin rows are absent | `tests/user-management.test.js` |
| TC-UM-02 | Admin views peer Admin | Mutations return 403 | `tests/user-management.test.js` |
| TC-UM-03 | Superadmin lists users | All role types and audit fields visible | `tests/user-management.test.js` |
| TC-BLK-01 | Admin blocks active User | Block succeeds and login is rejected | `tests/user-management.test.js` |
| TC-BLK-02 | Blocked User calls protected endpoint | 401/403 immediately | `tests/user-management.test.js` |
| TC-BLK-03 | Admin unblocks User | Login succeeds again | `tests/user-management.test.js` |
| TC-SA-01 | Last active Superadmin mutation | Block, demote, and delete return 403 | `tests/user-management.test.js` |

## Deterministic checks

```powershell
python tests\verify_user_management_contract.py
```

The check validates the migration’s role/state/audit columns and the canonical
fixtures. It does not fabricate a passing API result when application routes
are absent.

## HTTP execution

```powershell
$env:BASE_URL = "http://localhost:3000"
npm run test:user-management
```

Without `BASE_URL`, the eight HTTP cases are reported as skipped. Before
release, run against a disposable database seeded by
`docs/testing/01_test_roles_and_rights.sql` and `docs/testing/02_test_accounts.sql`.
