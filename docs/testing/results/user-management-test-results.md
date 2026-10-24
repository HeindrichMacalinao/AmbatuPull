# User Management Test Results

**Task:** S1-TST-03  
**Status:** Ready for execution against the application under test.

| ID | Scenario | Expected result | Result |
|---|---|---|---|
| TC-UM-01 | Admin lists users | Superadmin rows are absent | Pending AUT |
| TC-UM-02 | Admin views peer Admin | Actions are `—`; mutations are rejected | Pending AUT |
| TC-UM-03 | Superadmin lists users | Superadmin, Admin, and User rows are visible/editable | Pending AUT |
| TC-BLK-01 | Admin blocks active User | Red status badge and `Unblock` action | Pending AUT |
| TC-BLK-02 | Blocked User calls protected endpoint | 401/403 immediately | Pending AUT |
| TC-BLK-03 | Admin unblocks User | User can authenticate again | Pending AUT |
| TC-SA-01 | Delete/demote/block sole active Superadmin | Transaction rolls back with 403 and warning | Pending AUT |

## Invariants

User visibility and mutation authorization must be enforced server-side, not only by the management screen. The last active Superadmin guard must execute inside the same transaction as the mutation to prevent concurrent lockout.
