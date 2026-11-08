import Link from 'next/link';
import {
  ShieldCheck,
  Users,
  Database,
  Layers,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Briefcase,
  ShoppingCart,
  Lock,
  Cloud,
  Server,
  Sparkles,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-20">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto pt-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 mb-6 border border-blue-200 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Sprint 1 Foundation Complete &bull; Cloud &amp; Local Persistence Active</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Enterprise Resource Planning for <span className="text-blue-600">Hope, Inc.</span>
        </h1>

        <p className="text-lg text-slate-600 leading-relaxed mb-10">
          A centralized, mission-critical operations platform integrating customer relationships,
          dynamic product pricing, human resources, sales distribution, and granular 36-rights security governance.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 shadow-md hover:shadow-lg transition text-sm"
          >
            <span>Launch ERP Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition text-sm shadow-xs"
          >
            <span>Create User Account</span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-slate-900 text-slate-100 font-semibold hover:bg-slate-800 transition text-sm shadow-xs"
          >
            <span>Preview Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Live Foundation KPI Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Customer Registry</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">82 Accounts</div>
          <p className="text-[11px] text-slate-500 mt-1">Verified baseline client records</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Product Catalog</span>
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">57 SKUs</div>
          <p className="text-[11px] text-slate-500 mt-1">Effective chronological pricing</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Sales Orders</span>
            <ShoppingCart className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">124 Orders</div>
          <p className="text-[11px] text-slate-500 mt-1">Master-detail transaction lines</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Security Matrix</span>
            <Lock className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">36 Rights</div>
          <p className="text-[11px] text-slate-500 mt-1">Per-action granular authorization</p>
        </div>
      </div>

      {/* 6 Core Business Modules Architecture */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Six Operational ERP Modules</h2>
            <p className="text-sm text-slate-500 mt-1">
              Engineered according to the official Hope, Inc. ERP Student Guide (§1.1 &amp; §3.1–§3.8)
            </p>
          </div>
          <span className="self-start sm:self-auto text-xs font-semibold px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
            Sprint 1 Delivery Complete
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 1. User Management */}
          <div className="p-5 rounded-xl border border-blue-200 bg-blue-50/40 relative">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center mb-3 shadow-xs">
              <Lock className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-base">User Management &amp; Security</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Sprint 1 (Active)</span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Multi-role governance (`Superadmin`, `Admin`, `User`), account blocking, salted bcrypt security, and 36 granular rights catalog.
            </p>
            <div className="text-[11px] text-blue-700 font-medium">
              Tables: app_user, role, module, rights, user_permission, audit_log
            </div>
          </div>

          {/* 2. Customers */}
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="w-9 h-9 rounded-lg bg-slate-800 text-white flex items-center justify-center mb-3 shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-base">Customer Management</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">Sprint 2</span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Client registry, billing addresses, credit terms (Net 30, COD, Prepaid), soft-delete, and audit stamp generation.
            </p>
            <div className="text-[11px] text-slate-500 font-medium">
              Tables: CUSTOMER &bull; 3 Rights (customer.add/edit/delete)
            </div>
          </div>

          {/* 3. Products & Pricing */}
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="w-9 h-9 rounded-lg bg-slate-800 text-white flex items-center justify-center mb-3 shadow-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-base">Products &amp; Dynamic Pricing</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">Sprint 2</span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              SKU catalog, unit management, and chronological effective price history algorithm derived dynamically.
            </p>
            <div className="text-[11px] text-slate-500 font-medium">
              Tables: PRODUCT, PRICEHIST &bull; 6 Rights (product.*, price.*)
            </div>
          </div>

          {/* 4. Human Resources */}
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="w-9 h-9 rounded-lg bg-slate-800 text-white flex items-center justify-center mb-3 shadow-xs">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-base">Human Resources &amp; Payroll</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">Sprint 3</span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Personnel profiles, departments, job codes, career timelines, and Data Privacy Act (RA 10173) salary gating.
            </p>
            <div className="text-[11px] text-slate-500 font-medium">
              Tables: EMPLOYEE, JOB, DEPARTMENT, JOBHISTORY &bull; 13 Rights
            </div>
          </div>

          {/* 5. Sales & Distribution */}
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="w-9 h-9 rounded-lg bg-slate-800 text-white flex items-center justify-center mb-3 shadow-xs">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-base">Sales &amp; Distribution</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">Sprint 4</span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Auto-numbered transaction headers, order line item auto-pricing, live derived invoice totals, and receipt balances.
            </p>
            <div className="text-[11px] text-slate-500 font-medium">
              Tables: SALES, SALESDETAIL, PAYMENT &bull; 7 Rights
            </div>
          </div>

          {/* 6. Reports */}
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="w-9 h-9 rounded-lg bg-slate-800 text-white flex items-center justify-center mb-3 shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-base">Business Intelligence &amp; Reports</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">Sprint 4</span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Seven executive management reports (Master Product List, Active/All Staff, Top Clients, Top Products, Top Sales, Career Timelines).
            </p>
            <div className="text-[11px] text-slate-500 font-medium">
              Read-Only Relational Views &bull; 7 Rights (report.*)
            </div>
          </div>
        </div>
      </div>

      {/* Modern Tech Stack Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
            <Cloud className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg mb-1">Supabase Cloud + Local Engine</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Enterprise PostgreSQL 15 on Supabase with seamless dual-mode fallback to Hope Relational SQLite, guaranteeing zero downtime and complete local testability.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg mb-1">Next.js App Router Architecture</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Modern React 19 Server Components, TypeScript type safety, secure REST API Route Handlers, and Tailwind CSS enterprise design system.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-4">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg mb-1">Strict Server-Side RBAC (§4.2)</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Hiding buttons is only a UI convenience; the backend strictly authenticates and verifies role and right codes before processing any action.
          </p>
        </div>
      </div>
    </div>
  );
}
