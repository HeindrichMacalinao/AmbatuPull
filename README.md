# Hope, Inc. ERP — AmbatuPull

[![Tech Stack: Next.js + Supabase + Vercel](https://img.shields.io/badge/Stack-Next.js%20%7C%20Supabase%20%7C%20Vercel-blue.svg)](docs/SUPABASE_VERCEL_DEPLOYMENT.md)
[![Sprint 1 Sign-off](https://img.shields.io/badge/Sprint%201-Sign--Off%20Complete-success)](docs/sprints/SPRINT_1_SIGNOFF_EVIDENCE.md)

Enterprise Resource Planning (ERP) platform for **Hope, Inc.**, modernised in accordance with mentor feedback:
- **Backend**: **Supabase** (PostgreSQL 15, Auth, RLS, Granular RBAC) & TypeScript
- **Frontend**: **Next.js** (App Router, React 19, TypeScript, Tailwind CSS)
- **Deployment**: **Vercel**

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
```

The required cloud variables are `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL`.
Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`
to send password-reset links by email. Never commit `.env.local` or production
credentials. When SMTP is intentionally omitted in development, the reset link
is logged locally instead.

### 3. Start the development server
```bash
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000) to access the landing page, sign-in, and dashboards.

---

## Tech Stack & Architecture

- **Frontend**: Next.js App Router (`/`, `/login`, `/register`, `/dashboard`, `/users`) with interactive role preview.
- **Backend API**: Next.js TypeScript Route Handlers (`/api/auth`, `/api/users`, `/api/health`, etc.).
- **Database**: Supabase PostgreSQL schemas in `supabase/migrations/`:
  - `20261108_001_core_erp_schema.sql`: 10 foundational ERP tables.
  - `20261108_002_user_management_rbac.sql`: Roles, modules, rights, users, permissions.
  - `20261108_003_seed_data.sql`: 36 rights catalog and default Superadmin, Admin, and User accounts.
- **Deployment**: Vercel configuration in `vercel.json` and [Deployment Guide](docs/SUPABASE_VERCEL_DEPLOYMENT.md).

---

## Documentation
- [Supabase & Vercel Deployment Guide](docs/SUPABASE_VERCEL_DEPLOYMENT.md)
- [Module Roadmap & Sprint Architecture](docs/ROADMAP.md)
- [Role Guide & Team Responsibility Matrix](docs/ROLE_GUIDE.md)
