# Hope, Inc. ERP — Local Database Setup & Migration Guide

**Task ID:** S1-DBA-01 (GitHub Issue #6)  
**Role:** DevSecOps (@Chrollofuru)  
**Sprint:** Sprint 1: System Foundation & User Management  
**Target Environment:** Local Windows Developer Machine (Zero Docker / No Virtualization Required)  
**Default Storage Engine:** SQLite (Embedded, UTF-8, UTC Timestamp)

---

## 1. Why SQLite for Sprint 1 Local Development?

For an early-stage sprint focusing on foundational backend architecture, user authentication, and granular permission matrices, **SQLite is the optimal database choice for local developer workstations**:

1. **Zero Virtualization & Zero Docker Overhead:**
   Team members can clone the repository and run migrations immediately on Windows without installing Docker Desktop, WSL2, Hyper-V, or managing heavy daemon background services.
2. **Deterministic, Painless Onboarding:**
   The database lives in a self-contained local file (`./data/erp_local.db`). There are no port collisions (e.g. port 3306 or 5432 already occupied by other local services), no permission/socket issues, and no external service dependencies.
3. **Full SQL Standard Compliance & ACID Transactions:**
   SQLite supports foreign key referential integrity (`PRAGMA foreign_keys = ON`), composite primary keys, check constraints, indexes, and immediate ACID transactions with Write-Ahead Logging (`PRAGMA journal_mode = WAL`).
4. **Native Node.js Runtime Support:**
   Modern Node.js (v22.5+) includes native built-in SQLite support (`node:sqlite`), allowing migration scripts to execute with zero binary compilation and zero native C++ build tool dependencies.
5. **Seamless Reset & Test Isolation:**
   Tearing down the database or creating clean test environments is as simple as deleting or swapping the `.db` file, providing instantaneous test cycles for QA and backend developers.

---

## 2. Prerequisites

Before setting up the project, ensure your development machine has the following:

- **Operating System:** Windows 10 / 11 (64-bit), macOS, or Linux.
- **Node.js:** Version 18.0.0 or higher (Node.js 20+ LTS or 22+ recommended).
  - Verify installation:
    ```powershell
    node -v
    npm -v
    ```
  - *If Node.js is not yet installed on Windows:*
    ```powershell
    winget install OpenJS.NodeJS.LTS
    ```
- **Git:** Git for Windows (v2.30+).

---

## 3. Fresh Checkout Setup Guide

Follow these exact steps when checking out the project for the first time:

### Step 1: Clone the Repository
```powershell
git clone https://github.com/HeindrichMacalinao/AmbatuPull.git
cd AmbatuPull
```

### Step 2: Install Project Dependencies
Run `npm install` in the project root:
```powershell
npm install
```

> **Note on Windows Script Execution Policy:**  
> If PowerShell displays an error stating `npm.ps1 cannot be loaded because running scripts is disabled on this system`, allow local script execution for the current user:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
> ```

### Step 3: Configure Environment Variables
Copy `.env.example` to create your local `.env` configuration file:

**Windows PowerShell:**
```powershell
Copy-Item .env.example .env
```

**Bash / Git Bash / macOS:**
```bash
cp .env.example .env
```

The default values inside `.env` are pre-configured to run out of the box:
```env
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# SQLite Local Database Setup
DB_CLIENT=sqlite
DB_PATH=./data/erp_local.db

# Character Encoding & Timezone Standards
TZ=UTC
DB_ENCODING=UTF-8

# Session & Security Settings
SESSION_SECRET=ambatu_development_secret_key_change_in_production_32chars
BCRYPT_ROUNDS=10
```

### Step 4: Run Database Migrations
Execute the migration runner:
```powershell
npm run migrate:up
```

Verify migration status:
```powershell
npm run migrate:status
```

---

## 4. Expected Successful Terminal Output

### Initial Migration (`npm run migrate:up`)
```
============================================================
 🚀 Hope, Inc. ERP — Running Database Migrations (UP)
============================================================
 Database:   C:\Users\...\AmbatuPull\data\erp_local.db
 Driver:     node:sqlite
 Migrations: C:\Users\...\AmbatuPull\migrations
------------------------------------------------------------
Found 2 pending migration(s) to apply:

  ⏳ [UP] Applying: 001_init_core_schema.sql ... DONE (7ms)
  ⏳ [UP] Applying: 002_create_user_management.sql ... DONE (3ms)
------------------------------------------------------------
🎉 Success: Applied 2 migration(s) successfully.
```

### Checking Migration Status (`npm run migrate:status`)
```
============================================================
 📊 Hope, Inc. ERP — Migration Status
============================================================
 Database:   C:\Users\...\AmbatuPull\data\erp_local.db
 Driver:     node:sqlite
 Migrations: C:\Users\...\AmbatuPull\migrations
------------------------------------------------------------
| Migration Version / File             | Status       | Applied At (UTC)         |
|--------------------------------------|--------------|--------------------------|
| 001_init_core_schema.sql             | ✅ APPLIED    | 2026-10-25 11:06:42      |
| 002_create_user_management.sql       | ✅ APPLIED    | 2026-10-25 11:06:42      |
|--------------------------------------|--------------|--------------------------|
 Summary: Total: 2 | Applied: 2 | Pending: 0
```

---

## 5. Migration Runner CLI Reference

The migration runner is located at `scripts/migrate/index.js` and provides full CLI control:

| Command | npm Script Shortcut | Description |
| :--- | :--- | :--- |
| `node scripts/migrate/index.js up` | `npm run migrate:up` (or `npm run migrate`) | Applies all pending migrations in sequential numerical order. |
| `node scripts/migrate/index.js down` | `npm run migrate:down` | Rolls back the single most recently applied migration. |
| `node scripts/migrate/index.js down --steps=2` | — | Rolls back the last 2 applied migrations. |
| `node scripts/migrate/index.js status` | `npm run migrate:status` | Renders a table comparing discovered SQL files vs. applied records in `schema_migrations`. |
| `node scripts/migrate/index.js reset` | `npm run migrate:reset` | Safely reverses all applied migrations and re-applies all migrations from scratch. |
| `node scripts/migrate/index.js help` | — | Displays the interactive CLI manual and usage flags. |

### CLI Options & Flags
- `--db=<path>`: Override SQLite database file destination (default: `./data/erp_local.db` or `DB_PATH`).
- `--dir=<path>`: Custom migrations folder (default: `./migrations`).
- `--steps=<number>`: Number of steps to roll back in `down` command (default: `1`).

---

## 6. Migration Tracking & Database Schema Standards

### Migration Tracking Table: `schema_migrations`
The runner automatically provisions and maintains the tracking table:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Mandatory Table Standards (§2.3 of Student Guide)
Every domain and administrative table across the Hope, Inc. ERP database **must** incorporate the following standard audit columns:
1. `status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive'))`
   - Governs soft-deletion. Active records are accessible in standard user workflows; Inactive records are archived.
2. `stamp VARCHAR(80) NOT NULL`
   - Formatted audit string recording the actor and timestamp for record creation and edits:
     e.g., `'CREATED system 2026-10-25 00:00:00'` or `'EDITED user@hope.com 2026-10-25 14:30:00'`.

### Initial Schema Baseline (10 Core Tables + User Management)
- **Core ERP Tables (`001_init_core_schema.sql`):**
  - `CUSTOMER`
  - `PRODUCT`
  - `PRICEHIST`
  - `DEPARTMENT`
  - `JOB`
  - `EMPLOYEE`
  - `JOBHISTORY`
  - `SALES`
  - `SALESDETAIL`
  - `PAYMENT`
- **User Management & RBAC (`002_create_user_management.sql`):**
  - `app_user`
  - `role`
  - `module`
  - `rights`
  - `user_permission`
  - `password_reset_token`

---

## 7. How to Author New Migrations

When contributing new schema changes:

1. Create a forward migration file in `migrations/` following the numerical naming standard:
   ```
   migrations/003_add_customer_credit_limit.sql
   ```
2. Create the corresponding reversal file:
   ```
   migrations/003_add_customer_credit_limit.down.sql
   ```
   *(Alternatively, embed a `-- DOWN` delimiter directly at the bottom of the SQL file).*
3. Ensure all table creations include `status` and `stamp` columns and proper foreign keys.
4. Test your migration locally:
   ```powershell
   npm run migrate:up
   npm run migrate:status
   npm run migrate:down
   npm run migrate:up
   ```
5. Commit your migration files to your task branch (e.g. `feature/S1-DBA-03-...`). Never check in binary database files (`*.db` is ignored by `.gitignore`).

---

## 8. Troubleshooting & Windows Tips

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| `npm.ps1 cannot be loaded...` | Windows PowerShell ExecutionPolicy | Run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force` in PowerShell. |
| `Database file is locked` | An active Node.js server or SQLite GUI has an open transaction | Ensure background processes or GUI viewers (e.g. DB Browser for SQLite) are closed before running migrations. WAL mode is enabled by default to minimize lock contention. |
| `No prebuilt binaries found for better-sqlite3` | Bleeding-edge Node.js version without Visual Studio C++ compiler | `better-sqlite3` is an `optionalDependency`. If omitted, the runner automatically activates the zero-dependency built-in `node:sqlite` driver in Node.js >= 22.5. |
| Clean Slate Database Rebuild | Need to completely wipe local data and restart | Run `npm run migrate:reset`, or simply delete `./data/erp_local.db` and re-run `npm run migrate:up`. |
