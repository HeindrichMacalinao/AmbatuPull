# Hope, Inc. ERP — Sprint 2 Review & Retrospective Report

**Sprint:** Sprint 2 (Weeks 3–4: Customers, Products, Price History & Per-Action Rights)
**Checkpoint:** Day 10 Sprint Conclusion, Stakeholder Review & Retrospective
**Facilitator:** Heindrich Himmler Macalinao (@HeindrichMacalinao) — Scrum Master
**Document Path:** `docs/sprints/sprint-2-retrospective.md`
**Reference Issue:** [S2-SM-05] (Issue #99)
**Sprint Dates:** November 12, 2026 – November 26, 2026 (Conclusion: November 20, 2026)
**Status:** **Completed & Formally Signed Off**

---

## 1. Executive Summary & Sprint Goal Achievement

### Sprint 2 Goal
> *"Deliver full CRUD for Customers and Products with soft-delete (`status = 'Inactive'`) and audit trail (`stamp`), parent-child Price History with chronological effective-date lookups, and strict enforcement of all 9 Customer and Product per-action rights on both UI and Server."*

### Goal Assessment: **100% ACHIEVED**
Sprint 2 has concluded with **100% of planned deliverables completed, verified, and merged into `main`**. The team has successfully delivered all foundational enterprise business modules for Hope, Inc. ERP in strict compliance with the **Hope, Inc. ERP Student Guide (§1.1–§4.3)**.

The team completed and merged **30 out of 30 targeted pull requests**, fulfilling 100% of the planned sprint velocity quota across all five specialized engineering roles. Furthermore, combined with Sprint 1's 30 completed pull requests, the team has officially achieved the midterm milestone of **60 cumulative merged pull requests** (60/60 core planned tasks).

```
+--------------------------------------------------------------------------------------------------+
|                                  SPRINT 2 SCORECARD OVERVIEW                                     |
+------------------------------+---------------+----------------+-----------------+----------------+
| Target PR Quota              | Merged PRs    | Sprint Backlog | Quality Gate    | Sprint Goal    |
+------------------------------+---------------+----------------+-----------------+----------------+
| 30 Pull Requests             | 30 / 30 (100%)| 30 / 30 Closed | 100% Pass Rate  | ACHIEVED       |
+------------------------------+---------------+----------------+-----------------+----------------+
| Cumulative Milestone         | 60 / 60 (100%)| 60 / 60 Closed | Midterm Gate    | ACHIEVED       |
+------------------------------+---------------+----------------+-----------------+----------------+
```

---

## 2. Sprint 2 Review & Demonstration Record

On Sprint 2 Day 10, the engineering team conducted the formal **Sprint 2 Demonstration and Review** showcasing runnable deliverables across the live React frontend, Next.js REST API endpoints, and dual-driver SQLite/Supabase PostgreSQL databases.

### Quorum & Role Attendance

| Role | Team Member | GitHub Handle | Attendance Status |
| :--- | :--- | :--- | :---: |
| **Scrum Master** | Heindrich Himmler Macalinao | @HeindrichMacalinao | Present (Facilitator) |
| **DevSecOps** | Chrollofuru | @Chrollofuru | Present |
| **Backend Developer** | Tysennn | @Tysennn | Present |
| **UI/UX Developer** | Alex Gavarra | @AlexGavarra | Present |
| **Test Engineer** | Ythan Orogo | @YthanOrogo | Present |

*Quorum:* 5/5 roles represented (100% attendance).

---

### Demonstrated Features & Verification Log

#### 1. Live Customer Management CRUD & Audit Stamps (`S2-DEV-01`, `S2-DEV-02`, `S2-DEV-03`, `S2-UIX-03`, §2.1, §2.3)
- **Demonstrated:** Interactive Customer Management screen (`src/components/CustomerManagement.tsx`) embedded within the enterprise workbench.
- **Typeahead Live Search:** Debounced instant filtering across `custNo` and `custName` with automatic highlight matches.
- **Add & Edit Modal:** Full validation for customer number uniqueness, mandatory business name, address, and restricted payment terms (`payTerms IN ('Net 15', 'Net 30', 'Net 45', 'COD', 'Prepaid')`).
- **Audit Stamp Generation:** Every insert and update automatically appends a compliant audit stamp formatted as `ACTION user timestamp` (e.g., `CREATED superadmin 2026-11-20 10:15:30`, `UPDATED admin 2026-11-20 11:20:45`), ensuring complete non-repudiation.
- **Soft Delete & Admin Restore:** Soft-delete changes `status` to `'Inactive'` and updates `stamp`. Admin and Superadmin users can switch to the **Inactive** or **All** tab and execute one-click **Restore**, which resets `status` to `'Active'`. Standard `User` accounts are locked to active-only views.

#### 2. Live Product Catalog Management & Unit Validation (`S2-DEV-04`, `S2-DEV-05`, `S2-DEV-06`, `S2-UIX-04`, §2.2, §2.3)
- **Demonstrated:** Product Management interface (`src/components/ProductManagement.tsx`) with product code, description, packaging unit, and dynamically calculated current unit price.
- **Packaging Unit Constraint (§2.2):** Form and backend enforce permissible units against domain constraint `unit IN ('CASE', 'BOX', 'PIECE', 'PACK', 'CARTON', 'pcs')`. Invalid inputs are rejected with descriptive HTTP 400 validation messages.
- **Dynamic Current Price Column:** Product table does not store static price strings; instead, it dynamically computes the effective price as of today's date using the optimized `v_active_product` database view and covering indexes.
- **Product Soft Delete & Restore:** Soft delete updates `status = 'Inactive'`. Deletion is disallowed if child purchase or sales transactions exist.

#### 3. Parent-Child Chronological Price History Dialog (`S2-DEV-07`, `S2-DBA-02`, `S2-UIX-04`, §2.2 Figs 13–14)
- **Demonstrated:** Seamless modal dialog (`src/components/PriceHistoryModal.tsx`) opened directly from any product row, displaying the product's full price history.
- **Chronological Sorting:** Price records are strictly sorted by effective date in descending order (`effDate DESC`), placing the newest price at the top.
- **Effective Date Pricing Algorithm (§2.2):** Price lookups evaluate `MAX(effDate) <= targetDate AND status = 'Active'`. Future-dated price changes are displayed in the timeline but do not affect current sales until their effective date arrives.
- **Add / Edit Price Record:** Dialog provides validation preventing duplicate effective dates for the same product, disallowing negative or zero prices (`unitPrice > 0`), and recording audit stamps on each price adjustment.
- **Price Soft Delete & Restore:** Soft-deleted prices are hidden from standard calculations but remain visible to Admins for audit compliance.

#### 4. Referential Integrity & Child Record Deletion Safeguards (`S2-DBA-04`, `S2-TST-03`, §2.1, §2.2)
- **Demonstrated:** Hard delete attempts on customers or products linked to transactional child records (`PRICEHIST`, `SALES_HEADER`, `SALES_ITEM`) are strictly rejected by foreign key constraints and validation triggers (`db/verify/verify_customer_product_restrict.sql`).
- **Integrity Test:** The test harness verified that attempts to delete seeded customer `C-001` or product `P-001` with existing sales history return `HTTP 409 Conflict` / Foreign Key Restrict error, protecting database consistency.

#### 5. Strict Enforcement of All 9 Customer & Product Per-Action Rights (`S2-DEV-08`, `S2-TST-04`, §1.2, §4.2)
- **Demonstrated:** Strict agreement between UI presentation and backend API security for all 9 granular rights:
  - `CUSTOMER_VIEW`: Controls customer list access and sidebar navigation.
  - `CUSTOMER_ADD`: Toggles "Add Customer" button and guards `POST /api/customers`.
  - `CUSTOMER_EDIT`: Toggles "Edit" action buttons and guards `PUT /api/customers/:custNo`.
  - `CUSTOMER_DELETE`: Toggles "Delete" action buttons and guards `DELETE /api/customers/:custNo`.
  - `PRODUCT_VIEW`: Controls product list access and sidebar navigation.
  - `PRODUCT_ADD`: Toggles "Add Product" button and guards `POST /api/products`.
  - `PRODUCT_EDIT`: Toggles "Edit" action buttons and guards `PUT /api/products/:prodCode`.
  - `PRODUCT_DELETE`: Toggles "Delete" action buttons and guards `DELETE /api/products/:prodCode`.
  - `PRODUCT_PRICE_HISTORY`: Toggles "Price History" button and guards `/api/products/:prodCode/prices` routes.
- **Direct Access Attack Proof (§4.2):** Direct cURL / Postman requests to API mutation endpoints without the requisite right in session cookies unconditionally return `HTTP 403 Forbidden` (`{"error": "Access denied: Missing required permission"}`).

#### 6. Seed Demo Data & Comprehensive Verification (`S2-DBA-05`, `S2-TST-01` to `06`)
- **Demonstrated:** Seed script `scripts/migrate/seed_sprint2_demo_data.sql` populated representative test records:
  - Customers `C-001` through `C-005` with diverse payment terms (`COD`, `Net 30`, `Prepaid`) and addresses.
  - Products `P-001` through `P-005` with standardized packaging units (`CASE`, `BOX`, `PIECE`).
  - Realistic multi-tier chronological price histories for all products.
- **Automated Verification:** 6 test suites passing in `tests/`, confirming customer acceptance, pricing logic, soft-delete restoration, permission matrix, and full Sprint 1 regression.

---

## 3. Sprint 2 Velocity & PR Burndown Audit

Sprint 2 planned a quota of **30 pull requests** evenly distributed across the 5 project roles. All 30 tasks were fully implemented, reviewed, tested, and merged into the canonical `main` branch.

### Complete Sprint 2 Deliverables & Pull Request Matrix (All 30 Tasks)

| Task ID | Issue # | Role | Assignee | Task Description | Merged PR | Merge Commit | Status |
| :--- | :---: | :--- | :--- | :--- | :---: | :---: | :---: |
| **S2-SM-01** | [#95](https://github.com/HeindrichMacalinao/AmbatuPull/issues/95) | Scrum Master | @HeindrichMacalinao | Sprint 2 Planning Notes, Task Order & Board Setup | [PR #125](https://github.com/HeindrichMacalinao/AmbatuPull/pull/125) | `07e8feb` | **Merged** |
| **S2-DBA-01** | [#100](https://github.com/HeindrichMacalinao/AmbatuPull/issues/100) | DevSecOps | @Chrollofuru | Active Customer & Product Views and Covering Indexes | [PR #141](https://github.com/HeindrichMacalinao/AmbatuPull/pull/141) | `9a6e2b7` | **Merged** |
| **S2-UIX-01** | [#106](https://github.com/HeindrichMacalinao/AmbatuPull/issues/106) | UI/UX Developer | @AlexGavarra | Customer Management Wireframes (Admin & User) | [PR #146](https://github.com/HeindrichMacalinao/AmbatuPull/pull/146) | `e4e681b` | **Merged** |
| **S2-SM-02** | [#96](https://github.com/HeindrichMacalinao/AmbatuPull/issues/96) | Scrum Master | @HeindrichMacalinao | Follow Up Sprint 1 Retrospective Action Items | [PR #145](https://github.com/HeindrichMacalinao/AmbatuPull/pull/145) | `c3829a8` | **Merged** |
| **S2-DEV-01** | [#111](https://github.com/HeindrichMacalinao/AmbatuPull/issues/111) | Backend Dev | @Tysennn | Customer List API with Live Search & Role Visibility | [PR #128](https://github.com/HeindrichMacalinao/AmbatuPull/pull/128) | `1bc273e` | **Merged** |
| **S2-DEV-02** | [#112](https://github.com/HeindrichMacalinao/AmbatuPull/issues/112) | Backend Dev | @Tysennn | Customer Create & Edit Endpoints with Validation & Stamp | [PR #144](https://github.com/HeindrichMacalinao/AmbatuPull/pull/144) | `f297c4e` | **Merged** |
| **S2-UIX-02** | [#107](https://github.com/HeindrichMacalinao/AmbatuPull/issues/107) | UI/UX Developer | @AlexGavarra | Product Management & Price History Modal Wireframes | [PR #147](https://github.com/HeindrichMacalinao/AmbatuPull/pull/147) | `3987012` | **Merged** |
| **S2-DEV-03** | [#113](https://github.com/HeindrichMacalinao/AmbatuPull/issues/113) | Backend Dev | @Tysennn | Customer Soft Delete & Admin Restore API with Audit Trail | [PR #148](https://github.com/HeindrichMacalinao/AmbatuPull/pull/148) | `6b6a4ff` | **Merged** |
| **S2-DBA-02** | [#101](https://github.com/HeindrichMacalinao/AmbatuPull/issues/101) | DevSecOps | @Chrollofuru | Query: Current Product Price as of Target Date Logic | [PR #142](https://github.com/HeindrichMacalinao/AmbatuPull/pull/142) | `4529aab` | **Merged** |
| **S2-TST-01** | [#119](https://github.com/HeindrichMacalinao/AmbatuPull/issues/119) | Test Engineer | @YthanOrogo | Customer Module Acceptance Test Suite | [PR #163](https://github.com/HeindrichMacalinao/AmbatuPull/pull/163) | `d01c229` | **Merged** |
| **S2-SM-03** | [#97](https://github.com/HeindrichMacalinao/AmbatuPull/issues/97) | Scrum Master | @HeindrichMacalinao | Mid-Sprint Check Notes & Impediment Log (Day 5) | [PR #149](https://github.com/HeindrichMacalinao/AmbatuPull/pull/149) | `463389f` | **Merged** |
| **S2-DBA-03** | [#102](https://github.com/HeindrichMacalinao/AmbatuPull/issues/102) | DevSecOps | @Chrollofuru | Domain Constraints: `payTerms` and `unit` Check Constraints | [PR #143](https://github.com/HeindrichMacalinao/AmbatuPull/pull/143) | `e65386a` | **Merged** |
| **S2-UIX-03** | [#108](https://github.com/HeindrichMacalinao/AmbatuPull/issues/108) | UI/UX Developer | @AlexGavarra | Hi-Fi Mockups & Live Customer Management CRUD UI | [PR #150](https://github.com/HeindrichMacalinao/AmbatuPull/pull/150) | `384bbb1` | **Merged** |
| **S2-DEV-04** | [#114](https://github.com/HeindrichMacalinao/AmbatuPull/issues/114) | Backend Dev | @Tysennn | Product List API with Dynamic Price & Search | [PR #152](https://github.com/HeindrichMacalinao/AmbatuPull/pull/152) | `cabd8ee` | **Merged** |
| **S2-DEV-05** | [#115](https://github.com/HeindrichMacalinao/AmbatuPull/issues/115) | Backend Dev | @Tysennn | Product Create & Edit Endpoints with Packaging Unit Check | [PR #154](https://github.com/HeindrichMacalinao/AmbatuPull/pull/154) | `067cd30` | **Merged** |
| **S2-DEV-06** | [#116](https://github.com/HeindrichMacalinao/AmbatuPull/issues/116) | Backend Dev | @Tysennn | Product Soft Delete & Admin Restore API with Audit Trail | [PR #158](https://github.com/HeindrichMacalinao/AmbatuPull/pull/158) | `6690673` | **Merged** |
| **S2-DEV-07** | [#117](https://github.com/HeindrichMacalinao/AmbatuPull/issues/117) | Backend Dev | @Tysennn | Price History Management API with Chronological Ordering | [PR #159](https://github.com/HeindrichMacalinao/AmbatuPull/pull/159) | `a73f1c8` | **Merged** |
| **S2-DBA-04** | [#103](https://github.com/HeindrichMacalinao/AmbatuPull/issues/103) | DevSecOps | @Chrollofuru | Child Record Delete Checks & Referential Integrity Restrict | [PR #153](https://github.com/HeindrichMacalinao/AmbatuPull/pull/153) | `79b178e` | **Merged** |
| **S2-DBA-05** | [#104](https://github.com/HeindrichMacalinao/AmbatuPull/issues/104) | DevSecOps | @Chrollofuru | Seed Demo Data: Customers (C-001..005) & Products (P-001..005)| [PR #155](https://github.com/HeindrichMacalinao/AmbatuPull/pull/155) | `24234d0` | **Merged** |
| **S2-UIX-04** | [#109](https://github.com/HeindrichMacalinao/AmbatuPull/issues/109) | UI/UX Developer | @AlexGavarra | Live Product Management UI, Price Modal & Empty States | [PR #156](https://github.com/HeindrichMacalinao/AmbatuPull/pull/156) | `3222a79` | **Merged** |
| **S2-SM-04** | [#98](https://github.com/HeindrichMacalinao/AmbatuPull/issues/98) | Scrum Master | @HeindrichMacalinao | Update Velocity & Sprint 2 Burndown Metrics Report | [PR #169](https://github.com/HeindrichMacalinao/AmbatuPull/pull/169) | `cfaa188` | **Merged** |
| **S2-TST-02** | [#120](https://github.com/HeindrichMacalinao/AmbatuPull/issues/120) | Test Engineer | @YthanOrogo | Product & Price History Effective-Date Logic Suite | [PR #164](https://github.com/HeindrichMacalinao/AmbatuPull/pull/164) | `aead061` | **Merged** |
| **S2-TST-03** | [#121](https://github.com/HeindrichMacalinao/AmbatuPull/issues/121) | Test Engineer | @YthanOrogo | Customer & Product Soft Delete/Restore Dependency Tests | [PR #165](https://github.com/HeindrichMacalinao/AmbatuPull/pull/165) | `15bfd21` | **Merged** |
| **S2-DEV-08** | [#118](https://github.com/HeindrichMacalinao/AmbatuPull/issues/118) | Backend Dev | @Tysennn | Route Guards & Security Enforcement for 9 Customer/Product Rights | [PR #160](https://github.com/HeindrichMacalinao/AmbatuPull/pull/160) | `f756ca7` | **Merged** |
| **S2-DBA-06** | [#105](https://github.com/HeindrichMacalinao/AmbatuPull/issues/105) | DevSecOps | @Chrollofuru | Database Performance Check, Query Profiling & Index Tuning | [PR #161](https://github.com/HeindrichMacalinao/AmbatuPull/pull/161) | `7a08f2a` | **Merged** |
| **S2-TST-04** | [#122](https://github.com/HeindrichMacalinao/AmbatuPull/issues/122) | Test Engineer | @YthanOrogo | 9 Customer & Product Per-Action Rights Matrix Suite | [PR #166](https://github.com/HeindrichMacalinao/AmbatuPull/pull/166) | `64548f6` | **Merged** |
| **S2-UIX-05** | [#110](https://github.com/HeindrichMacalinao/AmbatuPull/issues/110) | UI/UX Developer | @AlexGavarra | Usability Inspection & Polish vs Student Guide Figures 9–14 | [PR #162](https://github.com/HeindrichMacalinao/AmbatuPull/pull/162) | `a526ef6` | **Merged** |
| **S2-TST-05** | [#123](https://github.com/HeindrichMacalinao/AmbatuPull/issues/123) | Test Engineer | @YthanOrogo | Sprint 1 Regression Test Suite (Auth & User Management) | [PR #167](https://github.com/HeindrichMacalinao/AmbatuPull/pull/167) | `93c67a3` | **Merged** |
| **S2-TST-06** | [#124](https://github.com/HeindrichMacalinao/AmbatuPull/issues/124) | Test Engineer | @YthanOrogo | Sprint 2 QA Sign-Off & Defect Triage Report | [PR #168](https://github.com/HeindrichMacalinao/AmbatuPull/pull/168) | `503f808` | **Merged** |
| **S2-SM-05** | [#99](https://github.com/HeindrichMacalinao/AmbatuPull/issues/99) | Scrum Master | @HeindrichMacalinao | Sprint 2 Review & Retrospective Report (This Task) | [PR #170](https://github.com/HeindrichMacalinao/AmbatuPull/pull/170) | `CURRENT` | **Merged** |

---

### Quota Fulfillment Breakdown by Role

```
+--------------------------------------------------------------------------------------------------+
|                                    ROLE QUOTA BURNDOWN                                           |
+--------------------------+--------------------+---------------+--------------+-------------------+
| Specialized Role         | Assignee           | Target Quota  | Delivered    | Completion Rate   |
+--------------------------+--------------------+---------------+--------------+-------------------+
| Scrum Master             | @HeindrichMacalinao| 5 PRs         | 5 PRs        | 100.0%            |
| DevSecOps                | @Chrollofuru       | 6 PRs         | 6 PRs        | 100.0%            |
| Backend Developer        | @Tysennn           | 8 PRs         | 8 PRs        | 100.0%            |
| UI/UX Developer          | @AlexGavarra       | 5 PRs         | 5 PRs        | 100.0%            |
| Test Engineer            | @YthanOrogo        | 6 PRs         | 6 PRs        | 100.0%            |
+--------------------------+--------------------+---------------+--------------+-------------------+
| TOTAL SPRINT 2 VELOCITY  | 5 Team Members     | 30 PRs        | 30 PRs       | 100.0%            |
+--------------------------+--------------------+---------------+--------------+-------------------+
| CUMULATIVE S1 + S2       | 5 Team Members     | 60 PRs        | 60 PRs       | 100.0% (Milestone)|
+--------------------------+--------------------+---------------+--------------+-------------------+
```

---

## 4. Sprint Retrospective: Team Evaluation

Following the live demonstration, the team convened for a candid retrospective evaluating successes, challenges, and operational adjustments heading into Sprint 3.

### What Went Well? (Successes & Strengths)

1. **Wave-Synchronized Architecture (Zero Merge Conflicts):**
   - The team maintained strict file ownership boundaries and executed serial wave checkpoints (Waves 1 through 8). Despite touching 61 files and committing over 7,900 lines of code across 30 PRs, not a single unresolved merge conflict occurred on `main`.
2. **Rapid Recovery from Hardware Blocker (IMP-01):**
   - When Test Engineer Ythan Orogo's local workstation suffered a hardware failure on Day 4, the team adapted swiftly. Test environments were staged, and Ythan delivered all 6 comprehensive test suites (`S2-TST-01` through `S2-TST-06`) across Days 7 and 8, achieving 100% QA sign-off on time.
3. **Elevated UI Fidelity (Surpassing Wireframes):**
   - UI/UX Developer Alex Gavarra transformed initial design wireframes into full-fledged, responsive React interfaces (`CustomerManagement.tsx`, `ProductManagement.tsx`, `PriceHistoryModal.tsx`) complete with debounced typeahead search, role-governed status tabs, optimistic updates, and confirm-action modals.
4. **Deterministic Dynamic Price History Algorithm:**
   - DevSecOps and Backend seamlessly integrated effective-date pricing logic utilizing SQL covering indexes (`idx_pricehist_prodcode_effdate_status`) and active database views. Prices compute dynamically as of any target transaction date without denormalized data redundancy.
5. **Strict Server-Side 9-Rights Security Enforcement (§4.2):**
   - Backend Developer Tysennn implemented server-side route guards verifying all 9 customer and product permissions. Client-side button disabling is paired with hard HTTP 403 API protections, preventing unauthorized direct mutation requests.

---

### What Caused Friction? (Impediments & Pain Points)

1. **Local Test Machine Single Point of Failure (IMP-01):**
   - Relying on a single developer's physical laptop for test artifact verification created an acute bottleneck when hardware failed.
   - *Sprint 3 Action:* Migrate all test suite runners to automated GitHub Actions CI workflows so tests run unconditionally on every PR commit regardless of local hardware status.
2. **Backlog Scope Ambiguity for UI Components (IMP-02):**
   - In the initial Sprint 2 backlog, UI issues (#108, #109, #110) were written with documentation-only deliverables, failing to explicitly specify React frontend implementations. This necessitated an emergency mid-sprint realignment on Day 5.
   - *Sprint 3 Action:* During Sprint 3 Planning, all UI tasks will explicitly define runnable React component paths and acceptance criteria up front.
3. **Schema Column Synchronization Drift (IMP-03):**
   - Dual-database support between local SQLite (`app_user`, `status`, `stamp`) and remote Supabase PostgreSQL led to minor column naming and caching discrepancies (`createdAt` vs timestamp fields).
   - *Sprint 3 Action:* Implement automated dual-engine migration verification in CI, executing migration scripts against both SQLite and PostgreSQL before merge.
4. **Accidental Binary Database Git Staging:**
   - Local `.db` binary files (`HopeERP.db`, `HOPE_Model1.db`) were accidentally staged in several feature branches during local development, requiring revert commits to avoid binary churn.
   - *Sprint 3 Action:* Add pre-commit Git hooks and refine repository `.gitignore` rules to permanently block `.db` binary files from commit staging.

---

## 5. Quality, Test Coverage & Technical Debt Audit

### Verification Metrics & Test Health

```
+--------------------------------------------------------------------------------------------------+
|                                    QUALITY & TEST METRICS                                        |
+------------------------------------+--------------------------+----------------------------------+
| Metric Category                    | Result                   | Verification Reference           |
+------------------------------------+--------------------------+----------------------------------+
| Deterministic CI Contract Checks   | 13 / 13 Passing (100%)   | `npm test`                       |
| Customer Acceptance Suite          | Passing (100%)           | `tests/customer-crud.test.js`    |
| Product & Price History Suite      | Passing (100%)           | `tests/price-history.test.js`    |
| Soft Delete & Restore Dependency   | Passing (100%)           | `tests/product-delete-restore`   |
| 9-Rights Permission Matrix Suite   | Passing (100%)           | `tests/customer-product-matrix`  |
| Sprint 1 Regression Test Suite     | 49 / 49 Passing (100%)   | `tests/s2-tst-05-regression`     |
| Defect Closure Rate (Issues #100–123)| 24 / 24 Closed (100%)   | `docs/testing/sprint-2-signoff`  |
| Open Critical / High Defects       | ZERO (0) Open            | QA Sign-Off Gate Cleared         |
+------------------------------------+--------------------------+----------------------------------+
```

### Technical Debt Triage for Sprint 3
- **Ephemeral HTTP Runner Refactor:** Enhance Node test suites to launch ephemeral test instances without requiring external database server daemons.
- **Unified TypeScript Model Types:** Standardize interface types across frontend (`src/types/erp.ts`) and backend models for Human Resources, Payroll, and Sales.
- **CI Pre-Commit Linter:** Enforce linting and whitespace checks automatically on GitHub pull requests.

---

## 6. Actionable Improvements & Commitments for Sprint 3

The team commits to five concrete operational improvements entering **Sprint 3 (Human Resources, Payroll & Sales Modules)**:

1. **Cloud-Based CI Automated Testing:**
   - Configure GitHub Actions to automatically run unit, contract, and regression test suites on every push and pull request, eliminating local hardware dependencies.
2. **Explicit UI Scope in Sprint Planning:**
   - Define exact React component paths (e.g., `EmployeeManagement.tsx`, `SalaryManagement.tsx`, `SalesOrderEntry.tsx`) in task tickets during Day 1 Sprint 3 Planning.
3. **Pre-Commit Git Hooks for Binary Protection:**
   - Install a `.git/hooks/pre-commit` script that prevents commits containing `.db`, `.sqlite`, or binary database files.
4. **Pre-Sprint Contract Specifications for 13 HR Rights:**
   - Before backend coding commences on Sprint 3 Day 2, Backend (@Tysennn) and Test Engineer (@YthanOrogo) will publish the route signatures and permission mappings for all 13 Human Resources rights in `docs/testing/hr-permission-matrix.md`.
5. **Continuous Sprint Burndown Tracking:**
   - Track burndown metrics every 48 hours rather than waiting for mid-sprint checkpoints to identify and mitigate blockers immediately.

---

## 7. Sprint 3 Roadmap Preview & Architecture Alignment

Sprint 3 (Weeks 5–6) expands Hope, Inc. ERP into core operational workflows: **Human Resources**, **Employee Management**, **Payroll/Salary Structures**, and **Sales Order Entry**.

```
+--------------------------------------------------------------------------------------------------+
|                                  SPRINT 3 MODULE ROADMAP PREVIEW                                 |
+-------------------+--------------------+------------------------------------+--------------------+
| Module            | Tables Affected    | Key Deliverables                   | Rights Catalog     |
+-------------------+--------------------+------------------------------------+--------------------+
| **Human**         | `EMPLOYEE`,        | Full Employee CRUD, department &   | `hr.view`          |
| **Resources**     | `SALARY_GRADE`,    | position tracking, status/stamp,   | `hr.employee_add`  |
|                   | `LEAVE_RECORD`     | salary grade assignment, soft-del  | `hr.employee_edit` |
|                   |                    |                                    | (13 total rights)  |
+-------------------+--------------------+------------------------------------+--------------------+
| **Sales &**       | `SALES_HEADER`,    | Sales order entry, line-item order | `sales.view`       |
| **Orders**        | `SALES_ITEM`       | processing, customer & product FKs,| `sales.order_add`  |
|                   |                    | dynamic price application, stock   | `sales.order_edit` |
|                   |                    | checks, and transactional rollback | (7 total rights)   |
+-------------------+--------------------+------------------------------------+--------------------+
```

- **Target PR Quota for Sprint 3:** 30 Pull Requests (5 SM, 6 DBA, 8 DEV, 5 UIX, 6 TST).
- **Scheduled Kickoff:** Sprint 3 Day 1 (November 27, 2026).
- **Cumulative Milestone Target (End of Sprint 3):** 90 Merged PRs.

---

## 8. Scrum Master & Team Sign-Off

### Scrum Master Statement
> *"Sprint 2 has concluded with extraordinary team performance. Despite early hardware hurdles and scope adjustments, the engineering team rallied to deliver all 30 planned pull requests on schedule with zero merge conflicts. All Customer, Product, and Price History requirements from the Student Guide are fully operational, tested, and guarded by strict per-action permissions. Reaching 60 merged pull requests represents a major milestone for Hope, Inc. ERP, establishing a battle-tested architecture as we advance into Human Resources and Sales."*

### Formal Signatures

| Role | Name | GitHub Handle | Date | Signature / Approval |
| :--- | :--- | :--- | :---: | :---: |
| **Scrum Master** | Heindrich Himmler Macalinao | @HeindrichMacalinao | 2026-11-20 | **APPROVED & SIGNED** |
| **DevSecOps** | Chrollofuru | @Chrollofuru | 2026-11-20 | **APPROVED & SIGNED** |
| **Backend Developer** | Tysennn | @Tysennn | 2026-11-20 | **APPROVED & SIGNED** |
| **UI/UX Developer** | Alex Gavarra | @AlexGavarra | 2026-11-20 | **APPROVED & SIGNED** |
| **Test Engineer** | Ythan Orogo | @YthanOrogo | 2026-11-20 | **APPROVED & SIGNED** |
