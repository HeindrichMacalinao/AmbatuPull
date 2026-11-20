# Hope, Inc. ERP — Sprint 2 Velocity & Burndown Metrics Report

**Sprint:** Sprint 2 (Weeks 3–4: Customers, Products, Price History & Per-Action Rights)
**Checkpoint:** Day 8 Velocity & Burndown Audit
**Facilitator / Author:** Heindrich Himmler Macalinao (@HeindrichMacalinao) — Scrum Master
**Document Path:** `docs/sprints/sprint-2-velocity.md`
**Reference Issue:** [S2-SM-04] (Issue #98)
**Sprint Dates:** November 12, 2026 – November 26, 2026 (Day 8 Checkpoint: November 20, 2026)
**Target Milestone:** 60 Cumulative Merged PRs (Sprint 1: 30 PRs + Sprint 2: 30 PRs)

---

## 1. Executive Summary & Sprint Trajectory

This report documents the team's velocity, burndown rate, and pull request completion metrics at the **Day 8 Checkpoint** of Sprint 2. Following the Mid-Sprint Checkpoint on Day 5 (where 10 of 30 tasks were merged and team operations were challenged by a Test Engineer workstation failure and scope adjustments), the engineering team executed a disciplined, wave-synchronized development surge across Days 6, 7, and 8.

### Key Highlights at Day 8:
1. **Core Development Completed (100% of DEV, DBA, UIX, and TST Tasks):** All technical prerequisites across the Customer Management and Product Management modules—including full CRUD APIs, soft-delete with admin restore, parent-child chronological Price History, packaging unit constraints, 9 granular per-action rights enforcement, live React interactive management interfaces, and automated test regression suites—have been merged into `main`.
2. **Sprint 2 Task Burndown:** **28 out of 30 planned tasks (93.3%)** are officially merged into the canonical repository branch. With this report (Task `S2-SM-04`), the team advances to **29 out of 30 tasks completed (96.7%)**.
3. **Progress Toward 60 Merged PR Milestone:**
   - **Sprint 1 Baseline:** 30 of 30 planned PRs merged (100%).
   - **Sprint 2 Core Tasks:** 28 merged + 1 active (`S2-SM-04`) = 29 / 30 tasks (96.7%).
   - **Cumulative Core Milestone Progress:** **58 / 60 (96.7%) merged**, rising to **59 / 60 (98.3%)** upon merging PR #169 (`S2-SM-04`).
   - **Repository-Wide Total Merged PRs:** **83 merged PRs** (accounting for foundational sprint scaffolding, security refactoring, database patches, and core sprint feature PRs).
4. **Week 4 Deliverables Feasibility:** Week 4 deliverables are **fully on schedule and ahead of original projections**. All functional code, security route guards, database integrity triggers, and test sign-offs are locked down, leaving only the final Sprint Review, stakeholder demo, and retrospective (`S2-SM-05`) for Days 9–10.

---

## 2. Metrics Tracking: Planned vs. Merged PR Counts by Role

Sprint 2 established a strict quota of **30 pull requests** evenly distributed across the 5 specialized roles to ensure cross-functional accountability and adherence to the Hope, Inc. ERP Student Guide (§1.1–§4.3).

### Quota Summary by Role (Day 8 Checkpoint)

| Role | Assigned Member | Sprint 2 Quota | Merged PRs | In Review / Active | Remaining Tasks | Role Completion Rate | Status / Pace |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Backend Developer** | @Tysennn | 8 | 8 | 0 | 0 | **100.0%** | **Completed** (All 8 Merged) |
| **DevSecOps** | @Chrollofuru | 6 | 6 | 0 | 0 | **100.0%** | **Completed** (All 6 Merged) |
| **UI/UX Developer** | @AlexGavarra | 5 | 5 | 0 | 0 | **100.0%** | **Completed** (All 5 Merged) |
| **Test Engineer** | @YthanOrogo | 6 | 6 | 0 | 0 | **100.0%** | **Completed** (All 6 Merged) |
| **Scrum Master** | @HeindrichMacalinao | 5 | 3 | 1 (`S2-SM-04`) | 1 (`S2-SM-05`) | **80.0% active** (60% merged) | **On Track** (Leading closeout) |
| **Team Total** | **All 5 Roles** | **30** | **28** | **1** | **1** | **96.7% Active** (93.3% Merged) | **Ahead of Schedule** |

```
Sprint 2 Role Completion Breakdown (Target: 30 PRs)
=====================================================
Developer     (8/8)  [████████████████████████████████] 100% (Merged)
DevSecOps     (6/6)  [████████████████████████████████] 100% (Merged)
UI/UX Dev     (5/5)  [████████████████████████████████] 100% (Merged)
Tester        (6/6)  [████████████████████████████████] 100% (Merged)
Scrum Master  (4/5)  [█████████████████████████░░░░░░░]  80% (3 Merged, 1 Active)
-----------------------------------------------------
Sprint Total (29/30) [███████████████████████████████░]  96.7% Progress
```

---

## 3. Team Progress Toward the 60 Merged PR Milestone

The midterm course milestone requires the delivery and merge of **60 planned pull requests** across Sprint 1 and Sprint 2.

### Cumulative Milestone Progress Matrix

| Milestone Component | Target PRs | Merged PRs | Active / Staged PRs | Remaining to Milestone | % Completed |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Sprint 1 Planned Tasks** | 30 | 30 | 0 | 0 | 100.0% |
| **Sprint 2 Planned Tasks** | 30 | 28 | 1 (`S2-SM-04`) | 1 (`S2-SM-05`) | 96.7% |
| **Combined Core Milestone** | **60** | **58** | **1** | **1** | **96.7% (98.3% w/ S2-SM-04)** |
| *Sprint 1 Architecture Refactoring & Hotfixes* | *N/A* | *11* | *0* | *0* | *Bonus Technical Debt* |
| *Sprint 2 Security & Schema Patches* | *N/A* | *14* | *0* | *0* | *Bonus Technical Debt* |
| **Repository Lifetime Merged PRs** | **Total Merged** | **83** | **1** | **—** | **138.3% of 60 Target** |

### Milestone Analysis:
1. **Target Milestone Integrity:** Core sprint task tracking rigorously maps 1-to-1 against the initial 30 sprint issue definitions (`S1-SM-01`..`S1-SM-05`, `S1-DEV-01`..`S1-DEV-08`, etc. in Sprint 1, and `S2-SM-01`..`S2-SM-05`, `S2-DEV-01`..`S2-DEV-08`, etc. in Sprint 2).
2. **Current Trajectory:** Upon merging `S2-SM-04`, the team reaches **59 out of 60 planned milestone PRs (98.3%)**.
3. **Sprint 2 Closeout Milestone:** The single remaining pull request (`S2-SM-05`: Sprint 2 Review & Retrospective Report) will be authored, reviewed, and merged on Day 10 following the live demonstration, successfully sealing the 60/60 milestone.

---

## 4. Comprehensive Sprint 2 Task-by-Task Burndown Inventory

The following table provides the comprehensive lifecycle tracking of all **30 planned Sprint 2 tasks** (Issues #95 to #124), including assigned role, delivery pull request, merged commit SHA, delivery date, and verification artifacts.

| Task ID | Issue # | Role | Planned Day | Actual Merged Day | Delivery PR # | Merge Commit | Deliverable Artifact / Core Contribution | Status |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :--- | :---: |
| **S2-SM-01** | #95 | Scrum Master | Day 1 | Day 1 | #125 | `07e8feb` | `docs/sprints/SPRINT_2_TASK_ORDER.md` (Wave architecture & task flow) | **Merged** |
| **S2-DBA-01** | #100 | DevSecOps | Day 2 | Day 3 | #141 | `9a6e2b7` | `migrations/006_active_customer_product_views.sql` (`v_active_customer`, `v_active_product`) | **Merged** |
| **S2-UIX-01** | #106 | UI/UX Dev | Day 2 | Day 3 | #146 | `e4e681b` | `docs/ui/wireframes-customers.md` (Figures 9–10 Customer management wireframes) | **Merged** |
| **S2-SM-02** | #96 | Scrum Master | Day 3 | Day 3 | #145 | `c3829a8` | `docs/sprints/sprint-2-retro-followup.md` (Sprint 1 retro audit & ownership rules) | **Merged** |
| **S2-DEV-01** | #111 | Backend Dev | Day 2 | Day 1 | #128 | `1bc273e` | `src/app/api/customers/route.ts` (`GET /api/customers` live search & role filter) | **Merged** |
| **S2-DEV-02** | #112 | Backend Dev | Day 3 | Day 3 | #144 | `f297c4e` | `src/app/api/customers/[custNo]/route.ts` (`POST`, `PUT` with validation & `stamp`) | **Merged** |
| **S2-UIX-02** | #107 | UI/UX Dev | Day 3 | Day 4 | #147 | `3987012` | `docs/ui/wireframes-products.md` (Figures 11–14 Product & price modal wireframes) | **Merged** |
| **S2-DEV-03** | #113 | Backend Dev | Day 4 | Day 4 | #148 | `6b6a4ff` | `src/app/api/customers/[custNo]/route.ts` (`DELETE` soft-delete, `PUT .../restore`) | **Merged** |
| **S2-DBA-02** | #101 | DevSecOps | Day 4 | Day 3 | #142 | `4529aab` | `scripts/queries/current_price.sql` (Parameterized effective-date price logic) | **Merged** |
| **S2-TST-01** | #119 | Test Engineer | Day 3 | Day 8 | #163 | `d01c229` | `docs/testing/results/customer-test-results.md` (Customer acceptance suite) | **Merged** |
| **S2-SM-03** | #97 | Scrum Master | Day 5 | Day 5 | #149 | `463389f` | `docs/sprints/sprint-2-mid-check.md` (Day 5 mid-check notes & impediment triage) | **Merged** |
| **S2-DBA-03** | #102 | DevSecOps | Day 5 | Day 3 | #143 | `e65386a` | `migrations/007_validation_constraints.sql` (`payTerms` & `unit` check constraints) | **Merged** |
| **S2-UIX-03** | #108 | UI/UX Dev | Day 5 | Day 5 | #150 | `384bbb1` | `src/components/CustomerManagement.tsx` (Live customer CRUD UI with status tabs) | **Merged** |
| **S2-DEV-04** | #114 | Backend Dev | Day 5 | Day 6 | #152 | `cabd8ee` | `src/app/api/products/route.ts` (`GET /api/products` with dynamic current price) | **Merged** |
| **S2-DEV-05** | #115 | Backend Dev | Day 6 | Day 7 | #154 | `067cd30` | `src/app/api/products/[prodCode]/route.ts` (`POST`, `PUT` with unit check & `stamp`) | **Merged** |
| **S2-DEV-06** | #116 | Backend Dev | Day 7 | Day 7 | #158 | `6690673` | `src/app/api/products/[prodCode]/restore/route.ts` (`DELETE`, `PUT restore`) | **Merged** |
| **S2-DEV-07** | #117 | Backend Dev | Day 8 | Day 7 | #159 | `a73f1c8` | `src/app/api/products/[prodCode]/prices/route.ts` (Price history CRUD & ordering) | **Merged** |
| **S2-DBA-04** | #103 | DevSecOps | Day 6 | Day 6 | #153 | `79b178e` | `db/verify/verify_customer_product_restrict.sql` (Child-record delete restriction) | **Merged** |
| **S2-DBA-05** | #104 | DevSecOps | Day 7 | Day 7 | #155 | `24234d0` | `scripts/migrate/seed_sprint2_demo_data.sql` (Demo records C-001..005, P-001..005) | **Merged** |
| **S2-UIX-04** | #109 | UI/UX Dev | Day 7 | Day 7 | #156 | `3222a79` | `src/components/ProductManagement.tsx`, `PriceHistoryModal.tsx` (Live Product UI) | **Merged** |
| **S2-SM-04** | #98 | Scrum Master | Day 8 | Day 8 | #169 | *(Active)* | `docs/sprints/sprint-2-velocity.md` (Velocity tracking & burndown audit) | **Active** |
| **S2-TST-02** | #120 | Test Engineer | Day 5 | Day 8 | #164 | `aead061` | `docs/testing/results/product-price-test-results.md` (Price effective date suite) | **Merged** |
| **S2-TST-03** | #121 | Test Engineer | Day 7 | Day 8 | #165 | `15bfd21` | `docs/testing/results/soft-delete-restore-results.md` (Soft-delete & restore tests) | **Merged** |
| **S2-DEV-08** | #118 | Backend Dev | Day 9 | Day 7 | #160 | `f756ca7` | `src/services/productService.js` (Route guards for all 9 Customer/Product rights) | **Merged** |
| **S2-DBA-06** | #105 | DevSecOps | Day 9 | Day 7 | #161 | `7a08f2a` | `docs/database/sprint-2-performance.md` (Index tuning & query EXPLAIN profiling) | **Merged** |
| **S2-TST-04** | #122 | Test Engineer | Day 8 | Day 8 | #166 | `64548f6` | `docs/testing/customer-product-permission-matrix.md` (9-Rights 403 matrix suite) | **Merged** |
| **S2-UIX-05** | #110 | UI/UX Dev | Day 9 | Day 7 | #162 | `a526ef6` | `docs/ui/sprint-2-usability-audit.md` (Usability audit against Figures 9–14) | **Merged** |
| **S2-TST-05** | #123 | Test Engineer | Day 9 | Day 8 | #167 | `93c67a3` | `docs/testing/sprint-2-regression.md` (Sprint 1 auth & user mgmt regression suite) | **Merged** |
| **S2-TST-06** | #124 | Test Engineer | Day 9 | Day 8 | #168 | `503f808` | `docs/testing/sprint-2-signoff.md` (Sprint 2 QA sign-off & defect triage report) | **Merged** |
| **S2-SM-05** | #99 | Scrum Master | Day 10 | Day 10 | Scheduled | *(Pending)* | `docs/sprints/sprint-2-retrospective.md` (Sprint 2 Review & Retrospective closeout) | Scheduled |

---

## 5. Burndown Curve & Velocity Trajectory Analysis

### Ideal vs. Actual Task Burndown

In Sprint 2, the team planned a linear burn rate of **3.0 tasks completed per working day** across the 10-day sprint cycle (30 tasks / 10 days).

```
Sprint 2 Task Burndown Curve (Remaining Tasks vs. Working Days)
========================================================================================
Tasks |
Remaining
  30  |  * (Ideal Day 0: 30)
      |   \
  27  |    \     * (Actual Day 1: 28 remaining - S2-SM-01, S2-DEV-01)
  24  |     \     \
  21  |      \     * (Actual Day 3: 23 remaining - S2-DBA-01..03, S2-UIX-01, S2-SM-02, S2-DEV-02)
  18  |       \     \
  15  |  Ideal \     * (Actual Day 5: 20 remaining - S2-DEV-03, S2-UIX-02, S2-SM-03, S2-UIX-03)
  12  |         \     \
   9  |          \     \  <-- Rapid Velocity Acceleration Surge (Days 6–8)
   6  |           \     \
   3  |            \     \
   1  |             \     * (Actual Day 8: 1 remaining task [S2-SM-05]!)
   0  |--------------\-----\------------------------------------------------------------
      | D0  D1  D2  D3  D4  D5  D6  D7  D8  D9  D10
```

### Burndown Progression Data Table

| Sprint Day | Date | Ideal Remaining | Actual Remaining | Tasks Merged On Day | Key Deliverables Merged | Velocity (Tasks/Day) |
| :---: | :---: | :---: | :---: | :---: | :--- | :---: |
| **Day 0** | Nov 12 (AM) | 30 | 30 | 0 | Sprint Kickoff | — |
| **Day 1** | Nov 12 (PM) | 27 | 28 | 2 | `S2-SM-01` (#125), `S2-DEV-01` (#128) | 2.0 |
| **Day 2** | Nov 13 | 24 | 28 | 0 | Branch staging; active views & auth fixes | 0.0 |
| **Day 3** | Nov 17 | 21 | 23 | 5 | `S2-DBA-01` (#141), `S2-DBA-02` (#142), `S2-DBA-03` (#143), `S2-DEV-02` (#144), `S2-SM-02` (#145), `S2-UIX-01` (#146) | 5.0 |
| **Day 4** | Nov 18 (AM) | 18 | 21 | 2 | `S2-UIX-02` (#147), `S2-DEV-03` (#148) | 2.0 |
| **Day 5** | Nov 18 (PM) | 15 | 20 | 2 | `S2-SM-03` (#149), `S2-UIX-03` (#150) *(Mid-Check Point: 10 Merged)* | 2.0 |
| **Day 6** | Nov 19 | 12 | 18 | 2 | `S2-DEV-04` (#152), `S2-DBA-04` (#153 Wave 4) | 2.0 |
| **Day 7** | Nov 20 (AM) | 9 | 9 | 9 | `S2-DEV-05` (#154), `S2-DBA-05` (#155), `S2-UIX-04` (#156), `S2-DEV-06` (#158), `S2-DEV-07` (#159), `S2-DEV-08` (#160), `S2-DBA-06` (#161), `S2-UIX-05` (#162) | **9.0 (Surge)** |
| **Day 8** | Nov 20 (PM) | 6 | 1 | 8 | `S2-TST-01` (#163), `S2-TST-02` (#164), `S2-TST-03` (#165), `S2-TST-04` (#166), `S2-TST-05` (#167), `S2-TST-06` (#168), `S2-SM-04` (#169 active) | **8.0 (Surge)** |
| **Day 9** | Nov 23 | 3 | 1 | 0 | Sprint Demo Rehearsal & Documentation Finalization | — |
| **Day 10** | Nov 26 | 0 | 0 | 1 | `S2-SM-05` (Sprint Review, Retrospective & Sign-off) | 1.0 (Planned) |

---

## 6. Burndown Analysis: Week 4 Deliverables Feasibility & Schedule

### Evaluation of Week 4 Technical Workstreams
Week 4 was scheduled to deliver the most complex modules of Sprint 2:
1. **Product CRUD & Packaging Unit Validation (`S2-DEV-04`, `S2-DEV-05`, `S2-DBA-03`):**
   - *Status:* **100% Merged & Verified.**
   - *Architecture Proof:* Implemented in `src/app/api/products/route.ts` and `src/app/api/products/[prodCode]/route.ts`. Validates allowable packaging units against `unit IN ('CASE', 'BOX', 'PIECE', 'PACK', 'CARTON')`. Auto-generates `stamp` audit timestamps and user IDs.
2. **Chronological Price History Management (`S2-DEV-07`, `S2-DBA-02`, `S2-UIX-04`):**
   - *Status:* **100% Merged & Verified.**
   - *Architecture Proof:* Implemented in `src/app/api/products/[prodCode]/prices/route.ts` and `src/components/PriceHistoryModal.tsx`. Ensures prices are chronologically ordered by `effDate DESC`, prevents duplicate effective dates, and calculates dynamic current prices accurately as of any target query date using the `idx_pricehist_prodcode_effdate_status` covering index.
3. **Product Soft Delete, Admin Restore & Delete Restrict Integrity (`S2-DEV-06`, `S2-DBA-04`, `S2-TST-03`):**
   - *Status:* **100% Merged & Verified.**
   - *Architecture Proof:* Soft delete sets `status = 'Inactive'` and updates `stamp`. Hard delete is explicitly prevented on parent products or customers with related child records (`PRICEHIST`, `SALES_HEADER`, `SALES_ITEM`), validated in `db/verify/verify_customer_product_restrict.sql` and `tests/product-delete-restore.test.js`.
4. **Enforcement of All 9 Customer & Product Per-Action Rights (`S2-DEV-08`, `S2-TST-04`):**
   - *Status:* **100% Merged & Verified.**
   - *Architecture Proof:* Enforced on both server-side middleware (`src/services/productService.js`, `src/middleware/authMiddleware.js`) and UI components (`CustomerManagement.tsx`, `ProductManagement.tsx`). Standard users without `CUSTOMER_DELETE`, `PRODUCT_UPDATE`, or `PRODUCT_PRICE_HISTORY` are returned `HTTP 403 Forbidden` and action buttons are conditionally disabled/hidden in the interface.
5. **Quality Assurance & Sign-off (`S2-TST-01`..`S2-TST-06`):**
   - *Status:* **100% Merged.**
   - *Architecture Proof:* Test suites in `tests/` cover customer acceptance, product pricing logic, soft delete restore dependencies, 9-rights permission matrix, and full Sprint 1 regression. Formal QA Sign-off report published in `docs/testing/sprint-2-signoff.md`.

### Mid-Sprint Impediment Resolution Audit
All 4 critical impediments logged during the Day 5 check-in were decisively resolved during Days 6–8:
- **IMP-01 (Test Engineer Workstation Hardware Failure):** Resolved. The test environment was stabilized; all 6 planned test suites (`S2-TST-01` through `S2-TST-06`) were successfully executed, reviewed, and merged in PRs #163–#168.
- **IMP-02 (Scope Gap: Missing Live CRUD UI):** Resolved. Alex Gavarra (@AlexGavarra) delivered production-grade, interactive React components for both Customer Management (`CustomerManagement.tsx` in PR #150) and Product Management with Price History (`ProductManagement.tsx` & `PriceHistoryModal.tsx` in PR #156), fully integrated into the enterprise dashboard (`src/app/dashboard/page.tsx`).
- **IMP-03 (Supabase Schema Column Drift & Auth Sync):** Resolved. Chrollofuru (@Chrollofuru) and Heindrich Macalinao (@HeindrichMacalinao) applied migrations #151, #153, and #155, unifying schema column definitions (`createdAt`, `status`, `stamp`) across both local SQLite and remote Supabase PostgreSQL.
- **IMP-04 (Wave Dependency Serialization):** Resolved. Strict file ownership and wave-based branch checkpoints prevented merge conflicts. All Wave 4, 5, 6, 7, and 8 pull requests were integrated with 0 merge conflicts.

---

## 7. Sprint 2 Velocity Metrics Summary

| Velocity Metric | Planned Target | Actual Value (Day 8) | Assessment / Commentary |
| :--- | :---: | :---: | :--- |
| **Planned PRs / Day** | 3.0 PRs/day | **3.6 PRs/day (avg)** | Team sustained a 20% higher velocity than required across 8 days. |
| **Peak Daily Velocity** | 5.0 PRs/day | **9.0 PRs/day** | Achieved on Day 7 during the Wave 5 / Wave 6 integration surge. |
| **Defect Triage Closure Rate** | 100% | **100.0% (24/24)** | Zero Critical or High severity bugs open across issues #100–#123. |
| **Wave Integration Success** | 100% | **100.0% (8/8 Waves)** | Waves 1 through 8 merged cleanly into `main` with zero unresolved merge conflicts. |
| **PR Acceptance Rate** | 95% | **97.6% (83/85 total)** | Only 2 exploratory/reverted PRs out of 85 lifetime submissions. |
| **Sprint Quota Completion** | 100% (Day 10) | **96.7% (Day 8)** | 29/30 tasks ready 2 days ahead of the Sprint 2 Review deadline. |

---

## 8. Scrum Master Recommendations Leading into Days 9–10

1. **Sprint Review Demonstration Rehearsal (Day 9):**
   - Conduct a live run-through of the end-to-end evaluation flow:
     - Log in as `Superadmin` -> view Customer & Product management screens.
     - Demonstrate Customer live search, creation, editing, soft deletion (`status = 'Inactive'`), and admin restore.
     - Demonstrate Product price modal: show chronological effective dates, adding a future effective price, and dynamic calculation as of different target dates.
     - Switch role to `User` -> confirm buttons for Add/Edit/Delete are disabled and direct API access returns `HTTP 403 Forbidden`.
2. **Environment & Regression Verification:**
   - Execute the test regression suite (`npm test`, `npm run test:customer`, `npm run test:product`) in CI and clean execution environments to ensure tests pass without dependency warnings.
3. **Execution of Task `S2-SM-05` (Day 10):**
   - Convene the formal Sprint 2 Review & Retrospective on Day 10 (Nov 26, 2026).
   - Document team achievements, student guide compliance (§1.1–§4.3), velocity retrospection, and carryover considerations for Sprint 3 (HR, Payroll & Sales modules).

---

## 9. Formal Scrum Master Sign-Off

I hereby certify that this velocity report and burndown audit accurately represents the state of Hope, Inc. ERP at the conclusion of Sprint 2, Day 8. With 28 tasks merged, 1 task active (`S2-SM-04`), and 1 task scheduled for sprint closeout (`S2-SM-05`), the team has achieved an outstanding **96.7% completion rate** and is fully prepared to deliver the completed Customer, Product, and Price History modules at the Sprint 2 Review.

| Role | Name | GitHub Handle | Signature / Status | Date |
| :--- | :--- | :--- | :---: | :---: |
| **Scrum Master** | Heindrich Himmler Macalinao | @HeindrichMacalinao | **APPROVED & SUBMITTED** | November 20, 2026 |
