import Link from 'next/link';
import {
  ShieldCheck,
  Users,
  Database,
  Layers,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Briefcase,
  ShoppingCart,
  Lock,
  Cloud,
  CheckCircle2,
  Building,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto pt-4 sm:pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 mb-6 border border-blue-200 dark:border-blue-800">
          <Building className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Sprint 1 Operations Suite &bull; Cloud &amp; Relational Persistence</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-tight mb-5">
          Enterprise Resource Planning for <span className="text-blue-600 dark:text-blue-400">Hope, Inc.</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-8 max-w-2xl mx-auto">
          Centralized business platform integrating customer records, dynamic product pricing,
          human resources, sales distribution, and strict 36-rights role security governance.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-sm transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <span>Launch ERP Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/80 transition text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span>Create User Account</span>
          </Link>
        </div>
      </section>

      {/* Live Foundation KPI Highlights */}
      <section aria-label="System Metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900/90 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Customer Registry</span>
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">82 Accounts</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Verified baseline client records</p>
        </div>

        <div className="bg-white dark:bg-slate-900/90 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Product Catalog</span>
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">57 SKUs</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Effective chronological pricing</p>
        </div>

        <div className="bg-white dark:bg-slate-900/90 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Sales Orders</span>
            <ShoppingCart className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">124 Orders</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Master-detail transaction lines</p>
        </div>

        <div className="bg-white dark:bg-slate-900/90 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Security Matrix</span>
            <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">36 Rights</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Per-action granular authorization</p>
        </div>
      </section>

      {/* 6 Core Business Modules Architecture */}
      <section className="bg-white dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Six Operational ERP Modules</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Engineered according to the Hope, Inc. ERP Specifications (§1.1 &amp; §3.1–§3.8)
            </p>
          </div>
          <span className="self-start sm:self-auto text-xs font-semibold px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
            Sprint 1 Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* 1. User Management */}
          <div className="p-4 sm:p-5 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 relative">
            <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center mb-3 shadow-xs">
              <Lock className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">User Management &amp; Security</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Sprint 1 (Active)
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
              Multi-role governance (Superadmin, Admin, User), account blocking, salted bcrypt security, and 36 granular rights catalog.
            </p>
            <div className="text-[11px] text-blue-700 dark:text-blue-400 font-mono">
              Tables: app_user, role, module, rights, user_permission, audit_log
            </div>
          </div>

          {/* 2. Customers */}
          <div className="p-4 sm:p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="w-8 h-8 rounded bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center mb-3 shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Customer Management</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Sprint 2
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
              Client registry, billing addresses, credit terms (Net 30, COD, Prepaid), soft-delete, and audit stamp generation.
            </p>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Tables: CUSTOMER &bull; 3 Rights (customer.add/edit/delete)
            </div>
          </div>

          {/* 3. Products & Pricing */}
          <div className="p-4 sm:p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="w-8 h-8 rounded bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center mb-3 shadow-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Products &amp; Dynamic Pricing</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Sprint 2
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
              SKU catalog, unit management, and chronological effective price history algorithm derived dynamically.
            </p>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Tables: PRODUCT, PRICEHIST &bull; 6 Rights
            </div>
          </div>

          {/* 4. Human Resources */}
          <div className="p-4 sm:p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="w-8 h-8 rounded bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center mb-3 shadow-xs">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Human Resources &amp; Payroll</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Sprint 3
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
              Personnel profiles, departments, job codes, career timelines, and Data Privacy Act (RA 10173) salary gating.
            </p>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Tables: EMPLOYEE, JOB, DEPARTMENT &bull; 13 Rights
            </div>
          </div>

          {/* 5. Sales & Distribution */}
          <div className="p-4 sm:p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="w-8 h-8 rounded bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center mb-3 shadow-xs">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Sales &amp; Distribution</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Sprint 4
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
              Auto-numbered transaction headers, order line item auto-pricing, live derived invoice totals, and receipt balances.
            </p>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Tables: SALES, SALESDETAIL, PAYMENT &bull; 7 Rights
            </div>
          </div>

          {/* 6. Reports */}
          <div className="p-4 sm:p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="w-8 h-8 rounded bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center mb-3 shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Business Intelligence &amp; Reports</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Sprint 4
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
              Seven executive management reports (Master Product List, Active/All Staff, Top Clients, Top Products, Top Sales).
            </p>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Read-Only Relational Views &bull; 7 Rights (report.*)
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Highlights */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white dark:bg-slate-900/90 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 flex items-center justify-center mb-3">
            <Cloud className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-1">Dual-Engine Persistence</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Enterprise PostgreSQL on Supabase Cloud with fallback to Hope Relational SQLite, guaranteeing local testability and cloud uptime.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900/90 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mb-3">
            <Layers className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-1">Next.js App Router Architecture</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            React 19 Server Components, TypeScript contracts, secure REST API Route Handlers, and restrained dark-blue design system.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900/90 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 flex items-center justify-center mb-3">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-1">Strict Server-Side RBAC (§4.2)</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Role visibility and right codes are validated server-side for each action, with append-only audit tracking.
          </p>
        </div>
      </section>
    </div>
  );
}
