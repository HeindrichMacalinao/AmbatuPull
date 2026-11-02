# Hope ERP Dashboard, User Management, and Rights Wireframes

## Task information

| Item | Details |
| --- | --- |
| Task ID | S1-UIX-03 |
| Task name | Wireframes: Dashboard (3 Roles), User Management & Rights Modal |
| Role | UI/UX Developer |
| Assignee | @AlexGavarra |
| Sprint | Sprint 1, Day 4 |
| Priority | High |
| Reference | Hope, Inc. ERP Student Guide §1.2, §3.2 (Figures 6–8), §3.8 (Figures 35–40) |

## Design objective

Define consistent dashboard wireframes for Superadmin, Admin, and User roles, plus the administrative User Management screen and granular Rights dialog. These are UI/UX specifications: sample values and states illustrate the presentation and do not implement authentication, database updates, or server-side authorization.

The layouts follow [`design-system.md`](design-system.md). Available permission names follow the established 36-right catalog in `db/seeds/003_initial_access_catalog.sql`; no additional rights are implied.

## Shared dashboard layout

```text
+--------------------------------------------------------------------------------------+
| HOPE ERP                                      [Role]  [Signed-in name]   [Profile v] |
+---------------------+----------------------------------------------------------------+
| Dashboard           | Dashboard                                                      |
| Customers           | [Total Customers] [Total Products] [Open Orders] [Total Revenue]|
| Products            |                                                                |
| HR                  | Quick Actions                                                 |
| Sales               | [Action] [Action] [Action] [Action]                           |
| ...role modules...  |                                                                |
|                     | Recent activity / operational summary                       |
+---------------------+----------------------------------------------------------------+
```

- The dark header and sidebar frame the light dashboard canvas. The role label is visible near the signed-in user's name.
- KPI cards use the four required labels in every role view. Values are live-data placeholders (`—`) in these wireframes, not seeded sample totals.
- On narrow screens, the sidebar becomes a navigable drawer; KPI cards wrap into fewer columns, and horizontally wide content can scroll without compressing labels.
- Sidebar modules and enabled actions depend on role and, for User, the user's active rights. UI visibility is not a substitute for server-side authorization.

## Three dashboard role views

### Superadmin

```text
Role: Superadmin — Full administrative access

Sidebar
  Dashboard
  Customers
  Products
  HR
  Sales
  User Management
  System Settings

KPI cards
  Total Customers: —   Total Products: —   Open Orders: —   Total Revenue: —

Quick Actions
  Customers: [Add Customer] [Edit Customer] [Delete Customer]
  Products: [Add Product] [Edit Product] [Delete Product]
            [Add Price] [Edit Price] [Delete Price]
  HR:       [Add/Edit/Delete Job] [Add/Edit/Delete Department]
            [Add/Edit/Delete Employee] [View/Add/Edit/Delete Job History]
  Sales:    [Add/Edit/Delete Sale] [View/Add/Edit/Delete Sale Detail]
  Reports:  [Top Customers] [Product Master] [Top Products]
            [Active Employees] [All Employees] [Employee Job History] [Top Sales]
  Admin:    [User Management] [System Settings]
```

Superadmin sees all six application modules and the system-level settings destination. The module-related actions correspond to the existing action catalog; the User Management and System Settings destinations are administrative navigation, not added granular rights.

### Admin

```text
Role: Admin

Sidebar
  Dashboard
  Customers
  Products
  HR
  Sales
  User Management

KPI cards
  Total Customers: —   Total Products: —   Open Orders: —   Total Revenue: —

Quick Actions
  Customers: [Add Customer] [Edit Customer] [Delete Customer]
  Products: [Add Product] [Edit Product] [Delete Product]
            [Add Price] [Edit Price] [Delete Price]
  HR:       [Add/Edit/Delete Job] [Add/Edit/Delete Department]
            [Add/Edit/Delete Employee] [View/Add/Edit/Delete Job History]
  Sales:    [Add/Edit/Delete Sale] [View/Add/Edit/Delete Sale Detail]
  Reports:  [Top Customers] [Product Master] [Top Products]
            [Active Employees] [All Employees] [Employee Job History] [Top Sales]
  Admin:    [User Management]
```

