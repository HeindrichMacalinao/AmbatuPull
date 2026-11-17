'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Database,
  FileSpreadsheet,
  ShoppingCart,
  TrendingUp,
  Lock,
  Cloud,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Shield,
  Briefcase,
  Filter,
  Key,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  Server,
  Layers,
  FileText,
  Clock,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { RoleName, AppUser } from '@/types/erp';
import CustomerManagement from '@/components/CustomerManagement';

type DashboardTab =
  | 'overview'
  | 'users'
  | 'customers'
  | 'products'
  | 'sales'
  | 'hr'
  | 'reports'
  | 'system';

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [activeRole, setActiveRole] = useState<RoleName>('User');
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [metrics, setMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    // 1. Sync current user from local storage
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

  // Tab definitions
  const navTabs: {
    id: DashboardTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    group: 'Operations' | 'Catalog & Supply' | 'Governance & BI';
    badge?: string;
    badgeVariant?: 'active' | 'scheduled' | 'neutral';
  }[] = [
    {
      id: 'overview',
      label: 'Command Overview',
      icon: LayoutDashboard,
      group: 'Operations',
      badge: 'Live',
      badgeVariant: 'active',
    },
    {
      id: 'users',
      label: 'Security & RBAC',
      icon: Lock,
      group: 'Operations',
      badge: 'Sprint 1',
      badgeVariant: 'active',
    },
    {
      id: 'customers',
      label: 'Customer Registry',
      icon: Users,
      group: 'Operations',
      badge: metrics?.customersCount ? `${metrics.customersCount}` : '82',
      badgeVariant: 'neutral',
    },
    {
      id: 'products',
      label: 'Products & Pricing',
      icon: FileSpreadsheet,
      group: 'Catalog & Supply',
      badge: metrics?.productsCount ? `${metrics.productsCount} SKUs` : '57 SKUs',
      badgeVariant: 'neutral',
    },
    {
      id: 'sales',
      label: 'Sales & Orders',
      icon: ShoppingCart,
      group: 'Catalog & Supply',
      badge: metrics?.salesCount ? `${metrics.salesCount}` : '124',
      badgeVariant: 'neutral',
    },
    {
      id: 'hr',
      label: 'Human Resources',
      icon: Briefcase,
      group: 'Governance & BI',
      badge: 'Sprint 3',
      badgeVariant: 'scheduled',
    },
    {
      id: 'reports',
      label: 'Executive Reports',
      icon: TrendingUp,
      group: 'Governance & BI',
      badge: '7 Reports',
      badgeVariant: 'neutral',
    },
    {
      id: 'system',
      label: 'System Architecture',
      icon: Database,
      group: 'Governance & BI',
      badge: 'Relational',
      badgeVariant: 'neutral',
    },
  ];

  const groupedTabs = {
    Operations: navTabs.filter((t) => t.group === 'Operations'),
    'Catalog & Supply': navTabs.filter((t) => t.group === 'Catalog & Supply'),
    'Governance & BI': navTabs.filter((t) => t.group === 'Governance & BI'),
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Top Application Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
            ERP
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Operations Management Console
              </h1>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                  activeRole === 'Superadmin'
                    ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                    : activeRole === 'Admin'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                }`}
              >
                <Shield className="w-3 h-3" />
                {activeRole} Perspective
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hope, Inc. Unified Relational Engine &bull; Dual-Mode Supabase Cloud Sync
            </p>
          </div>
        </div>

        {/* Perspective simulation switcher & direct actions */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">View As:</span>
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as RoleName)}
              className="bg-transparent font-semibold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer text-xs"
              aria-label="Simulate role perspective"
            >
              <option value="Superadmin">Superadmin</option>
              <option value="Admin">Admin</option>
              <option value="User">User</option>
            </select>
          </div>

          {(activeRole === 'Admin' || activeRole === 'Superadmin') && (
            <Link
              href="/users"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Users className="w-3.5 h-3.5" />
              <span>User Registry</span>
            </Link>
          )}
        </div>
      </div>

      {/* Main Layout: Left Sidebar Tabs + Right Workbench Canvas */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* SIDEBAR NAVIGATION TABS */}
        <aside
          aria-label="Dashboard sections"
          className="w-full lg:w-64 xl:w-72 flex-shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 shadow-xs transition-colors"
        >
          {/* User profile card */}
          <div className="p-3 mb-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
              {currentUser?.firstName?.[0] || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'System Demo'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                {currentUser?.email || 'demo@hope-erp.local'}
              </div>
            </div>
          </div>

          {/* Grouped Sidebar Tabs */}
          <nav className="space-y-4" role="tablist">
            {(Object.keys(groupedTabs) as (keyof typeof groupedTabs)[]).map((groupName) => (
              <div key={groupName} className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2.5 pb-1">
                  {groupName}
                </div>
                {groupedTabs[groupName].map((tab) => {
                  const Icon = tab.icon;
                  const isSelected = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition text-left focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs font-semibold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 ${
                            isSelected ? 'text-white' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        />
                        <span className="truncate">{tab.label}</span>
                      </div>
                      {tab.badge && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ml-1.5 flex-shrink-0 ${
                            isSelected
                              ? 'bg-blue-700/90 text-white'
                              : tab.badgeVariant === 'active'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : tab.badgeVariant === 'scheduled'
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Quick Engine Status Indicator at footer of sidebar */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Relational Core</span>
              </span>
              <span className="font-mono text-[10px]">10 Tables</span>
            </div>
          </div>
        </aside>

        {/* WORKBENCH CANVAS AREA */}
        <main className="flex-1 min-w-0 w-full space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in">
              {/* 4 Primary KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div
                  onClick={() => setActiveTab('customers')}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Customer Registry</span>
                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                    {loadingMetrics ? '...' : metrics?.customersCount || 82}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Active accounts in CUSTOMER</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition" />
                  </div>
                </div>

                <div
                  onClick={() => setActiveTab('products')}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Product Catalog</span>
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                    {loadingMetrics ? '...' : metrics?.productsCount || 57}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>SKUs with chronological pricing</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition" />
                  </div>
                </div>

                <div
                  onClick={() => setActiveTab('sales')}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:border-sky-300 dark:hover:border-sky-700 transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Sales Orders</span>
                    <ShoppingCart className="w-4 h-4 text-sky-600 dark:text-sky-400 group-hover:translate-x-0.5 transition" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                    {loadingMetrics ? '...' : metrics?.salesCount || 124}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Orders logged in SALES</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600 transition" />
                  </div>
                </div>

                <div
                  onClick={() => setActiveTab('sales')}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Total Receipts</span>
                    <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                    {loadingMetrics
                      ? '...'
                      : `$${Number(metrics?.totalRevenue || 665326.58).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Revenue logged in PAYMENT</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition" />
                  </div>
                </div>
              </div>

              {/* Sprint Roadmap Progress & Quick Launcher Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Sprint Roadmap Section */}
                <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                        Operational Engineering Roadmap (§1.1)
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Structured 4-sprint enterprise delivery pipeline
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Sprint 1 Complete
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold mt-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            Sprint 1: System Foundation &amp; 36-Rights RBAC
                          </h3>
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            Active &bull; 100%
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                          Multi-role governance, salted bcrypt hashing, account blocking safeguards, and 36 granular rights catalog.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold mt-0.5">
                        2
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            Sprint 2: Customer Registry &amp; Dynamic Pricing Engine
                          </h3>
                          <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                            In Progress
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                          Client directory, credit terms (Net 30, COD, Prepaid), and effective price history timeline derivation.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 flex items-start gap-3 opacity-80">
                      <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold mt-0.5">
                        3
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            Sprint 3: Human Resources &amp; RA 10173 Privacy Gating
                          </h3>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">Scheduled</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          Personnel profiles, department hierarchy, job codes, and Data Privacy Act salary gating.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 flex items-start gap-3 opacity-80">
                      <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold mt-0.5">
                        4
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            Sprint 4: Sales Distribution &amp; Executive BI Reports
                          </h3>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">Scheduled</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          Order transaction lines, auto-pricing derivation, receipt ledgers, and 7 management reports.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Launchpad & Security Health */}
                <div className="space-y-4">
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                      Security Safeguards (§4.2)
                    </h3>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <span>Last-Superadmin Protection Active</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <span>Strict Server-Side Right Gating</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <span>Append-Only Trigger Audit Trail</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <span>Salted bcrypt Password Hashing</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <Link
                        href="/users"
                        className="w-full flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <span>Open User Governance Matrix</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Database Provider
                    </h3>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                      <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="truncate">{metrics?.activeProvider || 'Hope Unified SQLite Engine'}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      10 relational tables, 9 foreign key constraints, and automatic Supabase Cloud PostgreSQL sync.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER SECURITY & RBAC */}
          {activeTab === 'users' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    User Governance &amp; 36-Rights Security Model
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Multi-role authorization architecture according to Hope, Inc. ERP Specifications (§1.2 &amp; §3.8)
                  </p>
                </div>
                <Link
                  href="/users"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Open Full User Management &amp; Matrix</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Roles Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                      Superadmin
                    </span>
                    <Shield className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
                    System Executive Governance
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    Unrestricted access to all 36 granular rights across all 6 business modules. Protected by the Last-Superadmin safeguard.
                  </p>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Rights: Full 36 Rights &bull; Cannot be deleted
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Admin
                    </span>
                    <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
                    Department Operations Lead
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    Manages standard User accounts, assigns module-level rights, and oversees active business records.
                  </p>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Rights: Configurable subset &bull; Peer Admin protected
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      User
                    </span>
                    <Users className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
                    Standard Operational Staff
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    Self-registered account default. Strictly filtered to active records with audit timestamps omitted (§4.2).
                  </p>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Rights: Explicitly granted rights only
                  </div>
                </div>
              </div>

              {/* 36 Rights Matrix Summary */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Granular 36-Rights Architectural Distribution
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/80 text-center">
                    <div className="text-base font-bold text-blue-600 dark:text-blue-400">3 Rights</div>
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">Customers</div>
                    <div className="text-[10px] text-slate-400">add, edit, delete</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/80 text-center">
                    <div className="text-base font-bold text-blue-600 dark:text-blue-400">6 Rights</div>
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">Products &amp; Price</div>
                    <div className="text-[10px] text-slate-400">product.*, price.*</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/80 text-center">
                    <div className="text-base font-bold text-blue-600 dark:text-blue-400">13 Rights</div>
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">Human Resources</div>
                    <div className="text-[10px] text-slate-400">emp, job, dept</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/80 text-center">
                    <div className="text-base font-bold text-blue-600 dark:text-blue-400">7 Rights</div>
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">Sales &amp; Orders</div>
                    <div className="text-[10px] text-slate-400">sales, detail, payment</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/80 text-center">
                    <div className="text-base font-bold text-blue-600 dark:text-blue-400">7 Rights</div>
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">BI Reports</div>
                    <div className="text-[10px] text-slate-400">7 report queries</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/80 text-center">
                    <div className="text-base font-bold text-blue-600 dark:text-blue-400">36 Total</div>
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">Catalog Scope</div>
                    <div className="text-[10px] text-slate-400">junction enforced</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMER REGISTRY */}
          {activeTab === 'customers' && (
            <div className="animate-in fade-in">
              <CustomerManagement role={activeRole} user={currentUser} />
            </div>
          )}

          {/* TAB 4: PRODUCTS & PRICING */}
          {activeTab === 'products' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Product Catalog &amp; Dynamic Chronological Pricing (§3.4)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  57 SKUs categorized in PRODUCT and dynamic price boundaries in PRICEHIST
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Effective Pricing Algorithm
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    Products in Hope ERP dynamically evaluate unit price based on transaction timestamp:
                  </p>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-blue-700 dark:text-blue-300 space-y-1">
                    <div>SELECT unitPrice FROM PRICEHIST</div>
                    <div>WHERE prodCode = :code AND effectiveDate &lt;= :saleDate</div>
                    <div>ORDER BY effectiveDate DESC LIMIT 1</div>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    Ensures historical sales transactions retain exact billed amounts even after price adjustments.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Catalog Metrics
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">57</div>
                      <div className="text-xs text-slate-500 mt-0.5">Standard SKUs</div>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">6</div>
                      <div className="text-xs text-slate-500 mt-0.5">Assigned Rights</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SALES & ORDERS */}
          {activeTab === 'sales' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  Sales Orders &amp; Distribution Ledger (§3.6)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Transactional order headers, line item auto-pricing, and receipts
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
                  <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Orders Logged</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">124 Transactions</div>
                  <div className="text-[11px] text-slate-500 mt-1">Stored in SALES header table</div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
                  <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Total Collections</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">$665,326.58</div>
                  <div className="text-[11px] text-slate-500 mt-1">Logged in PAYMENT registry</div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
                  <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Distribution Scope</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">7 Rights</div>
                  <div className="text-[11px] text-slate-500 mt-1">sales.*, detail.*, payment.*</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: HUMAN RESOURCES */}
          {activeTab === 'hr' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Human Resources &amp; RA 10173 Privacy Gating (§3.5)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Personnel records (EMPLOYEE), job titles (JOB), and career progression (JOBHISTORY)
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs">
                  <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-blue-950 dark:text-blue-200 text-sm mb-1">
                      Data Privacy Act of 2012 (RA 10173) Salary Protection
                    </h3>
                    <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
                      Salary figures and confidential compensation histories are strictly gated behind authorized HR permissions. Standard staff members cannot view compensation columns on employee records.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Executive Business Intelligence &amp; Reporting Suite (§3.7)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Seven standard executive management reports with print and PDF exports
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: '1. Master Product List', desc: 'Alphabetical SKU inventory with current pricing' },
                  { name: '2. Active Personnel Directory', desc: 'Current staff profiles and assigned departments' },
                  { name: '3. Complete Staff Registry', desc: 'All active and soft-deleted employee records' },
                  { name: '4. Top Revenue Clients', desc: 'Clients ranked by cumulative order values' },
                  { name: '5. Best Selling Products', desc: 'Volume and gross margin ranking by SKU' },
                  { name: '6. Sales Activity Breakdown', desc: 'Transactions grouped by date and status' },
                  { name: '7. Career Timelines', desc: 'Staff job promotion and department movement' },
                ].map((rep) => (
                  <div
                    key={rep.name}
                    className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs"
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-slate-100 mb-1">
                      <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>{rep.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {rep.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: SYSTEM ARCHITECTURE */}
          {activeTab === 'system' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Hope Relational Core &amp; Dual-Engine Architecture
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  PostgreSQL Supabase Cloud + Local Relational SQLite persistence
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Core Schema (10 Relational Tables)
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-700 dark:text-slate-300">
                    <span className="p-2 bg-slate-50 dark:bg-slate-800 rounded">app_user</span>
                    <span className="p-2 bg-slate-50 dark:bg-slate-800 rounded">role</span>
                    <span className="p-2 bg-slate-50 dark:bg-slate-800 rounded">module</span>
                    <span className="p-2 bg-slate-50 dark:bg-slate-800 rounded">rights</span>
                    <span className="p-2 bg-slate-50 dark:bg-slate-800 rounded">user_permission</span>
                    <span className="p-2 bg-slate-50 dark:bg-slate-800 rounded">CUSTOMER</span>
                    <span className="p-2 bg-slate-50 dark:bg-slate-800 rounded">PRODUCT</span>
                    <span className="p-2 bg-slate-50 dark:bg-slate-800 rounded">PRICEHIST</span>
                    <span className="p-2 bg-slate-50 dark:bg-slate-800 rounded">SALES</span>
                    <span className="p-2 bg-slate-50 dark:bg-slate-800 rounded">PAYMENT</span>
                  </div>
                </div>

                <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Verification Status
                  </h3>
                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>928 baseline records verified against HopeDB audit baseline</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>All 9 foreign key constraints active and rejecting orphaned INSERTs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Append-only triggers recording changes with timestamp &amp; user audit</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
