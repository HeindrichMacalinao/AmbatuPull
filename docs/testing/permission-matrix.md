# Sprint 1 Permission Matrix

**Task:** S1-TST-04  
**Account:** `test_user@hope.com`  
**Rule:** every right must be verified in both the UI and the server. A granted
right permits its operation; a revoked right hides/disables its control and
returns HTTP 403 for a direct request.

## Catalogue

| Module | Rights |
|---|---|
| Customer | `customer.view`, `customer.create`, `customer.delete` |
| Product | `product.view`, `product.create`, `product.edit`, `product.delete`, `product.import`, `product.export` |
| Human Resources | `hr.view`, `hr.create`, `hr.edit`, `hr.delete`, `hr.block`, `hr.roles`, `hr.rights`, `hr.attendance`, `hr.leave`, `hr.payroll`, `hr.documents`, `hr.export`, `hr.audit` |
| Sales | `sales.view`, `sales.create`, `sales.edit`, `sales.delete`, `sales.refund`, `sales.export`, `sales.discount` |
| Reports | `reports.view`, `reports.sales`, `reports.inventory`, `reports.hr`, `reports.financial`, `reports.export`, `reports.audit` |

**Total: 36 unique rights.**

## Execution contract

For each right:

1. Grant it to `test_user@hope.com`.
2. Verify the corresponding control is visible/enabled.
3. Call the protected endpoint directly and require a 2xx response.
4. Revoke it, relogin, verify the control is hidden/disabled, and require 403
   from the same direct endpoint.
5. Verify the grant/revoke audit event contains actor, target, right, action,
   and timestamp.

The test must include `customer.delete` as a direct-request denial case, not
only a hidden-button assertion. The `All` shortcut must persist all 36 rights;
the `None` shortcut must clear all 36 rights without changing another account.

