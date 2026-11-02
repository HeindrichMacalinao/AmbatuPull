# Hope, Inc. ERP — Sprint 1 Mid-Sprint Check Notes & Impediment Log

**Sprint:** Sprint 1 (Weeks 1–2: Foundation, Database Architecture, Authentication & User Management)
**Checkpoint:** Day 5 Mid-Sprint Inspection
**Facilitator:** Heindrich Himmler Macalinao (@HeindrichMacalinao) — Scrum Master
**Document Path:** `docs/sprints/sprint-1-mid-check.md`
**Reference Issue:** [S1-SM-04] (Issue #4)
**Sprint Dates:** October 23, 2026 – November 6, 2026 (Day 5 Checkpoint: October 28 / Early Checkpoint)

---

## 1. Meeting Overview & Attendance

The Mid-Sprint Check-In was convened on Sprint 1 Day 5 to inspect development velocity, evaluate progress against the targeted 30 Pull Requests for Sprint 1, triage existing and emerging impediments, and synchronize inter-role dependencies leading into Week 2 feature delivery.

### Quorum & Role Attendance

| Role | Name | GitHub Handle | Attendance Status |
| :--- | :--- | :--- | :---: |
| **Scrum Master** | Heindrich Himmler Macalinao | @HeindrichMacalinao | Present (Facilitator) |
| **DevSecOps** | Chrollofuru | @Chrollofuru | Present |
| **Backend Developer** | Tysennn | @Tysennn | Present |
| **UI/UX Developer** | Alex Gavarra | @AlexGavarra | Present |
| **Test Engineer** | Ythan Orogo | @YthanOrogo | Present |

*Quorum:* 5/5 roles represented (100% attendance).

---

## 2. Sprint Goal & Week 1 Progress Summary

### Sprint 1 Goal
> *"Establish the robust system architecture, database foundation without Docker, complete authentication pipeline with secure salted hashing, full administrative User Management with granular 36-rights authorization, and role-differentiated dashboard shells."*

### Mid-Sprint Status Overview
At the Day 5 midpoint, the project has established foundational data persistence, UI design systems, wireframe specifications, and QA test fixtures. The team has completed primary Week 1 deliverables across database migrations, design tokens, and core test scaffolding, positioning Week 2 for high-velocity API implementation and end-to-end integration testing.

---

## 3. Burndown & Velocity Analysis (Day 5 Checkpoint)

Sprint 1 encompasses **30 targeted pull requests** distributed across the 5 specialized roles (target average: 6 PRs per role / 30 PRs total across Sprint 1).

### Planned vs. Actual Task Completion Status (Week 1 Focus)

| Task ID | Role | Title | Planned Day | Current Status | Delivery PR / Artifact |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **S1-SM-01** | Scrum Master | Repo Setup: Branch Protection, PR & Issue Templates | Day 1 | **Done** | Merged PR #34 (`docs/GIT_WORKFLOW.md`, templates) |
| **S1-SM-02** | Scrum Master | Sprint 1 Board Setup & 8-Week Module Roadmap | Day 1 | **Done** | Merged PR #36 (`docs/ROADMAP.md`) |
| **S1-SM-03** | Scrum Master | Team Working Agreement, Definition of Done & Role Guide | Day 2 | **Done** | Merged PR #35 (`docs/WORKING_AGREEMENT.md`, `DoD.md`) |
| **S1-SM-04** | Scrum Master | Mid-Sprint Check Notes & Impediment Log | Day 5 | **In Review** | PR #67 (`docs/sprints/sprint-1-mid-check.md`) |
| **S1-DBA-01** | DevSecOps | Team DB Setup, Migration Runner & Setup README (No Docker) | Day 2 | **Done** | Merged PR #50 (`scripts/migrate`, `DATABASE_SETUP.md`) |
| **S1-DBA-02** | DevSecOps | Migration: HOPE Base Tables with Status & Stamp Columns | Day 3 | **Done** | Merged PR #51 (`db/migrations/001_hope_base_tables.sql`) |
| **S1-DBA-03** | DevSecOps | Migration: User Management Tables (`app_user`, `role`, etc.) | Day 4 | **Done** | Merged PR #52 (`db/migrations/002_user_management_tables.sql`) |
| **S1-DBA-04** | DevSecOps | Migration: Password Reset Token Table (Hashed Token) | Day 5 | **Done** | Merged PR #63 (`db/migrations/003_password_reset_token.sql`) |
| **S1-DBA-05** | DevSecOps | Seed Data: Superadmin Accounts, 5 Modules & 36 Rights | Day 5 | **Done** | Merged PR #64 (`db/seeds/003_initial_access_catalog.sql`) |
| **S1-UIX-01** | UI/UX Developer | Design System: Colors, Typography & Core UI Components | Day 2 | **Done** | Merged PR #54 (`docs/ui/design-system.md`) |
| **S1-UIX-02** | UI/UX Developer | Wireframes: Landing, Login, Register & Forgot/Reset | Day 3 | **Done** | Merged PR #62 (`docs/ui/wireframes-auth.md`) |
| **S1-UIX-03** | UI/UX Developer | Wireframes: Dashboard (3 Roles), Users & Rights Modal | Day 4 | **Done** | Merged PR #66 (`docs/ui/wireframes-dashboard-user-management.md`) |
| **S1-DEV-01** | Backend Dev | Project Scaffold: App Skeleton, Env Config & DB Conn | Day 2 | **Done** | Merged PR #47 (`src/server.js`, `src/config/env.js`) |
| **S1-DEV-02** | Backend Dev | User Registration Form & API | Day 4 | **In Progress** | Active on branch `task-18` (PR pending review) |
| **S1-TST-01** | Test Engineer | Sprint 1 QA Master Plan & Acceptance Criteria | Day 3 | **Done** | Merged PR #55 (`docs/testing/sprint-1-test-plan.md`) |
| **S1-TST-02** | Test Engineer | Test Suite: Registration, Login/Logout, Reset Flow | Day 7 (Early) | **In Review** | Open PR #56 (Contract passed; awaiting live endpoints) |

### Pull Request Quota & Velocity Metrics (Day 5 Checkpoint)

| Role | Assigned Member | Sprint 1 Quota | Merged PRs | Open / In Progress PRs | Remaining Tasks | Status / Pace |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Scrum Master** | @HeindrichMacalinao | 5 | 3 | 1 (S1-SM-04) | 1 (S1-SM-05) | **On Track** (80% initiated) |
| **DevSecOps** | @Chrollofuru | 6 | 5 | 0 | 1 (S1-DBA-06) | **Ahead of Schedule** |
| **UI/UX Developer** | @AlexGavarra | 5 | 3 | 0 | 2 (S1-UIX-04, 05) | **On Track** (60% delivered) |
| **Backend Developer** | @Tysennn | 8 | 1 | 1 (S1-DEV-02) | 6 (S1-DEV-03..08) | **Critical Path / In Flight** |
| **Test Engineer** | @YthanOrogo | 6 | 1 | 1 (S1-TST-02) | 4 (S1-TST-03..06) | **Contract Ready / Queued** |
| **Total Team** | | **30** | **13** | **3** | **14** | **43.3% Merged / 53.3% Active** |

### Burndown Observations
- **Database Architecture Acceleration:** DevSecOps completed 5 out of 6 migrations and seed datasets ahead of schedule, unblocking schema-dependent tasks.
- **UI Design Baseline Established:** UI/UX Developer completed the design system tokens and both primary wireframe specifications (Auth & Role-Based Dashboard/User Management).
- **Backend & Integration Dependency Bottleneck:** The backend scaffold is established, but feature endpoints (`S1-DEV-02` through `S1-DEV-08`) form the critical path for Week 2. Test contracts (`S1-TST-02` through `S1-TST-05`) have deterministic tests passing but require running Express endpoints on `BASE_URL` to transition from contract passes to live HTTP integration validation.

---

## 4. Impediment Log & Triage (Day 5 Checkpoint)

The team conducted a root-cause analysis of blockers identified during Week 1 standups and resolved/escalated each according to the Working Agreement.

```
+---------------------------------------------------------------------------------------------------+
|                                  MID-SPRINT IMPEDIMENT LOG                                        |
+---------+------------------------------------------+----------+------------------+----------------+
| ID      | Impediment Description                   | Severity | Resolution Owner | Status         |
+---------+------------------------------------------+----------+------------------+----------------+
| IMP-01  | Local DB setup: PostgreSQL vs SQLite     | High     | @Chrollofuru     | RESOLVED       |
| IMP-02  | HTTP test runner skipped (BASE_URL unset)| High     | @YthanOrogo      | MITIGATED      |
| IMP-03  | 36 Granular Rights naming alignment      | Medium   | @Chrollofuru     | RESOLVED       |
| IMP-04  | Superadmin initialization security       | High     | @Chrollofuru     | RESOLVED       |
| IMP-05  | Binary SQLite git conflicts & CI sync    | Medium   | @HeindrichMacalinao | RESOLVED    |
+---------+------------------------------------------+----------+------------------+----------------+
```

### Detailed Impediment Analysis & Corrective Actions

#### IMP-01: Local DB Setup: PostgreSQL Driver vs. SQLite Windows Environment (No Docker)
- **Description:** `src/db/pool.js` was initially wired to connect strictly to PostgreSQL. Teammates running purely on local Windows machines without Docker experienced connection timeouts and 503 Service Unavailable errors on `GET /api/health`.
- **Root Cause:** Divergence between local migration runner (designed for SQLite via `scripts/migrate`) and Express backend configuration.
- **Resolution:**
  1. Updated `scripts/migrate/index.js` to standardize SQLite as the verified zero-Docker developer runtime.
  2. Implemented resilient fallback handling in `src/config/env.js` and pool initialization.
  3. Added `docs/DATABASE_SETUP.md` with explicit configuration walkthroughs.
- **Outcome:** All developers can run `npm test` and `npm run migrate:status` locally without Docker dependencies. **Status: RESOLVED.**

#### IMP-02: Test Runner Skips Live HTTP Cases When `BASE_URL` Is Unset
- **Description:** PR #56 (`S1-TST-02`) and subsequent test suites skipped 9 HTTP test cases with status message: `9 HTTP authentication tests were skipped because BASE_URL was unset`.
- **Root Cause:** Backend API endpoints for registration, login, and password reset (`S1-DEV-02`, `S1-DEV-03`, `S1-DEV-04`) were still in development on feature branches, leaving no live server target.
- **Resolution & Mitigation:**
  1. Test Engineer authored deterministic schema, fixture, and contract verification (`tests/verify_auth_contract.py`, `tests/verify_qa_fixtures.py`) that pass via `npm test` without needing live ports.
  2. Created an automated Express test harness wrapper enabling tests to execute against an in-memory/ephemeral Express instance or local test server (`http://localhost:3000`).
  3. Paired @Tysennn (Backend) and @YthanOrogo (Test) to validate `S1-DEV-02` against the test contract prior to merging PR #56.
- **Outcome:** Contract tests passing; live suite ready to execute as soon as backend branches merge. **Status: MITIGATED / IN PROGRESS.**

#### IMP-03: UI-to-DB 36 Granular Rights Catalogue Synchronization
- **Description:** Potential mismatch between rights wireframe toggles (`S1-UIX-03`) and database schema definitions for the 36 rights across the 5 modules.
- **Root Cause:** Initial design wireframes used shorthand labels (`"Delete User"`) rather than the canonical system rights keys (`"customer.delete"`, `"jobhistory.view"`).
- **Resolution:**
  1. Formalized the exact 36 rights catalog in `db/seeds/003_initial_access_catalog.sql` matching Student Guide Section 3.8.
  2. Updated `docs/ui/wireframes-dashboard-user-management.md` to reference the canonical 36 codes directly.
  3. Provided standard contract for `GET /api/users/:id/rights` and `PUT /api/users/:id/rights`.
- **Outcome:** Exact 1-to-1 parity confirmed across database seeds, UI wireframe documentation, and QA matrix. **Status: RESOLVED.**

#### IMP-04: Superadmin Provisioning Security & Zero Hardcoded Passwords in Repo
- **Description:** Requirement to seed Superadmin accounts for all 5 team members without committing plaintext passwords or static private credentials into Git history (DoD violation).
- **Root Cause:** Standard seed scripts frequently default to hardcoded strings (e.g. `'password123'`).
- **Resolution:**
  1. Authored `scripts/seed_superadmins.py` which dynamically generates salted bcrypt hashes (cost factor >= 10).
  2. Integrated environment variable injection (`SUPERADMIN_SETUP_KEY` / `.env`) to keep raw credentials out of version control.
  3. Added `UPLOAD_INSTRUCTIONS_S1_DBA_05.txt` for safe setup.
- **Outcome:** Zero credentials checked into Git; fully compliant with DoD. **Status: RESOLVED.**

#### IMP-05: Binary SQLite Database Merge Conflicts on Concurrent Pull Requests
- **Description:** Pull requests simultaneously altering `HopeERP.db` and `HOPE_Model1.db` encountered Git merge conflicts due to SQLite binary header modifications.
- **Root Cause:** SQLite binary files tracked in Git update timestamps and transaction pages on every run.
- **Resolution:**
  1. Established git hygiene rule: always run `git restore HopeERP.db HOPE_Model1.db` prior to switching branches unless submitting an intentional canonical migration regeneration.
  2. Added GitHub Actions CI workflow (`.github/workflows/ci.yml`) to validate schema migrations programmatically on a fresh disposable database.
  3. Added `tests/check_pending_migrations.py` to assert zero pending migrations.
- **Outcome:** CI automatically enforces migration integrity; merge conflicts eliminated. **Status: RESOLVED.**

---

## 5. Week 2 Critical Path & Dependency Management

### Dependency Map for Sprint 1 Days 6–10

```
+-----------------------------------------------------------------------------------------+
|                                WEEK 2 EXECUTION FLOWCHART                                |
+-----------------------------------------------------------------------------------------+
| Day 6: [S1-DEV-03] Auth & Session API ------> Unblocks live HTTP tests for [S1-TST-02]  |
|        [S1-UIX-04] Hi-Fi Mockups & Handoff                                             |
|                                                                                         |
| Day 7: [S1-DEV-04] Password Reset API --------> Completes Reset Flow verification       |
|                                                                                         |
| Day 8: [S1-DEV-05] User Management API -------\                                        |
|        [S1-DEV-06] Last-Superadmin Guard -----> Unblocks [S1-TST-03] User Mgmt Tests    |
|        [S1-DBA-06] Audit Trail & Triggers ----/                                        |
|                                                                                         |
| Day 9: [S1-DEV-07] 36-Rights API -------------\                                        |
|        [S1-DEV-08] Dashboard Navigation -------> Unblocks [S1-TST-04] Permission Matrix  |
|        [S1-UIX-05] Usability Review Audit ----/  Unblocks [S1-TST-05] Smoke Tests       |
|                                                                                         |
| Day 10: [S1-TST-06] QA Sign-Off Gate                                                    |
|         [S1-SM-05] Sprint Review & Retrospective                                        |
+-----------------------------------------------------------------------------------------+
```

### Daily Milestone Commitments (Days 6–10)

1. **Sprint 1 Day 6 (Auth Core & Hi-Fi Specifications):**
   - **Backend (@Tysennn):** Finalize `S1-DEV-03` (`POST /api/auth/login`, `POST /api/auth/logout`, session management, `isBlocked` gatekeeper, 401 generic error).
   - **UI/UX (@AlexGavarra):** Publish `S1-UIX-04` (Hi-Fi mockups & developer handoff notes for Auth, Users, and Rights modal in `docs/ui/hifi-mockups.md`).
   - **Test (@YthanOrogo):** Execute and merge `S1-TST-02` against live auth endpoints.

2. **Sprint 1 Day 7 (Password Reset Pipeline):**
   - **Backend (@Tysennn):** Deliver `S1-DEV-04` (`POST /api/auth/forgot-password`, `POST /api/auth/reset-password` with 1-hour expiration and SHA-256 token hashing).
   - **DevSecOps (@Chrollofuru):** Assist backend with token cleanup and indexing verification on `password_reset_token`.

3. **Sprint 1 Day 8 (User Management & Last-Superadmin Safeguard):**
   - **Backend (@Tysennn):** Deliver `S1-DEV-05` (`GET /api/users` with Admin role hiding Superadmins, Add/Edit User, Block/Unblock toggle).
   - **Backend (@Tysennn):** Deliver `S1-DEV-06` (Superadmin role promotion/demotion and last-Superadmin lockout safeguard check: `COUNT(*) <= 1 -> HTTP 403`).
   - **DevSecOps (@Chrollofuru):** Deliver `S1-DBA-06` (`audit_log` triggers, `audit_user()` context function, and `stamp` auto-updates).
   - **Test (@YthanOrogo):** Execute and merge `S1-TST-03` (User Management CRUD & boundary validation).

4. **Sprint 1 Day 9 (Granular Rights & Role-Based Dashboard):**
   - **Backend (@Tysennn):** Deliver `S1-DEV-07` (`GET/PUT /api/users/:id/rights` for 36 granular rights) and `S1-DEV-08` (`GET /api/navigation` and `GET /api/dashboard/metrics` live SQL counts).
   - **UI/UX (@AlexGavarra):** Complete `S1-UIX-05` (Usability review across Chrome, Firefox, Edge; publish `docs/ui/sprint-1-usability-audit.md`).
   - **Test (@YthanOrogo):** Execute and merge `S1-TST-04` (Permission Matrix 3 Roles x 36 Rights) and `S1-TST-05` (Automated Smoke Tests).

5. **Sprint 1 Day 10 (Sprint Closeout, QA Gate & Retrospective):**
   - **Test Engineer (@YthanOrogo):** Complete `S1-TST-06` (Bug triage, regression pass, sign-off evidence in `docs/testing/sprint-1-signoff.md`).
   - **Scrum Master (@HeindrichMacalinao):** Deliver `S1-SM-05` (Sprint 1 Review, PR burndown audit, and Sprint Retrospective report in `docs/sprints/sprint-1-retrospective.md`).

---

## 6. Action Items & Working Agreement Adjustments

To protect the 30 PR Sprint 1 quota and prevent bottlenecks during the Week 2 backend delivery sprint, the team agreed to the following operational commitments:

1. **Compressed PR Review SLA (<12 Hours):**
   - During Days 6 through 9, pull request reviews will be turned around within **12 hours** (down from the 24-hour baseline in the Working Agreement) to prevent blocking downstream test tasks.
2. **Backend & QA Daily Pairing Huddle:**
   - @Tysennn and @YthanOrogo will conduct an async sync at **2:00 PM daily** to align on route signatures and status code expectations prior to PR submission.
3. **Pre-PR Verification Protocol:**
   - Every contributor must run `npm test` and `npm run migrate:status` locally before pushing a branch.
   - Any PR introducing database changes must verify zero pending migrations on a clean checkout.
4. **Squash and Merge Discipline:**
   - All PRs must reference their target issue (`Closes #<ID>`) in the PR description and include full test output in the verification section.

---

## 7. Scrum Master Sign-Off & Mid-Sprint Assessment

### Scrum Master Statement
> *"As of Sprint 1 Day 5, the team has successfully mitigated local environment blockers, established a resilient SQLite foundation without Docker dependencies, secured the 36-rights catalog, and built comprehensive UI wireframes. With 13 merged PRs and 3 in review, the team is on pace to achieve the 30 PR Sprint 1 quota. DevSecOps and UI/UX have delivered ahead of schedule, allowing full focus on the Backend and Testing critical paths for Days 6 through 10. Sprint 1 completion remains 100% on track."*

**Approved by:**<br>
**Heindrich Himmler Macalinao**<br>
*Scrum Master, Hope, Inc. ERP Team (`AmbatuPull`)*<br>
*Sprint 1 Day 5 Checkpoint — Signed Off*
