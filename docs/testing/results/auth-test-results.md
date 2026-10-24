# Authentication Test Results

**Task:** S1-TST-02  
**Status:** Ready for execution against the application under test.

The repository currently contains no application server or database schema. The cases below are the executable acceptance contract; populate the result column with the CI run URL and commit SHA when the application is available.

| ID | Case | Expected result | Result |
|---|---|---|---|
| TC-REG-01 | Register valid user | 201; role is `User` | Pending AUT |
| TC-REG-02 | Register duplicate email | 409; no second row | Pending AUT |
| TC-REG-03 | Malformed email/short password | 400 with descriptive validation | Pending AUT |
| TC-REG-04 | Inspect stored password | Salted bcrypt hash, never plaintext | Pending AUT |
| TC-AUTH-01 | Valid login | Session/cookie created | Pending AUT |
| TC-AUTH-02 | Wrong password | Generic authentication failure | Pending AUT |
| TC-AUTH-03 | Blocked login | Rejected with blocked notification | Pending AUT |
| TC-AUTH-04 | Logout | Session destroyed; protected request is 401 | Pending AUT |
| TC-RST-01 | Request reset | Single-use token persisted | Pending AUT |
| TC-RST-02 | Complete reset | New password works; old password fails | Pending AUT |
| TC-RST-03 | Expired token | Reset rejected after one hour | Pending AUT |
| TC-RST-04 | Reused token | Second use rejected | Pending AUT |

## Security assertions

- Password comparisons must use bcrypt's constant-time verification.
- Reset tokens must be stored hashed, expire after one hour, and be invalidated atomically on use.
- Login errors must not disclose whether an email exists.