Admin has the five requested business and user-management modules. **System Settings is absent** from both navigation and Quick Actions; Superadmin-only settings are not shown.

### User

```text
Role: User — Assigned rights

Sidebar
  Dashboard
  Customers                 (shown when at least one Customer right is active)
  Sales                     (shown when at least one Sales right is active)
  [other modules omitted when no right is active]

KPI cards
  Total Customers: —   Total Products: —   Open Orders: —   Total Revenue: —

Quick Actions
  Available
  [Add Customer]           [Add Sale]

  Restricted (disabled in this example)
  [Add Product]            [Add Employee]
```

This example User has active `customer.add` and `sale.add` grants only. Modules without any active grant are omitted from the sidebar; unavailable actions in a visible module may be shown disabled with a clear “No access” label. The granted and restricted examples are illustrative states, not preconfigured accounts or a fixed default permission set.

## User Management screen — Figure 35

### Superadmin view

```text
User Management                                                   [+ Add User]

+-------------------+------------------------------+------------+---------+--------------------------+
| Name              | Email                        | Role       | Status  | Actions                  |
+-------------------+------------------------------+------------+---------+--------------------------+
| [User name]       | [user@example.com]           | Superadmin | Active  | [Block] [Rights] [Edit]  |
| [User name]       | [user@example.com]           | Admin      | Blocked | [Unblock] [Rights] [Edit]|
| [User name]       | [user@example.com]           | User       | Active  | [Block] [Rights] [Edit]  |
+-------------------+------------------------------+------------+---------+--------------------------+
```

### Admin view

```text
User Management                                                   [+ Add User]

+-------------------+------------------------------+------------+---------+--------------------------+
| Name              | Email                        | Role       | Status  | Actions                  |
+-------------------+------------------------------+------------+---------+--------------------------+
| [User name]       | [user@example.com]           | Admin      | Active  | —                        |
| [User name]       | [user@example.com]           | User       | Blocked | [Unblock] [Rights] [Edit]|
+-------------------+------------------------------+------------+---------+--------------------------+
```

- Columns are Name, Email, Role, Status, and Actions. Role badges distinguish Superadmin, Admin, and User; status badges show Active or Blocked using the design-system status colors and text.
- Superadmin can see all roles and the row actions represented above.
- The Admin table entirely omits Superadmin rows. Other Admin rows show `—` and cannot be managed as peer accounts.
- Block/Unblock is a status-sensitive action. Rights opens the selected user's Rights dialog; Edit opens the user-edit flow.
- User names and emails above are placeholders, not demo or seeded identities. On narrow screens, the table scrolls horizontally rather than hiding columns.

## Rights Dialog Modal — Figures 37–40

```text
+-----------------------------------------------------------------------------------+
| Rights for [selected user's name]                                            [x]   |
| [selected user's email]                                                           |
| Select the actions this user may access.                                          |
+-----------------------------------------------------------------------------------+
| [ ] Customer                                      [All] [None]                    |
|     [ ] Add Customer   [ ] Edit Customer   [ ] Delete Customer (Soft delete)     |
|-----------------------------------------------------------------------------------|
| [ ] Product                                       [All] [None]                    |
|     [ ] Add Product   [ ] Edit Product   [ ] Delete Product                       |
|     [ ] Add Price     [ ] Edit Price     [ ] Delete Price                         |
|-----------------------------------------------------------------------------------|
| [ ] Human Resources                              [All] [None]                    |
|     [ ] Add Job       [ ] Edit Job       [ ] Delete Job                           |
|     [ ] Add Department [ ] Edit Department [ ] Delete Department                 |
|     [ ] Add Employee  [ ] Edit Employee  [ ] Delete Employee                      |
|     [ ] View Job History (Data Privacy Act gatekeeper)                           |
|     [ ] Add Job History [ ] Edit Job History [ ] Delete Job History              |
|-----------------------------------------------------------------------------------|
| [ ] Sales                                         [All] [None]                    |
|     [ ] Add Sale      [ ] Edit Sale      [ ] Delete Sale                          |
|     [ ] View Sale Detail [ ] Add Sale Detail [ ] Edit Sale Detail                |
|     [ ] Delete Sale Detail                                                       |
|-----------------------------------------------------------------------------------|
| [ ] Reports                                       [All] [None]                    |
|     [ ] Top Customers Report  [ ] Product Master Report                          |
|     [ ] Top Products Report   [ ] Active Employees Report                        |
|     [ ] All Employees Report  [ ] Employee Job History Report                    |
|     [ ] Top Sales Report                                                        |
+-----------------------------------------------------------------------------------+
|                                               [Cancel] [Save Rights]              |
+-----------------------------------------------------------------------------------+
```

