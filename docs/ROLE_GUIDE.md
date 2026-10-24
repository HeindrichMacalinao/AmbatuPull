# Hope, Inc. ERP — Comprehensive Role Guide

This handbook defines the expectations, targets, and handoff touchpoints for each role across Sprints 1 through 4.

---

## 1. Scrum Master (@HeindrichMacalinao)
- **Target:** 5 planned PRs per sprint (20 total PRs across 4 sprints).
- **Core Duties:**
  - Maintains repository governance, branch protection, and templates.
  - Manages GitHub Projects board (AmbatuPull #3) with strict WIP column limits.
  - Facilitates Day 5 Mid-Sprint Checks and documents impediment logs.
  - Leads Day 10 Sprint Reviews and publishes Retrospective Reports.
  - Ensures all 6 Hope ERP modules remain on schedule within the 8-week limit.

---

## 2. DevSecOps (@Chrollofuru)
- **Target:** 6 planned PRs per sprint (24 total PRs across 4 sprints).
- **Core Duties:**
  - Designs database schemas matching the Student Guide ERD (Figure 1) and Table Dictionary (§2.2).
  - Maintains lightweight CLI migration runner in scripts/migrate (No Docker).
  - Ensures every table includes status (Active/Inactive) and stamp columns (§2.3).
  - Seeds the 36 per-action rights catalog (§3.8) and superadmin accounts.
  - Implements audit logging (udit_log table and udit_user() session context).
  - Validates delete constraints (prevent deleting customers/products with active sales).

---

## 3. Backend Developer (@Tysennn)
- **Target:** 8 planned PRs per sprint (32 total PRs across 4 sprints).
- **Core Duties:**
  - Builds server skeleton, routing architecture, and database connection pooling.
  - Implements secure authentication: salted crypt hashing, sessions, password reset.
  - Implements account blocking (isBlocked) and the **Last-Superadmin lockout safeguard**.
  - Develops administrative User Management CRUD and the 36-rights assignment API.
  - Enforces server-side RBAC middleware (equireRole, equireRight) across all routes.
  - Computes derived data via live SQL queries (COUNT, SUM), never storing redundant totals.

---

## 4. UI/UX Developer (@AlexGavarra)
- **Target:** 5 planned PRs per sprint (20 total PRs across 4 sprints).
- **Core Duties:**
  - Defines the Hope ERP Design System (brand blue #1E3A8A, dark header #0F172A, badges, layout).
  - Produces wireframes for public flows (Landing, Login, Register, Forgot Password).
  - Designs role-differentiated dashboard layouts (Superadmin, Admin, User).
  - Designs the 36-rights dialog modal with module master toggles and All/None shortcuts.
  - Delivers high-fidelity mockups with developer handoff specs for states (Active, Inactive, Blocked).
  - Conducts end-of-sprint usability inspections against Student Guide screenshots.

---

## 5. Test Engineer (@YthanOrogo)
- **Target:** 6 planned PRs per sprint (24 total PRs across 4 sprints).
- **Core Duties:**
  - Formulates Master Test Plans with acceptance criteria for each sprint.
  - Designs test suites covering positive paths, negative validations, and boundary cases.
  - Executes the 36-rights permission matrix verifying both UI hiding and HTTP 403 API denial.
  - Builds automated smoke test scripts verifying critical user login and navigation.
  - Manages defect triage, verifies developer bug fixes, and issues formal QA Sign-Off reports.