## Task Overview

**Task ID:** S2-UIX-04

**Role:** UI/UX Developer

**Assigned to:** @AlexGavarra

**Sprint / Due:** Sprint 2, Day 7

**Priority:** High

**Reference:** Hope, Inc. ERP Student Guide §3.4, Figures 11–14 & Usability Best Practices

## Description & Objectives

Design UX state variations (empty, error, and confirmation modals) and implement the live Product Management screen and Price History modal dialog in the frontend workbench. The implementation connects the products and chronological price history interfaces to live backend APIs.

## Detailed Requirements

### Interactive UI State Design & Documentation
- [x] Empty search state displays: `No customers/products found matching '[query]'. Clear search or add a new record.`
- [x] Empty price history state displays: `No price records found for this product. Click '+ Add Price' to set an initial price.`
- [x] Missing required fields, non-positive unit prices, and duplicate effective dates are validated.
- [x] Duplicate effective dates display: `A price record already exists for this effective date.`
- [x] Delete confirmation: `Are you sure you want to delete this record? This action will deactivate the record.`
- [x] Restore confirmation: `Are you sure you want to restore this record? It will become available again.`
- [x] Documentation is published in `docs/ui/ui-states-error-empty.md`.

### Live Product Management Screen
- [x] Embedded in the Dashboard under the Products tab.
- [x] Live `GET /api/products?search=...&status=...` integration is implemented.
- [x] Current Price uses the latest active price effective on or before today.
- [x] Inactive products and unpriced products display `—`.
- [x] Admin status tabs, counts, STATUS, STAMP, Prices, Edit, Delete, and Restore are implemented.
- [x] User view is active-only with status tabs, STATUS, STAMP, and administrative product actions omitted.

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
- [x] Price history loads from `GET /api/products/:prodCode/prices` and is ordered by `effDate DESC`.
- [x] Admin status tabs, Add Price, STATUS, STAMP, Edit, and Delete are implemented.
- [x] User status tabs, STATUS, STAMP, and Add Price are omitted.
- [x] User Edit/Delete actions are independently permission-gated; view-only users receive no Actions column.

## Acceptance Criteria

- [x] UI states documentation is committed to `docs/ui/ui-states-error-empty.md`.
- [x] Product Management is embedded in the Dashboard with live API integration.
- [x] Current price is derived correctly; inactive/unpriced products display `—`.
- [x] Product Add/Edit and soft-delete/restore work with live database persistence.
- [x] Price History opens over a dimmed page with the exact header format.
- [x] Adding, editing, and soft-deleting chronological prices work through live price API routes.
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

No manual browser screenshots or automated browser interaction results are available.

## Screenshots

No screenshots were captured.

## Related Issue

Closes #109

## Developer Attribution

**Developer:** Alexis Adrienne Gavarra

**GitHub:** @AlexGavarra

**Role:** UI/UX Developer
