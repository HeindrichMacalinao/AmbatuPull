# Customer Module Test Results

**Task:** S2-TST-01
**Issue:** #119
**Role:** Test Engineer
**Status:** Automated acceptance coverage added; execution is blocked in the
current checkout because Node.js/npm and Python are unavailable.

## Test cases

| ID | Scenario | Expected result | Automated check |
|---|---|---|---|
| TC-CUST-01 | Create a customer with valid data | HTTP 201; record is Active with a `CREATED` stamp | `tests/customer-crud.test.js` |
| TC-CUST-02 | Create a customer with a duplicate `custNo` | HTTP/service result is rejected with 409 | `tests/customer-crud.test.js` |
| TC-CUST-03 | Edit customer details | Updated values persist and receive an `EDITED` stamp | `tests/customer-crud.test.js` |
| TC-CUST-04 | Live search by customer number, name, and address | Each search term is case-insensitive and filters the matching record | `tests/customer-list-api.test.js` |
| TC-CUST-ROLE-01 | Admin status views | Active, Inactive, and All filters return the expected records | `tests/customer-list-api.test.js` |
| TC-CUST-ROLE-02 | Admin audit/status columns | Admin responses include status and stamp, including inactive C-004 fixtures | `tests/customer-list-api.test.js` |
| TC-CUST-ROLE-03 | User restricted view | User responses omit status and stamp and cannot request inactive rows | `tests/customer-list-api.test.js` |
| TC-CUST-ROLE-04 | User visibility of soft-deleted customer | Inactive customers are absent from User results | `tests/customer-list-api.test.js` |

## Execution

Run the focused customer suite:

```powershell
npm run test:customer
```

Run the complete repository suite:

```powershell
npm test
```

Both commands include the customer CRUD, search, role-view, soft-delete, and
restore tests.

| Command | Result |
|---|---|
| `npm run test:customer` | Not run: `npm` is not installed in the current environment |
| `npm test` | Not run: `npm` is not installed in the current environment |
| `git diff --check` | Passed |
