# Product Management & Price History Wireframes

## 1. Overview

| Item | Details |
| --- | --- |
| Task ID | S2-UIX-02 |
| Issue | #107 |
| Module | Product Management and Price History |
| Reference | Hope, Inc. ERP Student Guide §3.4, Figures 11–14 |

The Student Guide and its figures are not included in this repository. These
wireframes follow the task requirements and the existing [Hope ERP design
system](design-system.md). Product records, prices, and timestamps below are
illustrative documentation examples; this document does not implement UI or
application behavior.

## 2. Roles and Visibility Rules

- Admin sees Active, Inactive, and All products, with status tabs, status and
  stamp columns, and administrative row actions.
- User sees active products only. The User product list omits status navigation,
  status, and stamp details, and does not expose administrative actions.
- Both views can show the Price History modal when the user has access to it.
  Admin sees status tabs, statuses, stamps, and Add Price. User sees a
  simplified history and only the price actions allowed by their permissions.
- UI visibility in these wireframes does not replace server-side authorization.

## 3. Product Management List

### 3.1 Admin View — Figure 11

Admin can switch among Active, Inactive, and All products. Counts reflect the
illustrative five-product dataset. P-004 is inactive, so its Current Price is
shown as an em dash rather than a stale or active price.

```text
+-------------------------------------------------------------------------------------------------------------------------------------+
| HOPE ERP / PRODUCTS                                      PRODUCT MANAGEMENT                              [+ Add Product]             |
+-------------------------------------------------------------------------------------------------------------------------------------+
| [ Active (4) ]   [ Inactive (1) ]   [ All (5) ]                                                                                     |
+-------------------------------------------------------------------------------------------------------------------------------------+
| PROD CODE | DESCRIPTION       | UNIT | CURRENT PRICE | STATUS   | STAMP                               | ACTIONS                     |
+-------------------------------------------------------------------------------------------------------------------------------------+
| P-001     | Cement 40kg       | bag  | ₱285.00       | Active   | Created 2026-10-01 · Updated 11-02  | Prices · Edit · Delete      |
| P-002     | Steel Bar 10mm    | pc   | ₱195.00       | Active   | Created 2026-10-01 · Updated 11-02  | Prices · Edit · Delete      |
| P-003     | Lubricant Oil 5L  | can  | ₱650.00       | Active   | Created 2026-10-01 · Updated 11-02  | Prices · Edit · Delete      |
| P-004     | Industrial Paint  | gal  | —             | Inactive | Created 2026-10-01 · Updated 11-02  | Prices · Edit · Restore     |
| P-005     | Electrical Wire   | roll | ₱420.00       | Active   | Created 2026-10-01 · Updated 11-02  | Prices · Edit · Delete      |
+-------------------------------------------------------------------------------------------------------------------------------------+
```

The five rows, prices, counts, and stamp dates are sample values. “Created”
and “Updated” indicate record stamp information; the dates are not live data.
The inactive P-004 row must never show an outdated price in Current Price.
Prices opens the selected product's history; Edit and Delete/Restore are
administrative controls shown for the corresponding row state.

### 3.2 User View — Figure 14

The User list includes active products only, without status tabs or status and
stamp details. The Prices link is shown only when the user can access that
product's history; no product edit, delete, or restore controls are included.

```text
+-----------------------------------------------------------------------------------------------+
| HOPE ERP / PRODUCTS                         PRODUCT MANAGEMENT                                |
+-----------------------------------------------------------------------------------------------+
| PROD CODE | DESCRIPTION       | UNIT | CURRENT PRICE | ACTIONS                                |
+-----------------------------------------------------------------------------------------------+
| P-001     | Cement 40kg       | bag  | ₱285.00       | Prices*                                |
| P-002     | Steel Bar 10mm    | pc   | ₱195.00       | Prices*                                |
| P-003     | Lubricant Oil 5L  | can  | ₱650.00       | Prices*                                |
| P-005     | Electrical Wire   | roll | ₱420.00       | Prices*                                |
+-----------------------------------------------------------------------------------------------+
| * Prices is available only when the User has access to the product history.                  |
+-----------------------------------------------------------------------------------------------+
```

P-004 is not displayed because it is inactive. The User table has no STATUS or
STAMP column and offers no administrative actions.

## 4. Price History Modal Dialog

### 4.1 Modal Structure and Behavior

The modal is a centered surface above the Product Management page. The
underlying page remains visible but dimmed; the modal sits above it. The exact
header for both role views is:

**Price History — P-003 (Lubricant Oil 5L · Unit: can)**

The close control is an `X` icon in the upper-right corner of the modal.
Selecting Prices opens the history for that product. Selecting `X` dismisses
the modal and returns to the Product Management screen with its current page
context preserved.

- Escape dismisses the modal if supported by the application's existing modal
  convention.
- Clicking outside dismisses the modal only if supported by the application's
  existing modal convention; otherwise, the modal remains open.
- These are wireframe interaction specifications, not claims that the
  interactions have been implemented.

### 4.2 Admin View — Figure 12

The Admin modal shows every price-history record and its status, along with
status filters and the Add Price action. Records, dates, stamps, and prices
shown are illustrative examples.

