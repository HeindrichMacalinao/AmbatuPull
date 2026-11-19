# Customer Management High-Fidelity Specification

## Task Overview

| Item | Details |
| --- | --- |
| Task ID | S2-UIX-03 |
| Role | UI/UX Developer |
| Assigned to | @AlexGavarra |
| Sprint / Due | Sprint 2, Day 5 |
| Priority | High |
| Reference | Hope, Inc. ERP Student Guide §3.3, Figures 9–10 & Design System |

## 1. Design overview

Customer Management uses the existing Hope ERP design system: `#2563EB` primary
actions, `#FFFFFF` surfaces, `#F8FAFC` canvas, `#E2E8F0` borders, system UI
typography, and established blue focus treatments. The implementation is live
and uses `src/components/CustomerManagement.tsx`; this is written
specification work, not a visual mockup image.

## 2. Customer Management screen

The screen has a title, supporting description, role-appropriate Add Customer
primary action, debounced live search, loading/error/empty states, and a
horizontally scrollable table. Admin and Superadmin views include status tabs;
the User view lists active records only.

## 3. Customer table

Admin columns are Customer Number, Customer Name, Billing Address, Payment Terms,
Status, Audit Stamp, and Actions. User columns omit Status and Audit Stamp.
Customer numbers use monospace emphasis, names use semibold emphasis, and action
buttons remain grouped at the right.

## 4. Status badges

Active badges use green (`#D1FAE5` background and `#065F46` text). Inactive badges
use red (`#FEE2E2` background and `#991B1B` text). Both use a border, rounded
pill shape, 10px horizontal padding, 4px vertical padding, and semibold 12px text.

## 5. Row shading

Active rows use the default white surface. Inactive Admin rows use `#F1F5F9`
(with the existing dark-mode slate surface equivalent). Hover may use a subtle
slate tint. User views never render inactive records.

## 6. Button variants

- **Primary:** blue, 40px height, 8px radius, 16px horizontal padding.
- **Edit:** 32px row height, neutral outline, slate text.
- **Delete:** 32px row height, rose outline/text, destructive confirmation.
- **Restore:** 32px row height, emerald outline/text.
- Modals use the same 40px-height control treatment and 8px radius.
- Buttons use disabled opacity, loading text, hover surfaces, and visible focus.

## 7. Add Customer modal

Add Customer is Admin/Superadmin-only. The modal is centered, has a header close
control, a form body, and a footer. It accepts required Customer Number,
Customer Name, Billing Address, and Payment Terms fields.

## 8. Edit Customer modal

Edit prepopulates the selected record. Customer Number remains immutable in the
UI and request payload. Customer Name, Billing Address, and Payment Terms are
editable. A successful response refreshes the row and displays an EDITED stamp.

## 9. Delete confirmation

Delete opens a centered confirmation dialog naming the customer number and name.
Confirm uses the rose destructive variant and remains disabled while submitting.
Cancellation and Escape close the dialog. The API performs soft deletion; no
permanent row deletion is implemented by the frontend.

## 10. Restore interaction

Restore appears only for inactive rows in the Admin/Superadmin view. It invokes
the restore endpoint, refreshes list and counts after success, and shows a success
toast. Ordinary Users never receive the control.

## 11. Form inputs

Inputs use 40px height, 8px radius, `#E2E8F0`/slate borders, slate text, and
slate placeholder text. Focus uses blue border and 20% blue ring. Invalid fields
use red borders and red text beneath the field. Disabled fields use muted slate
surfaces and text. Required labels include a red asterisk. The Payment Terms
dropdown contains Net 15, Net 30, Net 45, COD, and Prepaid.

## 12. Admin and User differences

Admin/Superadmin have status tabs, all-status filtering, Add, audit stamps,
inactive row shading, Edit/Delete/Restore, and live API counts. Users cannot see
inactive records or status tabs and only receive Edit/Delete when rights endpoint
grants `customer.edit` or `customer.delete`. Restore is unavailable to Users.
If rights cannot be verified, restricted actions fail closed.

## 13. Interaction and state behavior

- Search waits 250ms before requesting and aborts superseded fetches.
- Loading, API error, and empty states remain explicit.
- Add/Edit submissions disable controls and prevent duplicates.
- API 401/403 errors are displayed and mutations are not assumed successful.
- Success mutations refresh the list and database-derived count queries.
- Toasts use green for success and red for API failures.
- Dialogs support Cancel, close control, backdrop close, and Escape.

## 14. API integration

The component uses the existing Next.js API routes:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/customers?search=...&status=...` | Live search/status query |
| POST | `/api/customers` | Create customer |
| PUT | `/api/customers/:custNo` | Edit customer |
| DELETE | `/api/customers/:custNo` | Soft delete customer |
| PUT | `/api/customers/:custNo/restore` | Restore customer |
| GET | `/api/users/:id/rights` | Verify standard User rights |

The frontend sends `x-user-role`, `x-user-email`, and `x-user-id` headers using
the existing header-based development/session mechanism. Backend authorization
remains the final security boundary.

The actual customer response is `{ customers, total }`. It does not return
separate active/inactive/all metrics. Counts are therefore loaded by separate
unsearched API queries for each status rather than from visible page length or
invented response fields.

## 15. Responsive behavior

The screen stacks headings and Add action on narrow widths. Search remains full
width, and tables retain independent horizontal overflow. Modals use 16px page
padding and a 90vh maximum height with an independently scrollable body.
