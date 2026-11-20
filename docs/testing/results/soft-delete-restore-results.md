# Soft Delete and Restore Test Results

**Task:** S2-TST-03
**Issue:** #121
**Role:** Test Engineer
**Status:** Acceptance-focused automated coverage added.

## Test cases

| ID | Scenario | Expected result | Automated check |
|---|---|---|---|
| TC-DEL-01 | Delete customer with linked sales | Physical row remains Inactive with a `DELETED` stamp | `tests/s2-tst-03-soft-delete-restore-acceptance.test.cjs` |
| TC-DEL-02 | Admin views deleted customer | Inactive row is shaded and Restore replaces Delete in the UI contract | `tests/s2-tst-03-soft-delete-restore-acceptance.test.cjs` |
| TC-DEL-03 | Admin restores customer | Row becomes Active with a `RESTORED` stamp | `tests/s2-tst-03-soft-delete-restore-acceptance.test.cjs` |
| TC-DEL-04 | User attempts restore | Request is rejected with 403 | `tests/s2-tst-03-soft-delete-restore-acceptance.test.cjs` |
| TC-FK-01 | Hard-delete customer C-001 with sales | Foreign-key restriction blocks deletion | `tests/s2-tst-03-soft-delete-restore-acceptance.test.cjs` |
| TC-FK-02 | Soft-delete product with price and sales-detail children | Product row becomes Inactive and PRICEHIST/SALESDETAIL links remain intact | `tests/s2-tst-03-soft-delete-restore-acceptance.test.cjs` |

The suite also verifies the `CREATED -> EDITED -> DELETED -> RESTORED` stamp
cycle for customer and product workflows and confirms no hard-delete SQL is
issued by the product service.

## Execution

```powershell
node --test tests/s2-tst-03-soft-delete-restore-acceptance.test.cjs tests/customer-delete-restore.test.js tests/product-delete-restore.test.js
```

| Check | Result |
|---|---|
| Focused Node test command | Not run: Node.js is unavailable in the current environment |
| `git diff --check` | Passed |
