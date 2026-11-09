# Hope, Inc. ERP

[![Tech Stack: Next.js + Supabase + Vercel](https://img.shields.io/badge/Stack-Next.js%20%7C%20Supabase%20%7C%20Vercel-blue.svg)](docs/SUPABASE_VERCEL_DEPLOYMENT.md)

Hope, Inc. ERP is a web-based enterprise resource planning platform for managing the
company's core operations from one secure workspace. The project brings together
customer records, products and pricing, employees, sales, payments, reporting, and
user administration with role-based access control.

The current release focuses on the system foundation and user-management workflow:
authentication, password recovery, account blocking, role and permission governance,
audit logging, dashboards, and a responsive Next.js interface. The remaining ERP
modules are represented in the data model and roadmap for incremental delivery.

## What the project provides

- **Secure user management** with Superadmin, Admin, and User roles.
- **Granular authorization** with 36 action-level rights across business modules.
- **ERP foundation** for customers, products, price history, departments, jobs,
  employees, sales, sales details, and payments.
- **Operational dashboards** with protected API routes and role-aware navigation.
- **Cloud and local persistence** through Supabase PostgreSQL and the local SQLite
  migration runner used for development and testing.
- **Auditable workflows** with password hashing, account status controls, and audit
  records.

## Technology

- **Frontend:** Next.js App Router, React, TypeScript, and Tailwind CSS
- **API:** Next.js TypeScript Route Handlers
- **Cloud database and authentication:** Supabase PostgreSQL, Auth, and RLS
- **Local database tooling:** SQLite migrations and seed scripts
- **Deployment:** Vercel
- **Runtime:** Node.js 18 or newer

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

Copy the example configuration and add your local Supabase credentials:

```bash
# macOS, Linux, or Git Bash
cp .env.example .env.local

# Windows PowerShell
Copy-Item .env.example .env.local
```

The required cloud variables are `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL`.
Never commit `.env.local` or production credentials.

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.
The landing page links to sign-in, registration, dashboards, and user management.

## Local database migrations

The repository also includes a SQLite migration runner for local development and
test isolation:

```bash
npm run migrate:up
npm run migrate:status
```

Useful commands include `npm run migrate:down` and `npm run migrate:reset`. See
the [local database setup guide](docs/DATABASE_SETUP.md) for prerequisites,
migration conventions, and troubleshooting.

## Testing

Run the repository verification suite with:

```bash
npm test
```

Targeted suites are available for authentication, user management, permissions,
and smoke testing:

```bash
npm run test:auth
npm run test:user-management
npm run test:permission-matrix
npm run test:smoke
```

## Project structure

```text
src/app/          Next.js pages and API route handlers
src/components/   Shared UI components
src/lib/          Supabase and ERP database clients
src/services/     Authentication, dashboard, and user services
supabase/         PostgreSQL migrations and seed data
migrations/       Local SQLite migrations
scripts/          Migration and database utilities
tests/            Automated verification and regression tests
docs/             Architecture, deployment, testing, and project guides
```

## Documentation

- [Supabase and Vercel deployment guide](docs/SUPABASE_VERCEL_DEPLOYMENT.md)
- [Local database setup and migrations](docs/DATABASE_SETUP.md)
- [Module roadmap and sprint architecture](docs/ROADMAP.md)
- [Role guide and responsibility matrix](docs/ROLE_GUIDE.md)
- [Testing and quality documentation](docs/testing/)

## License

This project is maintained by the Hope, Inc. ERP Team.
