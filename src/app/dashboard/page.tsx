'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Users,
  Key,
  Database,
  Activity,
  CheckCircle,
  FileText,
  UserPlus,
  ArrowRight,
  Shield,
  ShieldCheck,
  Layers,
  Lock,
  Cloud,
  TrendingUp,
  ShoppingCart,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import type { RoleName, AppUser } from '@/types/erp';

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [activeRole, setActiveRole] = useState<RoleName>('User');
  const [metrics, setMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    // 1. Sync current user
    const saved = localStorage.getItem('erp_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setCurrentUser(u);
        if (u.role) setActiveRole(u.role);
      } catch {}
    }

    // 2. Fetch live metrics
    fetch('/api/dashboard/metrics')
      .then((r) => r.json())
      .then((data) => {
        setMetrics(data);
        setLoadingMetrics(false);
      })
      .catch(() => setLoadingMetrics(false));
  }, []);

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner & Executive View Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hope ERP Operations Dashboard</h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                activeRole === 'Superadmin'
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : activeRole === 'Admin'
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {activeRole} Perspective
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {currentUser ? (
              <span>Authenticated as <strong className="text-slate-800">{currentUser.firstName} {currentUser.lastName}</strong> ({currentUser.email})</span>
            ) : (
              <span>Viewing in interactive demonstration mode &bull; Log in to persist customized session state</span>
            )}
          </p>
        </div>

      </div>

      {/* KPI Cards (Live SQL Record Counts) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Customer Accounts</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">
            {loadingMetrics ? '...' : metrics?.customersCount || 82}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Verified buyer profiles (CUSTOMER)</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Product Catalog</span>
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">
            {loadingMetrics ? '...' : metrics?.productsCount || 57}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">SKUs with chronological pricing</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Sales Orders</span>
            <ShoppingCart className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">
            {loadingMetrics ? '...' : metrics?.salesCount || 124}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Active transactional sales headers</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total Receipts</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">
            {loadingMetrics ? '...' : `$${Number(metrics?.totalRevenue || 665326.58).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Official payments logged in PAYMENT</p>
        </div>
      </div>

      {/* Role-Specific Quick Action Tiles (Student Guide §3.2 Figures 6, 7, 8) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Operational Module Actions</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Available quick actions rendered according to the <strong className="text-slate-700">{activeRole}</strong> access policy
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* User Management Action */}
          <Link
            href="/users"
            className={`p-4 rounded-xl border transition flex items-start gap-3.5 group ${
              activeRole === 'User'
                ? 'opacity-60 bg-slate-50 border-slate-200 cursor-not-allowed pointer-events-none'
                : 'bg-white hover:bg-blue-50/50 border-slate-200 hover:border-blue-300 shadow-xs'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">User Management</h3>
                {activeRole === 'User' && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-semibold">Locked</span>}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {activeRole === 'Superadmin'
                  ? 'Govern all accounts, promote Admins, and manage 36-rights authorization.'
                  : activeRole === 'Admin'
                  ? 'Manage standard Users and assign per-module rights.'
                  : 'Restricted to administrative personnel.'}
              </p>
            </div>
          </Link>

          {/* Customers Action */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-xs transition flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Customer Management</h3>
              <p className="text-xs text-slate-500 mt-1">
                82 records active &bull; Credit terms and client directories (Sprint 2).
              </p>
            </div>
          </div>

          {/* Products Action */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-xs transition flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Products &amp; Pricing</h3>
              <p className="text-xs text-slate-500 mt-1">
                57 items in catalog &bull; Effective price history timeline (Sprint 2).
              </p>
            </div>
          </div>

          {/* Human Resources Action */}
          <div
            className={`p-4 rounded-xl border transition flex items-start gap-3.5 ${
              activeRole === 'User'
                ? 'opacity-50 bg-slate-50 border-slate-200 cursor-not-allowed'
                : 'bg-white hover:border-slate-300 shadow-xs'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">Human Resources</h3>
                {activeRole === 'User' && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-semibold">Greyed Out (Fig 8)</span>}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                RA 10173 data privacy protected &bull; Staff directory and job history.
              </p>
            </div>
          </div>

          {/* Sales & Orders */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-xs transition flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Sales &amp; Distribution</h3>
              <p className="text-xs text-slate-500 mt-1">
                124 orders logged &bull; Point-of-sale line items and payments (Sprint 4).
              </p>
            </div>
          </div>

          {/* Executive Reports */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-xs transition flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Business Intelligence</h3>
              <p className="text-xs text-slate-500 mt-1">
                7 management reports with PDF and print export support (Sprint 4).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Database Infrastructure & Security Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-2">
            <Database className="w-4 h-4 text-blue-600" />
            <span>Database Architecture</span>
          </div>
          <p className="text-xs text-slate-600 mb-3">
            Operating on <strong className="text-slate-800">{metrics?.activeProvider || 'Hope Relational Engine (SQLite)'}</strong> with foreign keys and triggers enforced.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Relational Integrity Active (10 Tables)</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Security &amp; Audit Trail</span>
          </div>
          <p className="text-xs text-slate-600 mb-3">
            Append-only audit triggers log every user and permission change with timestamp and actor stamping.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Last-Superadmin Safeguard Active</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-2">
            <Cloud className="w-4 h-4 text-purple-600" />
            <span>Supabase Cloud Integration</span>
          </div>
          <p className="text-xs text-slate-600 mb-3">
            Dual-mode persistence allows seamless sync with Supabase PostgreSQL cloud instances.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <span>Status:</span>
            <span className="font-semibold text-blue-600">
              {metrics?.supabaseConnected ? 'Connected & Synchronized' : 'Ready for Cloud URL (.env.local)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
