# Hope, Inc. ERP — Git Workflow & Contribution Guide

## 1. Branching Strategy
We use **Feature Branching** off of the main branch. Direct commits to main are restricted.

### Branch Naming Conventions
- Features: eature/<TASK-ID>-<short-description> (e.g. eature/S1-DEV-01-app-scaffold)
- Bug Fixes: ix/<TASK-ID>-<issue-description> (e.g. ix/S1-DEV-03-blocked-user-check)
- Testing: 	est/<TASK-ID>-<suite-name> (e.g. 	est/S1-TST-02-auth-suite)
- Documentation / Governance: docs/<TASK-ID>-<doc-name>

---

## 2. Commit Message Standards
Follow the Conventional Commits format:
- eat: A new feature or endpoint (e.g. eat: add user registration endpoint)
- ix: A bug fix (e.g. ix: prevent blocked users from logging in)
- docs: Documentation only changes (e.g. docs: add database setup guide)
- 	est: Adding or updating tests (e.g. 	est: add password hashing unit test)
- efactor: Code change that neither fixes a bug nor adds a feature
- chore: Maintenance, package updates, or repo setup

---

## 3. Pull Request & Review Process
Each task in the sprint plan corresponds to **one planned Pull Request**.

1. Create a feature branch from latest main:
   `ash
   git checkout main
   git pull origin main
   git checkout -b feature/S1-DEV-01-app-scaffold
   `
2. Make your commits adhering to project standards.
3. Push branch to GitHub:
   `ash
   git push -u origin feature/S1-DEV-01-app-scaffold
   `
4. Open a Pull Request into main:
   - The Pull Request template will load automatically.
   - Fill in all sections, referencing the target issue (Closes #17).
5. Request review from at least 1 team member.
6. Once approved and status checks pass, use **Squash and Merge**.