# Hope, Inc. ERP — Modern Tech Stack & Deployment Guide

> **Mentor Feedback Refactor**:
> - **Backend**: Supabase & TypeScript / JavaScript
> - **Frontend**: Next.js (App Router + TypeScript + Tailwind CSS)
> - **Deployment**: Vercel

---

## 1. System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Vercel Deployment                    │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │             Next.js 16 (App Router)              │  │
│  │  - React 19 + TypeScript + Tailwind CSS          │  │
│  │  - Server Components & Server-Side Rendering     │  │
│  │  - Dynamic API Routes (/api/auth, /api/users)    │  │
│  └──────────────────────────┬───────────────────────┘  │
└─────────────────────────────┼──────────────────────────┘
                              │ HTTPS / REST / WebSockets
                              ▼
┌────────────────────────────────────────────────────────┐
│                    Supabase Cloud                      │
│                                                        │
│  - PostgreSQL 15 Relational Database                   │
│  - 10 Foundation Tables (CUSTOMER, PRODUCT, EMP, etc.) │
│  - RBAC & User Management (app_user, role, rights)    │
│  - 36 Granular Seeded Rights Catalogue                 │
│  - Row-Level Security (RLS) & Audit Logging            │
└────────────────────────────────────────────────────────┘
```

---

## 2. Setting Up Supabase (Database & Backend)

### Step 1: Create a Free Project
1. Log in to [supabase.com](https://supabase.com) and click **New project**.
2. Set your **Project Name** (e.g., `hope-erp-staging`) and generate a secure **Database Password**.
3. Choose your region (e.g., `Singapore` or closest to your users).

### Step 2: Apply Migrations & Seed Data
In your Supabase project dashboard, navigate to the **SQL Editor** tab (left sidebar) and run the three migration files located in `supabase/migrations/` in order:

1. **`supabase/migrations/20261108_001_core_erp_schema.sql`**
   - Creates the 10 foundational ERP tables (`CUSTOMER`, `PRODUCT`, `PRICEHIST`, `DEPARTMENT`, `JOB`, `EMPLOYEE`, `JOBHISTORY`, `SALES`, `SALESDETAIL`, `PAYMENT`).
2. **`supabase/migrations/20261108_002_user_management_rbac.sql`**
   - Creates `role`, `module`, `rights`, `app_user`, `user_permission`, `audit_log`, and indexes.
3. **`supabase/migrations/20261108_003_seed_data.sql`**
   - Seeds the 5 core modules, 36 granular rights, initial Superadmin/Admin/User roles, and demo accounts.

### Step 3: Copy API Credentials
Go to **Project Settings** -> **API** and copy:
- **Project URL** (`NEXT_PUBLIC_SUPABASE_URL`)
- **anon / public key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- **service_role key** (`SUPABASE_SERVICE_ROLE_KEY`)

---

## 3. Running Locally

### Step 1: Setup Environment File
Copy `.env.example` to `.env.local`:
```bash
# Windows PowerShell
Copy-Item .env.example .env.local

# Linux / macOS / Bash
cp .env.example .env.local
```
Fill in your `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

*(Note: If Supabase keys are not set yet, the application automatically falls back to an offline demo store with default mock credentials so developers can preview and test immediately).*

### Step 2: Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Deploying to Vercel

### Option A: Via GitHub Integration (Recommended)
1. Commit and push the branch `mentor_feedback_refactor`:
   ```bash
   git add .
   git commit -m "feat: migrate tech stack to Next.js, Supabase, and Vercel"
   git push origin mentor_feedback_refactor
   ```
2. Go to [vercel.com](https://vercel.com) and click **Add New...** -> **Project**.
3. Import your GitHub repository (`AmbatuPull`).
4. Select `mentor_feedback_refactor` as the branch (or merge into `main` after review).
5. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = `your-supabase-url`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your-supabase-anon-key`
   - `SUPABASE_SERVICE_ROLE_KEY` = `your-supabase-service-role-key`
6. Click **Deploy**. Vercel will automatically build and assign a production URL (e.g. `https://ambatupull-erp.vercel.app`).

For password-reset email delivery, also configure the SMTP environment variables
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and
`SMTP_FROM` in Vercel. Production requests fail explicitly if SMTP delivery is
not configured; reset responses remain generic so they do not disclose whether an
email address has an account.

### Option B: Via Vercel CLI
```bash
npm i -g vercel
vercel
```

---

## 5. Seed Accounts & Credentials

| Role | Email | Password | Granted Privileges |
| :--- | :--- | :--- | :--- |
| **Superadmin** | `superadmin@hope-erp.local` | `Admin@123456` | Full governance, all 36 granular rights, user blocking |
| **Admin** | `admin@hope-erp.local` | `Admin@123456` | Department administration & operations |
| **User** | `user@hope-erp.local` | `Admin@123456` | Standard end-user view |

---

## 6. Sprint 1 Safeguards Maintained
- **Last-Superadmin Lockout Protection**: The API blocks any attempt to block or deactivate the last active Superadmin in `/api/users/[id]/block`.
- **Granular 36-Rights Matrix**: Modal dialog allows dynamic granting/revoking of rights grouped by the 5 modules.
- **Salted Bcrypt Password Hashing**: Passwords stored as standard `$2a$12$...` hashes.
