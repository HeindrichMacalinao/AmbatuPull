# Product and Price History Test Results

**Task:** S2-TST-02
**Issue:** #120
**Role:** Test Engineer
**Status:** Acceptance-focused automated coverage added.

## Test cases

| ID | Scenario | Expected result | Automated check |
|---|---|---|---|
| TC-PROD-01 | Current price uses the latest effective date on or before the target date | Latest eligible Active price is returned | `tests/s2-tst-02-product-price-acceptance.test.cjs` |
| TC-PROD-02 | Future effective price is added | Future price does not change the current price until its date | `tests/s2-tst-02-product-price-acceptance.test.cjs` |
| TC-PROD-03 | Product P-004 has no price history | Derived current price is `null`, rendered as `—` by the UI | `tests/s2-tst-02-product-price-acceptance.test.cjs` |
| TC-PRICE-01 | Open P-003 price history | Records are ordered by `effDate DESC` | `tests/s2-tst-02-product-price-acceptance.test.cjs` |
| TC-PRICE-02 | Add a duplicate effective date | Duplicate `(prodCode, effDate)` is rejected with HTTP/service status 400 | `tests/s2-tst-02-product-price-acceptance.test.cjs` |
| TC-PRICE-03 | Admin and User price-history views | Admin receives status/stamp; User does not | `tests/s2-tst-02-product-price-acceptance.test.cjs` |

## Execution

```powershell
node --test tests/s2-tst-02-product-price-acceptance.test.cjs tests/current-product-price.test.cjs tests/price-history.test.js
```

The command requires Node.js with `node:sqlite` support. The test file uses an
isolated in-memory database and does not modify repository database fixtures.

| Check | Result |
|---|---|
| `node --test tests/s2-tst-02-product-price-acceptance.test.cjs tests/current-product-price.test.cjs tests/price-history.test.js` | Not run: Node.js is unavailable in the current environment |
| `git diff --check` | Passed |
