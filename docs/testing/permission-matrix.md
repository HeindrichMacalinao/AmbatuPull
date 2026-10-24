# Sprint 1 Permission Matrix

**Task:** S1-TST-04  
**Account:** `alex.rivera@hope.com`  
**Rule:** each checked right must pass both UI visibility and direct server authorization; each unchecked right must hide/disable the control and return 403 when called directly.

## Rights inventory

| Section | Rights |
|---|---|
| Customer (3) | `customer.view`, `customer.create`, `customer.delete` |
| Product (6) | `product.view`, `product.create`, `product.edit`, `product.delete`, `product.import`, `product.export` |
| Human Resources (13) | `hr.view`, `hr.create`, `hr.edit`, `hr.delete`, `hr.block`, `hr.roles`, `hr.rights`, `hr.attendance`, `hr.leave`, `hr.payroll`, `hr.documents`, `hr.export`, `hr.audit` |
| Sales (7) | `sales.view`, `sales.create`, `sales.edit`, `sales.delete`, `sales.refund`, `sales.export`, `sales.discount` |
| Reports (7) | `reports.view`, `reports.sales`, `reports.inventory`, `reports.hr`, `reports.financial`, `reports.export`, `reports.audit` |

**Total: 36 rights.**

## Execution matrix

| Right | Granted: UI/API | Revoked: UI/API | Audit event |
|---|---|---|---|
| Every right above | Visible + 2xx | Hidden/disabled + 403 | Grant/revoke actor, target, timestamp |

The test runner should expand this row into one result per right. The `All` shortcut must select all 36 rights, and `None` must clear all 36 without changing unrelated accounts.

## Evidence requirements

For each right attach the account, role, permission set, UI assertion, request URL/method/status, and audit event ID. A direct request is required for `customer.delete` even when the delete button is hidden.
