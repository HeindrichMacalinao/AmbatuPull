# Sprint 2 Usability Audit

## 1. Audit Information

- **Task ID:** S2-UIX-05
- **Task Title:** End-to-End Usability Inspection, Live Interactive Verification & Final UI Polish
- **Developer:** Alexis Adrienne Gavarra
- **GitHub:** @AlexGavarra
- **Sprint:** Sprint 2, Day 9
- **Reference:** Student Guide §3.3 and §3.4, Figures 9–14
- **Audit date:** 2026-11-20

## 2. Audit Scope

Inspected the Customer Management, Product Management, and Price History components, their dashboard integration, design-system references, related API/service behavior, and relevant tests for:

- Customer Management - Admin
- Customer Management - User
- Product Management - Admin
- Product Management - User
- Price History - Admin
- Price History - User

The repository does not contain the Student Guide or its Figure 9–14 images. The comparison below therefore uses the in-repository high-fidelity customer/product specification, design-system document, component behavior, and test contracts; it is not a pixel-by-pixel comparison to the guide.

## 3. Visual Inspection Results

| Reference | Inspected elements | Result |
| --- | --- | --- |
| Figure 9 - Customer Management, Admin | Status filters, audit columns, inactive row shading, administrative actions, search, and modal structure | Component and design-spec alignment verified by code inspection. The guide image was unavailable for direct comparison. |
| Figure 10 - Customer Management, User | Active-only listing and omission of status/audit columns and admin restore action | Component conditions and API response tests agree; live role session not exercised. |
| Figure 11 - Product Management, Admin | Product status filters, current price, audit data, and management actions | Component and price-calculation test contracts inspected; no live browser view. |
| Figure 12 - Price History, Admin | Price list, status filtering, audit columns, and add/edit/delete controls | Component and API/service test contracts inspected; no live browser view. |
| Figure 13 - Price History, User | Active price history and omission of administrative status/audit data | Component conditions and role-visibility tests agree; no live role session. |
| Figure 14 - Product Management, User | Active product listing, current price, and role-appropriate controls | Component conditions and API role-visibility tests agree; no live role session. |

Verified the customer design specification's table, row, modal, button, status, and responsive-overflow conventions. Inspection found missing dark-theme treatment in Product Management and Price History forms/tables, a misleading product-search empty message, and full-table loading replacements during subsequent customer/product searches. These were corrected as described below. No separate layout clipping or column-overflow issue was confirmed from source inspection; narrow tables retain horizontal scrolling.

## 4. Interactive Workflow Verification

No browser-based interactive session was available, so the workflows below were verified through existing automated service/HTTP tests and source inspection, not by manually using the running UI.

| Workflow | Automated/code result |
| --- | --- |
| Customer creation | Tests pass for create authorization, validation, `CREATED` stamp, and HTTP behavior. No live modal submission. |
| Customer editing | Tests pass for edit authorization, updated values, and `EDITED` stamp. No live modal submission. |
| Customer soft deletion | Tests pass for soft-delete behavior, inactive status, `DELETED` stamp, and role handling. No live table-row inspection. |
| Customer restoration | Tests pass for Admin/Superadmin restore authorization and `RESTORED` stamp. No live row restoration. |
| Product creation | Tests pass for create validation, permissions, and audit stamp. No live form submission. |
| Price History viewing | Tests pass for role visibility, active/inactive records, and API behavior. No live modal opening. |
| Past/present effective-date pricing | Pricing tests verify the latest eligible active price at a supplied as-of date; there was no live entry using today's date. |
| Future effective-date pricing | Tests verify that future prices do not take effect before their effective date and do take effect on that date. |
| Inactive product Current Price | Product UI explicitly renders `—` for inactive records; underlying price data is covered by product/pricing tests. No live table check. |

## 5. Role-Based Verification

- **Superadmin:** Existing role/permission tests cover privileged customer, product, and price operations, status visibility, and restoration.
- **Admin:** Existing tests cover management operations, status/audit data, delete/restore behavior, and pricing operations.
- **User:** Existing tests cover active-only customer/product/price visibility, omitted status/stamp fields, and permission-denied operations. The UI conditionally omits status tabs/columns and limits actions according to its role/right state.

The focused service/HTTP suites and rights-matrix test passed. These are contract-level tests; they are not a live authenticated browser session against the Next.js UI/API. No permission defect was reproduced in those suites. Browser-level verification of tab/action visibility and backend authorization through the actual login session remains outstanding.

