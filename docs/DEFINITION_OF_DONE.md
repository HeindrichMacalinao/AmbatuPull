# Hope, Inc. ERP — Definition of Done (DoD)

To maintain consistent system quality and prevent defects from entering the main branch, every Pull Request submitted by any team member must fulfill this **Definition of Done** before being approved and merged.

---

## 1. Code Quality & Standards
- [ ] Code strictly follows established formatting and linting conventions.
- [ ] No temporary debugging code, console logs (console.log, print), or dead commented-out code.
- [ ] Variable and function names are self-documenting and match ERP domain terms (e.g. custNo, prodCode, 	ransNo).
- [ ] Existing comments and docstrings are preserved.

---

## 2. Database & Data Architecture (Student Guide §2.2, §2.3)
- [ ] **Audit Columns Present:** Every table modified or created MUST contain:
  - status VARCHAR(8) NOT NULL DEFAULT 'Active' ('Active' or 'Inactive').
  - stamp VARCHAR(80) NOT NULL (e.g. 'CREATED system ...', 'EDITED user1 ...', 'DELETED user2 ...').
- [ ] **Soft Delete Enforced:** Records are never physically deleted via DELETE FROM .... Deletion is implemented by updating status = 'Inactive' and recording the actor in stamp.
- [ ] **No Docker Dependency:** All migrations and database scripts run cleanly in local developer environments without containerization.
- [ ] **Referential Integrity:** Foreign key constraints are enforced to prevent orphaned records.

---

## 3. Security & Access Control (Student Guide §1.2, §3.8, §4.2)
- [ ] **Server-Side Enforcement:** Route security and permissions are verified on the backend server (equireRole, equireRight). Hiding buttons on the client is only a UI convenience; API endpoints must reject unauthorized requests with HTTP 403 Forbidden.
- [ ] **Password Security:** All passwords must be salted and hashed using crypt (cost >= 10) or Argon2id. Plain text passwords must never be stored in the database or logged.
- [ ] **Data Privacy Act (RA 10173):** Personal data (birth dates, salaries, job histories) must only be visible to users with explicit viewing rights (jobhistory.view).
- [ ] **No Hardcoded Secrets:** Credentials, database passwords, and session secrets reside strictly in .env.

---

## 4. Testing & Verification
- [ ] All unit, integration, or regression tests pass without errors.
- [ ] Edge cases (e.g. duplicate emails, expired tokens, blocked accounts) are covered with negative tests.
- [ ] Screenshots or terminal test logs are attached to the Pull Request as verification proof.

---

## 5. Review & Git Workflow
- [ ] PR branch follows naming standard (eature/<TASK-ID>-..., ix/<TASK-ID>-...).
- [ ] PR template is filled out completely with linked issue (Closes #...).
- [ ] Approved by at least one (1) peer reviewer.
- [ ] Merged using **Squash and Merge**.