# Customer and Product Permission Matrix

**Task:** S2-TST-04
**Issue:** #122
**Role:** Test Engineer

## Matrix

| Right | UI control guard | Unauthorized backend result | Automated check |
|---|---|---|---|
| `customer.add` | Add Customer hidden without right | 403 | `tests/s2-tst-04-permission-matrix-acceptance.test.cjs` |
| `customer.edit` | Edit hidden without right | 403 | `tests/s2-tst-04-permission-matrix-acceptance.test.cjs` |
| `customer.delete` | Delete hidden without right | 403 | `tests/s2-tst-04-permission-matrix-acceptance.test.cjs` |
| `product.add` | Add Product hidden without right | 403 | `tests/s2-tst-04-permission-matrix-acceptance.test.cjs` |
| `product.edit` | Edit hidden without right | 403 | `tests/s2-tst-04-permission-matrix-acceptance.test.cjs` |
| `product.delete` | Delete hidden without right | 403 | `tests/s2-tst-04-permission-matrix-acceptance.test.cjs` |
| `price.add` | Add Price restricted to Admin UI | 403 | `tests/s2-tst-04-permission-matrix-acceptance.test.cjs` |
| `price.edit` | Edit price hidden without right | 403 | `tests/s2-tst-04-permission-matrix-acceptance.test.cjs` |
| `price.delete` | Delete price hidden without right | 403 | `tests/s2-tst-04-permission-matrix-acceptance.test.cjs` |

The direct API gap checks specifically cover:

- User `alex@hope.com` without `customer.delete` calling
  `DELETE /api/customers/C-001`.
- The same user without `price.add` calling
  `POST /api/products/P-001/prices`.

Both requests must return HTTP 403. Admin action bypass is also covered to
ensure the matrix does not over-restrict privileged roles.

## Execution

```powershell
node --test tests/s2-tst-04-permission-matrix-acceptance.test.cjs tests/rights-matrix-verification.test.js
```

| Check | Result |
|---|---|
| Focused Node test command | Not run: Node.js is unavailable in the current environment |
| `git diff --check` | Passed |
