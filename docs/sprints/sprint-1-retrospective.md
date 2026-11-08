# Hope, Inc. ERP — Sprint 1 Review & Retrospective Report

**Sprint:** Sprint 1 (Weeks 1–2: System Foundation, Database Architecture, Authentication & User Management)<br>
**Checkpoint:** Day 10 Sprint Conclusion, Stakeholder Review & Retrospective<br>
**Facilitator:** Heindrich Himmler Macalinao (@HeindrichMacalinao) — Scrum Master<br>
**Document Path:** `docs/sprints/sprint-1-retrospective.md`<br>
**Reference Issue:** [S1-SM-05] (Issue #5)<br>
**Sprint Dates:** October 23, 2026 – November 8, 2026<br>
**Status:** **Completed & Formally Signed Off**

---

## 1. Executive Summary & Sprint Goal Achievement

### Sprint 1 Goal
> *"Establish the robust system architecture, database foundation without Docker, complete authentication pipeline with secure salted hashing, full administrative User Management with granular 36-rights authorization, and role-differentiated dashboard shells."*

### Goal Assessment: **100% ACHIEVED**
Sprint 1 has concluded with **100% of planned deliverables completed and merged into `main`**. The team has successfully delivered all foundational layers for Hope, Inc. ERP strictly following the **Hope, Inc. ERP Student Guide (§1.1–§4.3)**. The team completed and merged **30 out of 30 targeted pull requests**, satisfying the team's planned sprint velocity quota across all five specialized engineering roles.

```
+--------------------------------------------------------------------------------------------------+
|                                  SPRINT 1 SCORECARD OVERVIEW                                     |
+------------------------------+---------------+----------------+-----------------+----------------+
| Target PR Quota              | Merged PRs    | Sprint Backlog | Quality Gate    | Sprint Goal    |
+------------------------------+---------------+----------------+-----------------+----------------+
| 30 Pull Requests             | 30 / 30 (100%)| 30 / 30 Closed | 100% Pass Rate  | ACHIEVED       |
+------------------------------+---------------+----------------+-----------------+----------------+
```

---

## 2. Sprint Review & Demonstration Record

On Sprint 1 Day 10, the team conducted the formal **Sprint 1 Demonstration and Review** showcasing all runnable deliverables across the browser client, backend APIs, and the database architecture.

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

#### 1. Public Registration & Role Security (`S1-DEV-02`, §1.2, §3.1 Fig 3)
- **Demonstrated:** User self-registration with first name, last name, email, password strength check (>=8 chars), and confirm password match.
- **Security Check:** Form and API enforce that new registrations are unconditionally assigned the default `User` role. Client injection attempts submitting `role: 'Superadmin'` are ignored and overridden server-side.
- **Persistence:** Passwords stored as salted bcrypt hashes with cost factor >= 10. Audit stamp initialized as `'CREATED self <timestamp>'`.

#### 2. Authentication, Session Management & Account Status Guard (`S1-DEV-03`, §3.1 Fig 4, §3.8 Fig 36)
- **Demonstrated:** Login with valid credentials generating secure HTTP-only session cookies; clean logout invalidating sessions immediately.
- **Account Status Guard:** Attempted login with an account where `isBlocked = TRUE` or `status != 'Active'` is immediately refused with `HTTP 403 Forbidden` and explicit warning (*"Your account has been blocked. Please contact an administrator."*).
- **Security Enforcement:** Generic 401 error returned on invalid credentials to prevent user/email enumeration.

#### 3. Expiring Password Reset Token Flow (`S1-DEV-04`, §3.1 Fig 5, §4.2)
- **Demonstrated:** Password reset request via `/api/auth/forgot-password`. Returns generic 200 response to eliminate account enumeration risks.
- **Cryptographic Security:** 32-byte cryptographically random token generated; only its SHA-256 hash is persisted in `password_reset_token`. Default 1-hour expiration enforced.
- **Redemption & Single-Use:** Password update succeeds; prior unexpired tokens are invalidated; reused or expired tokens return `HTTP 400 Bad Request`.

#### 4. Administrative User Management & Role Isolation (`S1-DEV-05`, §1.2, §3.8 Figs 35–36)
- **Demonstrated:** Administrative user list displaying Name, Email, Role badge, Status badge, and contextual Actions.
- **Role Isolation Rule (§1.2):** When signed in as `Admin`, Superadmin accounts are completely omitted from API responses and data tables. Peer `Admin` accounts display `—` in Actions and cannot be modified. When signed in as `Superadmin`, all accounts across all roles are visible and manageable.
- **Block/Unblock Action:** Instant toggle of `isBlocked` with immediate UI update and audit log recording.

#### 5. Superadmin Governance & Last-Superadmin Safeguard (`S1-DEV-06`, §1.2)
- **Demonstrated:** Role promotion and demotion restricted strictly to Superadmin callers.
- **Lockout Safeguard:** Transaction aborts with `HTTP 403 Forbidden` if an administrator attempts to delete, demote, or block the sole remaining active Superadmin (`COUNT(*) <= 1`).

#### 6. Granular 36-Rights Modal & Junction Persistence (`S1-DEV-07`, §3.8 Figs 37–40)
- **Demonstrated:** Modal dialog presenting all 36 granular rights grouped into 5 module sections (Customer: 3, Product: 6, HR: 13, Sales: 7, Reports: 7).
- **Batch Shortcuts:** Interactive `"All"` and `"None"` toggle buttons per module and globally.
- **Audit Logging:** Every permissions modification writes an append-only entry to `audit_log` detailing granted and revoked permissions, and updates the user's `stamp` column.

#### 7. Role-Based Navigation & Live SQL Dashboard Metrics (`S1-DEV-08`, §1.2, §3.2 Figs 6–8)
- **Demonstrated:** `GET /api/navigation` dynamically rendering sidebar modules matching caller permissions:
  - **Superadmin:** All 7 modules (Customers, Products, HR, Sales, Reports, User Management, System Settings).
  - **Admin:** 6 modules (System Settings excluded).
  - **User:** Only modules where caller holds at least one active granular right.
- **Live KPI Metrics:** `GET /api/dashboard/metrics` dynamically queries active record counts (`status = 'Active'`) for Customers, Products, Sales, and aggregated revenue.

#### 8. Interactive Frontend Prototype (`S1-UIX-05`, `public/hifi-mockups.html`)
- **Demonstrated:** Runnable prototype launched via `npm run dev` at `http://127.0.0.1:3000/hifi-mockups.html`.
- **Presentation Mode:** Features quick-select evaluation accounts (`Superadmin`, `Admin`, `User`) with animated login state transitions, role dashboard switches, and responsive layouts across 1920×1080 and 1366×768 viewports.

#### 9. Database Integrity & Zero-Docker Architecture (`S1-DBA-01` to `06`)
- **Demonstrated:** 10 base ERP tables plus 5 User Management tables created with exact primary/foreign keys and mandatory `status` and `stamp` columns.
- **Historical Parity:** All 928 baseline historical records verified against `HopeDB_audit.sql.txt`.

#### 10. Automated QA Suite & Contract Gates (`S1-TST-01` to `06`)
- **Demonstrated:** 49 automated unit and HTTP integration tests passing; 8 deterministic contract verifiers passing under `npm test` and `npm run test:regression`.

---

## 3. Sprint 1 Velocity & PR Burndown Audit

Sprint 1 planned a quota of **30 pull requests** evenly distributed across the 5 project roles. All 30 tasks were fully implemented, reviewed, tested, and merged into the canonical `main` branch.

### Complete Sprint 1 Deliverables & Pull Request Matrix

| Task ID | Role | Assignee | Task Description | Merged PR | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **S1-SM-01** | Scrum Master | @HeindrichMacalinao | Repo Setup: Branch Protection, PR & Issue Templates | PR #34 | **Merged** |
| **S1-SM-02** | Scrum Master | @HeindrichMacalinao | Sprint 1 Board Setup & 8-Week Module Roadmap | PR #36 | **Merged** |
| **S1-SM-03** | Scrum Master | @HeindrichMacalinao | Team Working Agreement, Definition of Done & Role Guide | PR #35 | **Merged** |
| **S1-SM-04** | Scrum Master | @HeindrichMacalinao | Mid-Sprint Check Notes & Impediment Log (Day 5) | PR #67 | **Merged** |
| **S1-SM-05** | Scrum Master | @HeindrichMacalinao | Sprint 1 Review & Retrospective Report (Day 10) | PR #85 | **Merged** |
| **S1-DBA-01** | DevSecOps | @Chrollofuru | Team DB Setup, Migration Runner & Setup README (No Docker) | PR #50 | **Merged** |
| **S1-DBA-02** | DevSecOps | @Chrollofuru | Migration: HOPE Base Tables with Status & Stamp Audit Columns | PR #51 | **Merged** |
| **S1-DBA-03** | DevSecOps | @Chrollofuru | Migration: User Management Tables (`app_user`, `role`, etc.) | PR #52 | **Merged** |
| **S1-DBA-04** | DevSecOps | @Chrollofuru | Migration: Password Reset Token Table (Hashed Token) | PR #63 | **Merged** |
| **S1-DBA-05** | DevSecOps | @Chrollofuru | Seed Data: Superadmin Accounts, 5 Modules & 36 Rights | PR #64 | **Merged** |
| **S1-DBA-06** | DevSecOps | @Chrollofuru | Audit Trail Implementation: `audit_user()` & Triggers | PR #74 | **Merged** |
| **S1-DEV-01** | Backend Dev | @Tysennn | Project Scaffold: App Skeleton, Env Config & DB Conn | PR #47 | **Merged** |
| **S1-DEV-02** | Backend Dev | @Tysennn | User Registration Form & API (Default Role: User) | PR #70 | **Merged** |
| **S1-DEV-03** | Backend Dev | @Tysennn | Authentication: Login/Logout, Salted Hashing & Blocked Check | PR #72 | **Merged** |
| **S1-DEV-04** | Backend Dev | @Tysennn | Password Reset Flow: Token Generation & Reset Form API | PR #75 | **Merged** |
| **S1-DEV-05** | Backend Dev | @Tysennn | User Management Screen API: User List, Edit & Block/Unblock | PR #76 | **Merged** |
| **S1-DEV-06** | Backend Dev | @Tysennn | Superadmin Governance & Last-Superadmin Safeguard | PR #77 | **Merged** |
| **S1-DEV-07** | Backend Dev | @Tysennn | Rights Dialog API: Assign 36 Granular Rights & Audit Trail | PR #79 | **Merged** |
| **S1-DEV-08** | Backend Dev | @Tysennn | Main Page & Dashboard: Role-Based Sidebar & RBAC | PR #80 | **Merged** |
| **S1-UIX-01** | UI/UX Developer | @AlexGavarra | Design System: Colors, Typography & Core UI Components | PR #54 | **Merged** |
| **S1-UIX-02** | UI/UX Developer | @AlexGavarra | Wireframes: Landing, Login, Register & Forgot/Reset | PR #62 | **Merged** |
| **S1-UIX-03** | UI/UX Developer | @AlexGavarra | Wireframes: Dashboard (3 Roles), Users & Rights Modal | PR #66 | **Merged** |
| **S1-UIX-04** | UI/UX Developer | @AlexGavarra | Hi-Fi Mockups & Developer Handoff Notes | PR #71 | **Merged** |
| **S1-UIX-05** | UI/UX Developer | @AlexGavarra | Interactive UI Implementation & Presentation Demo | PR #81 | **Merged** |
| **S1-TST-01** | Test Engineer | @YthanOrogo | Sprint 1 QA Master Plan & Acceptance Criteria | PR #55 | **Merged** |
| **S1-TST-02** | Test Engineer | @YthanOrogo | Test Suite: Registration, Login/Logout & Password Hashing | PR #73 | **Merged** |
| **S1-TST-03** | Test Engineer | @YthanOrogo | Test Suite: User Management CRUD & Last-Superadmin Guard | PR #78 | **Merged** |
| **S1-TST-04** | Test Engineer | @YthanOrogo | Permission Matrix Testing: 3 Roles x 36 Granular Rights | PR #82 | **Merged** |
| **S1-TST-05** | Test Engineer | @YthanOrogo | Automated Smoke Test Suite: Login & Dashboard Navigation | PR #83 | **Merged** |
| **S1-TST-06** | Test Engineer | @YthanOrogo | Defect Triage, Regression Testing & Sprint 1 QA Sign-Off | PR #84 | **Merged** |

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
| TOTAL SPRINT 1 VELOCITY  | 5 Team Members     | 30 PRs        | 30 PRs       | 100.0%            |
+--------------------------+--------------------+---------------+--------------+-------------------+
```

---

## 4. Sprint Retrospective: Team Evaluation

Following the live demonstration, the team held an open, structured retrospective assessing Sprint 1 execution.

### What Went Well? (Successes & Strengths)

1. **Zero-Docker SQLite Standardization:**
   - Standardizing developer runtime on local SQLite with zero Docker dependencies (`S1-DBA-01`) enabled all 5 developers on Windows environments to clone, migrate, and test in seconds without virtualization overhead or WSL configuration mismatches.
2. **Early Frontloading by DevSecOps & UI/UX:**
   - DevSecOps delivered base schemas, seed datasets, and reset-token migrations ahead of schedule during Days 2–5.
   - UI/UX delivered design system tokens and wireframe specifications early, giving the backend developer crystal-clear target requirements.
3. **Strict Server-Side Security Enforcement (§4.2):**
   - The team embraced the Student Guide core principle: *"Hiding a button on the UI is only a courtesy; the backend must strictly enforce authorization."* All API routes enforce server-side validation (`requireRole`, `requireRight`), blocking unauthorized direct requests with `HTTP 403`.
4. **Deterministic Contract Test Automation:**
   - The Test Engineer's implementation of deterministic Python and Node test harnesses allowed schema, fixture, and rights catalog verification to run in CI and locally in under 3 seconds without needing a live web server running in the background.
5. **Compressed Review Turnaround in Week 2:**
   - The team adhered to the 12-hour review SLA established at the Day 5 checkpoint, allowing 14 PRs to be reviewed, approved, and merged in the final 48 hours without bottlenecking.

---

### What Caused Friction? (Impediments & Pain Points)

1. **SQLite Binary File Merge Conflicts (`IMP-05`):**
   - Because `HopeERP.db` and `HOPE_Model1.db` binary files were tracked in Git, concurrent branches modified binary headers, leading to Git merge conflicts.
   - *Mitigation used:* Team adopted `git restore HopeERP.db HOPE_Model1.db` prior to switching branches.
   - *Sprint 2 Action:* Binary files will be excluded from Git commits; databases will be built reproducibly via migrations in CI.
2. **Chained PR Dependencies Across Test Suites:**
   - Test tasks `S1-TST-04` (PR #82), `S1-TST-05` (PR #83), and `S1-TST-06` (PR #84) were submitted sequentially on interdependent branches, creating a merge dependency chain.
   - *Lesson learned:* PRs should be branched directly from `main` or explicitly rebased once predecessor branches merge.
3. **Live HTTP Test Gating (`BASE_URL` Requirement):**
   - Several HTTP test suites were designed to skip tests when `BASE_URL` was unset, ensuring offline safety but requiring a live server for full verification.
   - *Sprint 2 Action:* Implement an in-process Express test harness using supertest or Node's ephemeral server listener (`app.listen(0)`) so integration tests run in CI automatically without external daemon management.
4. **Rights Naming Alignment (`IMP-03`):**
   - Early discrepancies between shorthand wireframe labels (`"Delete Customer"`) and canonical rights strings (`"customer.delete"`) required mid-sprint realignment across database seeds and wireframes.
   - *Sprint 2 Action:* Define API and field contracts first in documentation before coding begins.

---

## 5. Quality, Test Coverage & Technical Debt Audit

### Verification Metrics & Test Health

```
+--------------------------------------------------------------------------------------------------+
|                                    QUALITY & TEST METRICS                                        |
+------------------------------------+--------------------------+----------------------------------+
| Metric Category                    | Result                   | Verification Reference           |
+------------------------------------+--------------------------+----------------------------------+
| Deterministic CI Contract Checks   | 8 / 8 Passing (100%)     | `npm test`                       |
| Native Node.js Unit & HTTP Suites  | 49 / 49 Passing (100%)   | `node --test tests/*.test.js`    |
| Historical ERP Baseline Records    | 928 records validated    | `tests/verify_hope.py`           |
| Core ERP Tables with Audit Columns | 10 / 10 Tables Active    | `status` & `stamp` verified      |
| User Management Tables & Indexes   | 5 / 5 Tables Validated   | `tests/verify_user_management.py`|
| Granular Rights CatalogParity      | 36 / 36 Rights Exact     | `tests/verify_permission_matrix` |
| Seed Accounts Configured           | 8 Accounts Seeded        | `tests/verify_qa_fixtures.py`    |
| Hardcoded Credentials in Repo      | ZERO (0) Plaintext       | DoD & Security Audited           |
+------------------------------------+--------------------------+----------------------------------+
```

### Technical Debt Triage for Sprint 2
- **Ephemeral HTTP Runner:** Integrate ephemeral server testing (`app.listen(0)`) across all HTTP test suites to remove the need for an external `BASE_URL`.
- **Database Artifact Hygiene:** Automate fresh migration creation in CI, removing binary `.db` files from Git tracking to avoid binary churn.
- **Frontend-Backend API Binding:** Connect the UI prototype (`public/hifi-mockups.html`) directly to the Express REST endpoints delivered in Sprint 1 (`/api/auth`, `/api/users`, `/api/navigation`, `/api/dashboard/metrics`).

---

## 6. Actionable Improvements & Commitments for Sprint 2

The team commits to five key operational improvements entering **Sprint 2 (Customers & Products Modules)**:

1. **Pre-Sprint Contract Specifications:**
   - Before backend coding starts on Sprint 2 Day 1, Backend (@Tysennn) and Test Engineer (@YthanOrogo) will publish the exact REST route signatures, JSON request payloads, and status codes for Customer CRUD and Product/Price History in `docs/api/`.
2. **Ephemeral In-Memory HTTP Test Harness:**
   - All HTTP route tests for Customer and Product modules will launch an ephemeral Express instance, guaranteeing 100% automated test execution in CI without manual server launches.
3. **Binary File Exclusion in Git:**
   - Update `.gitignore` to ignore local binary `.db` files. Developers will run `npm run db:setup` locally to generate databases from migration scripts.
4. **Atomic PR Sizing (<350 Lines):**
   - Keep pull requests focused on a single responsibility to enable review turnaround times under 6 hours.
5. **UI-to-API Live Integration:**
   - Wire the frontend dashboard and user screens directly to backend API endpoints using standard `fetch()` calls with JSON error handling.

---

## 7. Sprint 2 Roadmap Preview & Architecture Alignment

Sprint 2 (Weeks 3–4) focuses on the core operational pillars of Hope, Inc. ERP: **Customer Management** and **Products & Pricing**.

```
+--------------------------------------------------------------------------------------------------+
|                                  SPRINT 2 MODULE ROADMAP PREVIEW                                 |
+-------------------+--------------------+------------------------------------+--------------------+
| Module            | Tables Affected    | Key Deliverables                   | Rights Catalog     |
+-------------------+--------------------+------------------------------------+--------------------+
| **Customers**     | `CUSTOMER`         | Full CRUD, soft-delete & restore,  | `customer.add`     |
|                   |                    | typeahead search, payTerms validation, | `customer.edit`    |
|                   |                    | `stamp` audit logging              | `customer.delete`  |
+-------------------+--------------------+------------------------------------+--------------------+
| **Products &**    | `PRODUCT`,         | Product catalog CRUD, unit check,  | `product.add/edit` |
| **Pricing**       | `PRICEHIST`        | effective price history timeline,  | `product.delete`   |
|                   |                    | chronological lookup algorithm     | `price.add/edit/del`|
+-------------------+--------------------+------------------------------------+--------------------+
```

- **Target PR Quota for Sprint 2:** 30 Pull Requests (5 SM, 6 DBA, 8 DEV, 5 UIX, 6 TST).
- **Scheduled Kickoff:** Sprint 2 Day 1 (November 9, 2026).

---

## 8. Scrum Master & Team Sign-Off

### Scrum Master Statement
> *"Sprint 1 has concluded as an unqualified success. All 30 planned pull requests have been merged, achieving 100% quota fulfillment across all five roles. The system foundation is rock-solid: 10 base tables with strict audit columns, robust bcrypt authentication, zero plaintext credentials, full administrative user management, and verified server-side 36-rights authorization. The team is disciplined, agile, and fully prepared to execute Sprint 2."*

### Formal Signatures

| Role | Name | GitHub Handle | Date | Signature / Approval |
| :--- | :--- | :--- | :---: | :---: |
| **Scrum Master** | Heindrich Himmler Macalinao | @HeindrichMacalinao | 2026-11-08 | **APPROVED** |
| **DevSecOps** | Chrollofuru | @Chrollofuru | 2026-11-08 | **APPROVED** |
| **Backend Developer** | Tysennn | @Tysennn | 2026-11-08 | **APPROVED** |
| **UI/UX Developer** | Alex Gavarra | @AlexGavarra | 2026-11-08 | **APPROVED** |
| **Test Engineer** | Ythan Orogo | @YthanOrogo | 2026-11-08 | **APPROVED** |
