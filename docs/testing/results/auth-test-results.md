# Authentication Test Results

**Task:** S1-TST-02  
**Status:** Contract suite ready; application-dependent cases remain pending until
the authentication routes and a disposable test server are available.

## Automated coverage

| ID | Case | Expected result | Automated check |
|---|---|---|---|
| TC-REG-01 | Valid registration | 201; default `User` role; no password in response | `tests/auth-flow.test.js` |
| TC-REG-02 | Duplicate email | 409; no second account | `tests/auth-flow.test.js` |
| TC-REG-03 | Invalid email/short password | 400/422; no account | `tests/auth-flow.test.js` |
| TC-REG-04 | Stored password | Cost-12 bcrypt hash; never plaintext | `tests/verify_auth_contract.py` |
| TC-AUTH-01 | Valid login | 200 and session cookie | `tests/auth-flow.test.js` |
| TC-AUTH-02 | Wrong password | Safe 401/403 without user enumeration | `tests/auth-flow.test.js` |
| TC-AUTH-03 | Blocked account | 403 with blocked notification; no session | `tests/auth-flow.test.js` |
| TC-AUTH-04 | Logout | Session is invalidated; protected request is 401 | `tests/auth-flow.test.js` |
| TC-RST-01 | Request reset | Reset request succeeds without token disclosure | `tests/auth-flow.test.js` |
| TC-RST-02 | Complete reset | New password works; old password fails | Pending route implementation |
| TC-RST-03 | Expired token | Reset is rejected | `tests/auth-flow.test.js` |
| TC-RST-04 | Reused token | Reset is rejected | `tests/auth-flow.test.js` |

## Running

Run deterministic checks:

```powershell
python tests\verify_auth_contract.py
```

Run the full suite:

```powershell
npm test
```

Run HTTP authentication checks against a disposable environment:

```powershell
$env:BASE_URL = "http://localhost:3000"
npm run test:auth
```

When `BASE_URL` is unset, HTTP cases are reported as skipped rather than passed.
The repository currently has no authentication routes, so this is the honest
baseline until the application implementation is delivered.
