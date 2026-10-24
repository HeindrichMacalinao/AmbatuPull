# Hope, Inc. ERP — Branch Protection Configuration Guide

As Scrum Master, enforce this policy on the main branch to guarantee code quality and prevent accidental overwrites.

### Steps to Configure in GitHub:
1. Navigate to **Settings** > **Branches** in the repository.
2. In the **Branch protection rules** section, click **Add branch protection rule**.
3. Under **Branch name pattern**, enter: main.
4. Configure the following protection checkboxes:
   - [x] **Require a pull request before merging**
     - [x] Require approvals: set to **1 approval**
     - [x] Dismiss stale pull request approvals when new commits are pushed
   - [x] **Require conversation resolution before merging**
   - [x] **Do not allow bypassing the above settings** (enforces rules on administrators as well)
   - [x] **Block force pushes**
   - [x] **Block branch deletions**
5. Click **Save changes** to activate.