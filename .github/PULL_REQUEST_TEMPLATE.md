## Task Overview

**Task ID:** S2-UIX-04

**Role:** UI/UX Developer

**Assigned to:** @AlexGavarra

**Sprint / Due:** Sprint 2, Day 7

**Priority:** High

**Reference:** Hope, Inc. ERP Student Guide §3.4, Figures 11–14 & Usability Best Practices

## Description & Objectives

<!-- Describe the implementation and how it addresses the task objectives. -->

## Detailed Requirements

### Interactive UI State Design & Documentation
- [ ] Empty search state is implemented and documented.
- [ ] Empty price history state is implemented and documented.
- [ ] Missing-field, non-positive-price, and duplicate-date validation is implemented.
- [ ] Delete and restore confirmation copy is implemented.
- [ ] Documentation is published in `docs/ui/ui-states-error-empty.md`.

### Live Product Management Screen
- [ ] Embedded in the Dashboard under the Products tab.
- [ ] Live `GET /api/products?search=...&status=...` integration is implemented.
- [ ] Current Price is derived from the latest active, effective-on-or-before-today price.
- [ ] Inactive/unpriced products display `—`.
- [ ] Admin status tabs, counts, STATUS, STAMP, Prices, Edit, Delete, and Restore are implemented.
- [ ] User view is active-only with STATUS, STAMP, tabs, and administrative actions omitted.

### Add/Edit Product Modals
- [ ] Add Product submits to `POST /api/products`.
- [ ] Edit Product submits to `PUT /api/products/:prodCode`.
- [ ] Packaging Unit is restricted to `pcs`, `can`, `pair`, `meter`, `roll`, `box`, and `kg`.

### Soft Delete & Restore
- [ ] Delete calls `DELETE /api/products/:prodCode`.
- [ ] Inactive products are shaded for Admin and hidden for User.
- [ ] Restore calls `PUT /api/products/:prodCode/restore` and is Admin-only.

### Live Price History Modal
- [ ] Opens from the product row's Prices action.
- [ ] Header uses `Price History — [prodCode] ([description] · Unit: [unit])`.
- [ ] X, Escape, and backdrop dismissal are implemented.
- [ ] Price history loads from `GET /api/products/:prodCode/prices` ordered newest first.
- [ ] Admin status tabs, Add Price, STATUS, STAMP, Edit, and Delete are implemented.
- [ ] User status/tabs, STATUS, STAMP, and Add Price are omitted.
- [ ] User Edit/Delete actions are permission-gated and omitted for view-only users.

## Acceptance Criteria

- [ ] UI states documentation is committed.
- [ ] Product Management is embedded in the Dashboard with live API integration.
- [ ] Current price is derived correctly; inactive/unpriced products display `—`.
- [ ] Product Add/Edit and soft-delete/restore work with live database persistence.
- [ ] Price History opens over a dimmed page with the exact header format.
- [ ] Add/Edit/soft-delete prices work through live price API routes.
- [ ] Admin and User role differences are strictly enforced.
- [ ] Related issue is linked.

## Changes Introduced

<!-- Summarize the actual files and behavior changed in this PR. -->

## API Integration

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/products?search=...&status=...` | Live product search and status filtering |
| POST | `/api/products` | Add product |
| PUT | `/api/products/:prodCode` | Edit product |
| DELETE | `/api/products/:prodCode` | Soft-delete product |
| PUT | `/api/products/:prodCode/restore` | Restore product |
| GET | `/api/products/:prodCode/prices` | Load chronological price history |
| POST | `/api/products/:prodCode/prices` | Add price |
| PUT | `/api/products/:prodCode/prices/:effDate` | Edit price |
| DELETE | `/api/products/:prodCode/prices/:effDate` | Soft-delete price |

## Verification Proof / Testing

```text
<!-- Paste actual commands and results here. -->
```

## Screenshots

<!-- Add relevant screenshots if captured. -->

## Related Issue

Closes #109

## Developer Attribution

**Developer:** Alexis Adrienne Gavarra

**GitHub:** @AlexGavarra

**Role:** UI/UX Developer
