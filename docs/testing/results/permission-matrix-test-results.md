# Permission Matrix Test Results

**Task:** S1-TST-04  
**Status:** Contract suite ready; HTTP cases remain pending until permission
routes and a disposable test server are available.

| ID | Case | Expected result | Automated check |
|---|---|---|---|
| TC-RIGHT-001 | 36-right catalogue | Exactly 36 unique rights across five modules | `tests/verify_permission_matrix.py` |
| TC-RIGHT-002 | Grant/revoke each right | Grant allows UI/API; revoke hides UI and returns 403 | `tests/permission-matrix.test.js` |
| TC-RIGHT-003 | All/None shortcuts | All persists 36; None persists 0 | `tests/permission-matrix.test.js` |
| TC-RIGHT-004 | `customer.delete` denial | Direct request returns 403 | `tests/permission-matrix.test.js` |
| TC-RIGHT-005 | Auditability | Grant/revoke records actor, target, right, action, timestamp | `tests/permission-matrix.test.js` |

## Running

```powershell
python tests\verify_permission_matrix.py
npm run test:permission-matrix
```

Set `BASE_URL` before the second command to execute the HTTP matrix. Without
it, the live API cases are skipped rather than reported as passing.