## 6. Search and Responsiveness

Customer and Product search use a 250 ms debounce and abort superseded fetches. Service/API tests passed for case-insensitive customer and product search. Repeated searches previously replaced the whole table with a loading row, causing avoidable visual flicker. The components now keep the last rendered rows while later requests are pending; the initial load still shows its loading state. The product no-match copy now refers only to products. Narrow tables remain horizontally scrollable.

The non-flickering behavior and layout stability were assessed from the updated component state flow; no browser timing or viewport test was available.

## 7. Dark Mode Verification

Inspected both customer and product management components and the Price History modal against the existing CSS theme tokens. Customer screens already had dark variants for their forms, table, and status badges. Product and Price History had incomplete dark surfaces, controls, table headers/separators, and action colors. Added scoped theme-token styling for those components' tables, dialogs, inputs, filters, and status/action colors.

The production build passed after these changes. No live light/dark browser comparison, contrast measurement, or browser-console inspection was available.

## 8. Defects Identified and Resolved

| Issue | Affected component | Correction | Verification |
| --- | --- | --- | --- |
| Product search empty state incorrectly said “customers/products.” | `ProductManagement` | Changed the message to identify products only. | Production build passed; code inspection. |
| Subsequent customer/product searches replaced all rows with a loading row, causing avoidable table flicker. | `CustomerManagement`, `ProductManagement` | Preserve existing rows after the initial load while a later request is pending. | Production build passed; state flow inspected. No browser timing test. |
| Product and Price History forms, tables, and status/action treatments did not consistently follow the dark theme. | `ProductManagement`, `PriceHistoryModal`, `globals.css` | Added scoped dark-theme styling using existing theme variables. | Production build passed; no browser visual comparison. |

No other defect was confirmed during code/test inspection. The listed corrections are source-level findings, not claims of successful visual interaction in a browser.

## 9. Testing Summary

- `npm run build` — **passed** (Next.js production build and TypeScript checks).
- `npm test` — **could not run as written** because the `python` command resolves to the Windows Store alias (`exit code 9009`).
- Equivalent verification sequence using the installed Python Launcher — **passed**:
  `py tests/verify_hope.py && py tests/verify_user_management.py && py tests/verify_qa_fixtures.py && py tests/verify_auth_contract.py && py tests/verify_password_reset_token.py && py tests/verify_user_registration_time.py && py tests/verify_permission_matrix.py && py tests/verify_smoke_contract.py && py tests/verify_sprint1_signoff.py && py tests/verify_active_views.py && py tests/verify_domain_constraints.py && py tests/verify_customer_product_restrict.py && py tests/verify_sprint2_demo_seed.py && node --test tests/customer-list-api.test.js tests/dashboard-navigation-rbac.test.js tests/current-product-price.test.cjs`
- Focused customer/product/pricing/RBAC tests — **passed, 122 tests**:
  `node --test tests/customer-crud.test.js tests/customer-list-api.test.js tests/customer-delete-restore.test.js tests/product-crud.test.js tests/product-list-api.test.js tests/product-delete-restore.test.js tests/price-history.test.js tests/current-product-price.test.cjs tests/rights-matrix-verification.test.js`
- Lint — **not run**; `package.json` has no lint script.
- Browser/manual interaction and browser console — **not run**; no browser automation or authenticated environment was available.

The verification scripts reported that `reference/Model1.db` was absent and skipped that optional comparison. The Sprint 2 demo-seed verification also printed its existing informational note that the P-003 zero-price example is intentionally not seeded.

## 10. Remaining Limitations

- Student Guide Figures 9–14 are not present in the repository; exact visual comparison could not be completed.
- No browser tool, authenticated session, or configured `.env.local` was available for live CRUD, dark/light rendering, viewport, or console verification.
- Backend authorization was verified by existing service/HTTP and rights-matrix tests, but not by attempting operations through the live authenticated Next.js UI.
- No automated component/browser test covers the visual changes or loading-state flicker.
- The repository's `npm test` entry point requires a `python` command not available on this Windows PATH; its checks were run successfully using `py`.

## 11. Final Assessment

The code-level UI corrections are implemented, the production build passes, and the relevant service/HTTP, role, search, CRUD, and pricing tests pass. **Sprint 2 review readiness is not fully verified:** live interactive workflows, browser visual checks in both themes, and direct comparison with the Student Guide figures remain outstanding. Treat the audit as code- and test-verified, not as a live usability sign-off.