### Permission catalog

The dialog contains exactly **36 unique granular permission checkboxes**, grouped as 3 Customer, 6 Product, 13 Human Resources, 7 Sales, and 7 Reports rights. The labels below match the descriptions in the established seed catalog.

**Customer — 3**

- [ ] Add Customer (`customer.add`)
- [ ] Edit Customer (`customer.edit`)
- [ ] Delete Customer (Soft delete) (`customer.delete`)

**Product — 6**

- [ ] Add Product (`product.add`)
- [ ] Edit Product (`product.edit`)
- [ ] Delete Product (`product.delete`)
- [ ] Add Price (`price.add`)
- [ ] Edit Price (`price.edit`)
- [ ] Delete Price (`price.delete`)

**Human Resources — 13**

- [ ] Add Job (`job.add`)
- [ ] Edit Job (`job.edit`)
- [ ] Delete Job (`job.delete`)
- [ ] Add Department (`dept.add`)
- [ ] Edit Department (`dept.edit`)
- [ ] Delete Department (`dept.delete`)
- [ ] Add Employee (`emp.add`)
- [ ] Edit Employee (`emp.edit`)
- [ ] Delete Employee (`emp.delete`)
- [ ] View Job History (Data Privacy Act gatekeeper) (`jobhistory.view`)
- [ ] Add Job History (`jobhistory.add`)
- [ ] Edit Job History (`jobhistory.edit`)
- [ ] Delete Job History (`jobhistory.delete`)

**Sales — 7**

- [ ] Add Sale (`sale.add`)
- [ ] Edit Sale (`sale.edit`)
- [ ] Delete Sale (`sale.delete`)
- [ ] View Sale Detail (`saledetail.view`)
- [ ] Add Sale Detail (`saledetail.add`)
- [ ] Edit Sale Detail (`saledetail.edit`)
- [ ] Delete Sale Detail (`saledetail.delete`)

**Reports — 7**

- [ ] Top Customers Report (`report.top_customers`)
- [ ] Product Master Report (`report.product_master`)
- [ ] Top Products Report (`report.top_products`)
- [ ] Active Employees Report (`report.active_emp`)
- [ ] All Employees Report (`report.all_emp`)
- [ ] Employee Job History Report (`report.emp_job_history`)
- [ ] Top Sales Report (`report.top_sales`)

### Dialog interaction and states

- Each module heading has a master checkbox. Selecting it selects every right in that group; clearing it clears every right in that group.
- Each group has **All** and **None** shortcuts with the same per-module behavior. These controls are separate from the 36 individual permission checkboxes.
- A fully selected group shows a checked master checkbox; an empty group shows an unchecked one. A partially selected group shows the checkbox's indeterminate state.
- Selecting **Cancel** or the close control exits without applying the pending changes. **Save Rights** applies the displayed selection in the design; persistence and authorization enforcement belong to application implementation, not these wireframes.
- Keep each module heading, master control, shortcuts, and child permissions visually distinct. On compact screens the dialog content scrolls within the overlay, and footer actions remain clear and reachable.

## UI/UX and responsive design

- Reuse the typography, palette, spacing, table, badge, and modal guidance in [`design-system.md`](design-system.md); do not introduce a separate visual language.
- Keep role labels, blocked states, disabled actions, and partial selections understandable through text and control state, not color alone.
- Wrap KPI and Quick Action cards on smaller screens. Convert the sidebar to the existing drawer pattern and preserve horizontal scrolling for the User Management table.
- These wireframes specify presentation and intended control behavior only. User administration, persisted grants, live KPI queries, and role enforcement are not implemented here.
