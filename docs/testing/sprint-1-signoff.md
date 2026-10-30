# Sprint 1 QA Sign-Off

**Task:** S1-TST-06  
**Review status:** QA tooling and acceptance evidence are complete; production
sign-off is **blocked pending an application implementation and CI run**.

## Regression command

```powershell
python tests\run_regression.py
```

The runner executes all deterministic contract checks and the four HTTP suites.
HTTP cases are skipped when `BASE_URL` is unset; skipped cases are not counted
as product passes.

## Evidence

| Suite | Coverage | Command | Current result |
|---|---|---|---|
| Authentication | Registration, login/logout, hashing, reset abuse | `npm run test:auth` | 9 skipped without `BASE_URL` |
| User management | Role boundaries, blocking, unblock, last Superadmin | `npm run test:user-management` | 8 skipped without `BASE_URL` |
| Permissions | 36 rights, All/None, 403, audit | `npm run test:permission-matrix` | 1 pass, 3 skipped without `BASE_URL` |
| Smoke | Superadmin, restricted User, blocked login | `npm run test:smoke` | 3 skipped without `BASE_URL` |
| Deterministic contracts | Fixtures, schema, catalogue, evidence | `npm test` | Passed |

## Defects and release gate

The triage record is in [`defect-triage.md`](defect-triage.md). The repository
does not currently contain authentication, user-management, permission, or
dashboard routes, so application-dependent acceptance cases cannot be verified.

Release approval requires:

- all Critical and High cases pass against a disposable AUT;
- no open Critical or High defect remains;
- fixture seed and cleanup logs are attached;
- the regression command passes with `BASE_URL` set;
- the responsible reviewer signs this report.

**No production sign-off granted.**

| Name | Role | Date | Signature |
|---|---|---|---|
|  | Test Engineer |  |  |
|  | Backend Developer |  |  |
|  | DevSecOps |  |  |
|  | Scrum Master |  |  |
