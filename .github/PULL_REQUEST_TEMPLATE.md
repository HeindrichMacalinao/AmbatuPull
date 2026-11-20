## Task Overview

**Task ID:** S2-UIX-04

**Role:** UI/UX Developer

**Assigned to:** @AlexGavarra

**Sprint / Due:** Sprint 2, Day 7

**Priority:** High

**Reference:** Hope, Inc. ERP Student Guide §3.4, Figures 11–14 & Usability Best Practices

## Description & Objectives

Implemented Task S2-UIX-04 for the Hope, Inc. ERP frontend. The workbench now includes a live Product Management screen in the Dashboard Products tab and a live Price History modal for each product. The implementation provides role-aware UI states, product and chronological price CRUD interactions, loading and error handling, confirmations, inline validation, and live backend persistence.

## Detailed Requirements

### Interactive UI State Design & Documentation
- [x] Empty search state is implemented and documented.
- [x] Empty price history state is implemented and documented.
- [x] Missing-field, non-positive-price, and duplicate-date validation is implemented.
- [x] Delete and restore confirmation copy is implemented.
- [x] Documentation is published in `docs/ui/ui-states-error-empty.md`.

### Live Product Management Screen
- [x] Embedded in the Dashboard under the Products tab.
- [x] Live `GET /api/products?search=...&status=...` integration is implemented.
- [x] Current Price is derived by the existing backend from the latest active, effective-on-or-before-today price.
- [x] Inactive/unpriced products display `—`.
- [x] Admin status tabs, counts, STATUS, STAMP, Prices, Edit, Delete, and Restore are implemented.
- [x] User view is active-only with STATUS, STAMP, tabs, and administrative actions omitted.

### Add/Edit Product Modals
- [x] Add Product submits to `POST /api/products`.
- [x] Edit Product submits to `PUT /api/products/:prodCode`.
- [x] Packaging Unit is restricted to `pcs`, `can`, `pair`, `meter`, `roll`, `box`, and `kg`.

### Soft Delete & Restore
- [x] Delete calls `DELETE /api/products/:prodCode`.
- [x] Inactive products are shaded for Admin and hidden for User.
- [x] Restore calls `PUT /api/products/:prodCode/restore` and is Admin-only.

### Live Price History Modal
- [x] Opens from the product row's Prices action.
- [x] Header uses `Price History — [prodCode] ([description] · Unit: [unit])`.
- [x] X, Escape, and backdrop dismissal are implemented.
- [x] Price history loads from `GET /api/products/:prodCode/prices` ordered newest first.
- [x] Admin status tabs, Add Price, STATUS, STAMP, Edit, and Delete are implemented.
- [x] User status/tabs, STATUS, STAMP, and Add Price are omitted.
- [x] User Edit/Delete actions are permission-gated and omitted for view-only users.

## Acceptance Criteria

- [x] UI states documentation is committed.
- [x] Product Management is embedded in the Dashboard with live API integration.
- [x] Current price is derived correctly; inactive/unpriced products display `—`.
- [x] Product Add/Edit and soft-delete/restore work with live database persistence.
- [x] Price History opens over a dimmed page with the exact header format.
- [x] Add/Edit/soft-delete prices work through live price API routes.
- [x] Admin and User role differences are strictly enforced.
- [x] Related issue is linked.

## Changes Introduced

- Implemented `src/components/ProductManagement.tsx` with live product search, status tabs and counts, loading/empty/error states, current-price display, Add/Edit forms, soft-delete confirmation, and restore confirmation.
- Integrated the Product Management component into `src/app/dashboard/page.tsx` under the Products tab.
- Implemented `src/components/PriceHistoryModal.tsx` with the exact product header, backdrop dismissal, X and Escape dismissal, newest-first history, loading/empty/error states, status filtering, inline validation, and permission-aware actions.
- Added live product Add/Edit/Delete/restore API handling and price history Add/Edit/soft-delete API routes.
- Added server-side Admin/Superadmin restrictions for product mutations and permission checks for price mutations.
- Added `docs/ui/ui-states-error-empty.md` for empty search, empty price history, validation, delete confirmation, and restore confirmation states.

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
npm run build
Result: Passed. Next.js production build and TypeScript checks completed successfully.

npm run test
Result: Passed. 27 tests passed, 0 failed.

git diff --check
Result: Passed with no whitespace errors.
```

## Screenshots

No screenshots were captured.

## Related Issue

Closes #109

## Developer Attribution

**Developer:** Alexis Adrienne Gavarra

**GitHub:** @AlexGavarra

**Role:** UI/UX Developer
