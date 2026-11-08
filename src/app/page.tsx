import Link from 'next/link';
import { ShieldCheck, Users, Database, Layers, CheckCircle2, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 mb-4 border border-blue-200">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          Sprint 1 Complete &bull; Upgraded to Supabase + Next.js + Vercel
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          Hope, Inc. ERP Foundation
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-8">
          Enterprise resource planning system featuring granular 36-rights RBAC, 
          multi-role governance, and PostgreSQL database architecture on Supabase.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 shadow-sm transition"
          >
            Access System
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition"
          >
            Explore Dashboard
          </Link>
          <Link
            href="/users"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition"
          >
            User Management &amp; Rights
          </Link>
        </div>
      </div>

      {/* Tech Stack Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-900 text-lg mb-2">Supabase PostgreSQL</h3>
          <p className="text-sm text-slate-600">
            Unified relational schema with 10 foundation tables, 36 seeded rights catalogue, and audit logging.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-900 text-lg mb-2">Next.js App Router &amp; TS</h3>
          <p className="text-sm text-slate-600">
            Server Components, TypeScript type-safety, API route handlers, and Tailwind CSS design system.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-4">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-900 text-lg mb-2">Vercel Deployment</h3>
          <p className="text-sm text-slate-600">
            Native, edge-ready continuous deployment directly from Git branches with instant preview environments.
          </p>
        </div>
      </div>

      {/* 6 Modules Architecture */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">6-Module ERP Roadmap</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: 'User Management & Security',
              badge: 'Sprint 1 (Active)',
              badgeColor: 'bg-emerald-100 text-emerald-800',
              desc: 'Authentication, 3 roles, account blocking, 36-rights matrix, and audit logging.',
            },
            {
              title: 'Customers',
              badge: 'Sprint 2',
              badgeColor: 'bg-slate-100 text-slate-700',
              desc: 'Client registry, billing addresses, credit terms, soft-delete & restore.',
            },
            {
              title: 'Products & Pricing',
              badge: 'Sprint 2',
              badgeColor: 'bg-slate-100 text-slate-700',
              desc: 'Catalog, units, and chronological effective price history lookup.',
            },
            {
              title: 'Human Resources',
              badge: 'Sprint 3',
              badgeColor: 'bg-slate-100 text-slate-700',
              desc: 'Departments, job titles, personnel registry, salary tracking under RA 10173.',
            },
            {
              title: 'Sales & Payments',
              badge: 'Sprint 4',
              badgeColor: 'bg-slate-100 text-slate-700',
              desc: 'Sales orders, line-item pricing derived at sale date, and payment recording.',
            },
            {
              title: 'BI & Reports',
              badge: 'Sprint 4',
              badgeColor: 'bg-slate-100 text-slate-700',
              desc: '7 core operational and management reports with PDF export capabilities.',
            },
          ].map((m, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-800 text-sm">{m.title}</span>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${m.badgeColor}`}>
                  {m.badge}
                </span>
              </div>
              <p className="text-xs text-slate-600">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
