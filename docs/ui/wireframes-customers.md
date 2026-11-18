# Customer Management Wireframes

## 1. Overview

| Item | Details |
| --- | --- |
| Task ID | S2-UIX-01 |
| Issue | #106 |
| Module | Customer Management |
| Reference | Hope, Inc. ERP Student Guide §3.3, Figures 9 and 10 |

The guide figures are not included in this repository. The implementation follows
the task requirements and the existing Hope ERP design system. The screen is a
wireframe demonstration and does not add customer CRUD endpoints.

## 2. Admin Customer View (Figure 9)

The dashboard's Customer Registry tab displays a **Customer Management** heading,
the primary **+ Add Customer** action, status navigation, live search, and a
scrollable customer table. The status navigation provides Active, Inactive, and
All tabs.

Tab counts are derived from the customer fixture data (four Active, one Inactive,
five total); they are not separately specified constants. Selecting a tab filters
rows by status. Search updates immediately and matches customer number, name,
address, and payment terms in combination with the selected tab.

The table columns, in order, are **CUST NO**, **CUSTOMER NAME**, **ADDRESS**,
**PAY TERMS**, **STATUS**, **STAMP**, and **ACTIONS**. Active and Inactive have
distinct text-and-color badges. The inactive C-004 — Umbrella Corp row uses a
shaded background; its address, payment terms, and stamp are unspecified in the
reference and shown as em dashes.

Active rows display Edit and Delete. The inactive row displays Edit and Restore,
not Delete. These action controls and Add Customer are presentational only; this
wireframe task does not implement their mutations or a backend.

Four Active demonstration records use customer data from the repository's
historical customer seed. The required C-004 — Umbrella Corp record is supplied
by the task; its unavailable details are intentionally not invented.

## 3. User Customer View (Figure 10)

The User perspective has the **Customer Management** heading, live search, and a
customer table. Its columns, in order, are **CUST NO**, **CUSTOMER NAME**,
**ADDRESS**, **PAY TERMS**, and **ACTIONS**.

Status navigation, status values, audit stamps, and inactive customer records
are excluded from the User render. In particular, C-004 — Umbrella Corp is
filtered out before rows are rendered.

The view requests the signed-in user's existing rights and displays Edit only
with `customer.edit` and Delete only with `customer.delete`. Restore is never
available in the User view. If the rights request fails, the view reports the
failure and hides both actions.

## 4. Component Breakdown

| Component | Responsibility and inputs | Main behavior and relationship |
| --- | --- | --- |
| `CustomerManagement` | Receives the current `role` and signed-in `user`. | Owns status selection, search, rights loading, dynamic counts, and role-specific row filtering. Renders the status tabs, search, and table. |
| `CustomerStatusTabs` | Receives selected status, derived counts, and a selection callback. | Renders Active, Inactive, and All with count pills; only mounted for Admin and Superadmin. |
| `CustomerSearch` | Receives current search text and its change callback. | Provides the shared live search input for both views. |
| `CustomerTable` | Receives filtered customers, role view, and action capabilities. | Renders the exact role-specific column set and shaded inactive rows; composes badge and actions components. |
| `CustomerStatusBadge` | Receives a customer's Active or Inactive status. | Renders a text-and-color status badge for the Admin table. |
| `CustomerActions` | Receives the row, role, and Edit/Delete capability flags. | Shows Admin actions by status; for Users, only the rights explicitly granted by the existing rights endpoint. |

The page is embedded in the existing Dashboard Customer Registry tab and uses
the existing Next.js App Router, React, Tailwind classes, Lucide icons, role
state, and user-rights endpoint.

## 5. Admin vs. User Comparison

| Area | Admin / Superadmin | User |
| --- | --- | --- |
| Status navigation | Active, Inactive, All with counts | Absent |
| Search | Live; combines with selected status | Live; active records only |
| Table columns | CUST NO, CUSTOMER NAME, ADDRESS, PAY TERMS, STATUS, STAMP, ACTIONS | CUST NO, CUSTOMER NAME, ADDRESS, PAY TERMS, ACTIONS |
| Soft-deleted records | Included in Inactive and All; shaded row | Excluded before rendering |
| Row actions | Active: Edit/Delete; inactive: Edit/Restore | Edit/Delete only with the corresponding granted right; no Restore |
| Permissions | Admin role view exposes the specified wireframe actions | Existing `customer.edit` and `customer.delete` grants control actions |

## 6. Verification

Verification results are recorded after running the checks; an unavailable check
is identified rather than treated as successful.

| Check | Command or method | Result |
| --- | --- | --- |
| Build | `npm run build` | Passed |
| Type check | `npx tsc --noEmit` | Passed |
| Lint | No lint script is defined in `package.json` | Not available |
| Automated tests | `npm test` | Passed (Python checks and 27 Node tests) |
| Admin view | Source-level verification; no browser/e2e runner is configured | Browser check not run |
| User view | Source-level verification; no browser/e2e runner is configured | Browser check not run |
| Search and counts | Derived count and filter implementation compiled; no browser/e2e runner is configured | Browser check not run |
