# Hope, Inc. ERP — 8-Week Module Roadmap & Sprint Architecture

This document formalizes the complete module-to-sprint delivery roadmap for **Hope, Inc. ERP**, mapping all six core modules across four 2-week sprints (8-week semester schedule) and defining the GitHub Project board governance rules.

---

## 1. Six Modules Architecture & Sprint Delivery Map

As outlined in the **Student Guide §1.1**, the ERP integrates six distinct business modules reading and writing to a unified database.

| Module | Core Purpose & Tables Managed | Target Sprint | Week | Key Deliverables & Rights Count |
| :--- | :--- | :---: | :---: | :--- |
| **User Management** | Authentication, roles (`Superadmin`, `Admin`, `User`), account blocking (`isBlocked`), and granular permissions.<br>*Tables:* `app_user`, `role`, `module`, `rights`, `user_permission`, `audit_log` | **Sprint 1** | Weeks 1–2 | • 36-rights catalogue seeded<br>• Salted `bcrypt` auth & expiring reset tokens<br>• Last-Superadmin lockout safeguard<br>• Role-differentiated dashboard views |
| **Customers** | Client registry, billing addresses, and payment terms (`Net 30`, `COD`, `Prepaid`).<br>*Tables:* `CUSTOMER` | **Sprint 2** | Weeks 3–4 | • Full CRUD with search & typeahead filter<br>• Soft delete (`status = 'Inactive'`) & Restore<br>• `stamp` audit column generation<br>• 3 granular rights (`customer.add/edit/delete`) |
| **Products & Pricing** | Item catalog and chronological effective price history.<br>*Tables:* `PRODUCT`, `PRICEHIST` | **Sprint 2** | Weeks 3–4 | • Product CRUD with unit validation<br>• Chronological price effective date lookup<br>• Current price derived from live query<br>• 6 granular rights (`product.*`, `price.*`) |
| **Human Resources** | Personnel profiles, organizational units, job assignments, and historical salary tracking.<br>*Tables:* `EMPLOYEE`, `JOB`, `DEPARTMENT`, `JOBHISTORY` | **Sprint 3** | Weeks 5–6 | • Department & Job lookup tables CRUD<br>• Employee master profile & separation dates<br>• Job history promotion/salary timeline<br>• Data Privacy Act (RA 10173) access gating (`jobhistory.view`)<br>• 13 granular rights |
| **Sales** | Master-detail sales transactions and payment recording.<br>*Tables:* `SALES`, `SALESDETAIL`, `PAYMENT` | **Sprint 4** | Weeks 7–8 | • Auto-numbered sales headers<br>• Detail line items with auto-pricing as of sale date<br>• Live derived transaction totals (`quantity x unitPrice`)<br>• Payment recording & customer balance view<br>• 7 granular rights |
| **Reports** | Read-only business intelligence summaries with print and PDF export capabilities.<br>*Tables:* Reads all ERP tables via views | **Sprint 4** | Weeks 7–8 | • 7 System Reports (Master Product List, Active/All Employees, Employee Job History, Top Customers, Top Products, Top Sales)<br>• Date range and Top N filtering<br>• Print and Save as PDF<br>• 7 granular report rights |

---

## 2. Sprint Timeline & PR Quota Overview

The project adheres to strict team quotas (30 PRs per sprint × 4 sprints = 120 total PRs):

### Planned PR Targets by Role

| Team Member | Role | S1 Planned | S2 Planned | S3 Planned | S4 Planned | Total Planned PRs |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Heindrich Himmler Macalinao** | Scrum Master | 5 | 5 | 5 | 5 | **20** |
| **Chrollofuru** | DevSecOps | 6 | 6 | 6 | 6 | **24** |
| **Tysennn** | Backend Developer | 8 | 8 | 8 | 8 | **32** |
| **Alex Gavarra** | UI/UX Developer | 5 | 5 | 5 | 5 | **20** |
| **Ythan Orogo** | Test Engineer | 6 | 6 | 6 | 6 | **24** |
| **Team Total** | | **30** | **30** | **30** | **30** | **120** |

---

## 3. GitHub Project Board Configuration (`AmbatuPull #3`)

The agile board enforces Work In Progress (WIP) constraints to maintain flow and avoid review bottlenecks:

| Column | WIP Limit | Entry Condition | Exit Condition |
| :--- | :---: | :--- | :--- |
| **Backlog** | 3 | Issue created and prioritized for sprint. | Developer assigns self and moves to Ready/In progress. |
| **Ready** | Unlimited | Dependencies satisfied; ready for immediate pickup. | Work begins. |
| **In progress** | **3** | Feature branch created (`feature/...`); active coding underway. | Code complete, locally verified without Docker. |
| **In review** | **5** | Pull request opened with linked issue (`Closes #...`). | Approved by ≥ 1 teammate; merged into `main`. |
| **Done** | Unlimited | PR merged into `main`; issue closed automatically. | Verified during Sprint Review / Retrospective. |