```text
DIMMED PRODUCT MANAGEMENT PAGE (visible behind the overlay)
+--------------------------------------------------------------------------------------------+
| HOPE ERP / PRODUCTS                      PRODUCT MANAGEMENT                                |
| [ Active (4) ] [ Inactive (1) ] [ All (5) ]                                                |
| P-001 Cement 40kg       bag   ₱285.00   Active   ...                                       |
| P-002 Steel Bar 10mm    pc    ₱195.00   Active   ...                                       |
| P-003 Lubricant Oil 5L  can   ₱650.00   Active   ...   [Prices] [Edit] [Delete]             |
+--------------------------------------------------------------------------------------------+
                  |===============================================================|
                  | Price History — P-003 (Lubricant Oil 5L · Unit: can)       [X] |
                  | [ Active ]   [ Inactive ]   [ All ]            [+ Add Price] |
                  |---------------------------------------------------------------|
                  | EFFECTIVE DATE | UNIT PRICE | STATUS   | STAMP       | ACTIONS |
                  |----------------|------------|----------|-------------|---------|
                  | 2026-11-01     | ₱650.00    | Active   | Created /   | Edit ·  |
                  |                |            |          | Updated     | Delete  |
                  | 2026-10-01     | ₱625.00    | Inactive | Created /   | Edit ·  |
                  |                |            |          | Updated     | Delete  |
                  | 2026-09-01     | ₱600.00    | Inactive | Created /   | Edit ·  |
                  |                |            |          | Updated     | Delete  |
                  |===============================================================|
```

The modal overlays and visually dims the still-visible Product Management
screen. Admin can filter the full history by status, add a price, and use the
displayed Edit and Delete actions.

### 4.3 User View — Figure 13

The User modal keeps the same product-identifying header and close control but
omits status filters, the STATUS and STAMP columns, and Add Price. The example
history rows and dates are illustrative.

```text
DIMMED PRODUCT MANAGEMENT PAGE (visible behind the overlay)
+-----------------------------------------------------------------------------------------------+
| HOPE ERP / PRODUCTS                         PRODUCT MANAGEMENT                                |
| P-001 Cement 40kg       bag   ₱285.00   Prices*                                               |
| P-002 Steel Bar 10mm    pc    ₱195.00   Prices*                                               |
| P-003 Lubricant Oil 5L  can   ₱650.00   Prices*                                               |
| P-005 Electrical Wire   roll  ₱420.00   Prices*                                               |
+-----------------------------------------------------------------------------------------------+
                    |===============================================================|
                    | Price History — P-003 (Lubricant Oil 5L · Unit: can)       [X] |
                    |---------------------------------------------------------------|
                    | EFFECTIVE DATE | UNIT PRICE | ACTIONS                         |
                    |----------------|------------|---------------------------------|
                    | 2026-11-01     | ₱650.00    | Edit · Delete*                  |
                    | 2026-10-01     | ₱625.00    | Edit · Delete*                  |
                    | 2026-09-01     | ₱600.00    | Edit · Delete*                  |
                    |===============================================================|
                    | * Each action appears only when its matching permission exists.|
```

When the User has view-only access, the Actions column is hidden entirely; the
effective date and unit price remain visible. Edit and Delete are independently
shown only when the corresponding price permissions are granted. A User is not
assumed to have either permission.

## 5. Role-Based Visibility Comparison

| Feature | Admin | User |
| --- | --- | --- |
| Active product list | Yes | Yes |
| Inactive product list | Yes | No |
| Product status tabs | Yes | No |
| Product Status column | Yes | No |
| Product Stamp column | Yes | No |
| Price History modal | Yes | Yes, subject to access |
| Price History status tabs | Yes | No |
| Price History Status column | Yes | No |
| Price History Stamp column | Yes | No |
| Add Price | Yes | No |
| Edit Price | Yes | If permitted |
| Delete Price | Yes | If permitted |
| Restore Product | Yes | No |

## 6. Interaction and Display Rules

- Product status tabs are `[ Active (4) ] [ Inactive (1) ] [ All (5) ]` in the
  Admin example; selecting a tab filters the rows without changing product
  status.
- The User product list includes only active products, has no status tabs,
  STATUS, or STAMP column, and does not show Delete or Restore.
- An inactive product such as P-004 displays `—` for Current Price.
- Selecting Prices opens the selected product's history in the role-appropriate
  modal, when the User is permitted to access it.
- The modal header identifies P-003 exactly as
  `Price History — P-003 (Lubricant Oil 5L · Unit: can)` in both roles.
- The modal is above a dimmed, visible Product Management page. Closing it
  returns to the same page context.
- The `X` dismisses the modal. Escape and outside-click dismissal are
  conditional on the application's existing modal conventions.
- Admin history includes all records and their statuses. User history hides
  status and stamp information and has no status filters or Add Price action.
- User Edit and Delete controls depend independently on their matching
  permissions. With view-only access, omit the Actions column.
- Tables retain readable headings and horizontal scrolling rather than
  compressing columns on narrow screens, consistent with the design system.

## 7. Acceptance Criteria

- [ ] Product Management Admin View (Figure 11) is documented.
- [ ] Product Management User View (Figure 14) is documented.
- [ ] Admin product status tabs show Active (4), Inactive (1), All (5).
- [ ] Admin product table includes Status and Stamp columns.
- [ ] User product table hides Status and Stamp columns.
- [ ] Inactive product P-004 displays `—` in Current Price.
- [ ] Admin Price History modal (Figure 12) is documented.
- [ ] User Price History modal (Figure 13) is documented.
- [ ] Modal header displays the exact product identification.
- [ ] Modal overlay and close interactions are specified.
- [ ] Admin Price History includes status tabs and Add Price.
- [ ] User Price History hides status tabs, Status, and Stamp.
- [ ] User actions respect permissions.
- [ ] Role-based visibility comparison is included.
- [ ] Documentation is saved in `docs/ui/wireframes-products.md`.
