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
  Layers,
  Lock,
} from 'lucide-react';

export default function DashboardPage() {
  const [activeRole, setActiveRole] = useState<'Superadmin' | 'Admin' | 'User'>('Superadmin');
  const [healthStatus, setHealthStatus] = useState<any>(null);

  useEffect(() => {
    // Check local storage for authenticated user
    const saved = localStorage.getItem('erp_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u.role) setActiveRole(u.role);
      } catch {}
    }

    // Check health endpoint
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => setHealthStatus(data))
      .catch(() => {});
  }, []);

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner & Role View Switcher */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">ERP Main Dashboard</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                activeRole === 'Superadmin'
                  ? 'bg-purple-100 text-purple-800'
                  : activeRole === 'Admin'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {activeRole} View
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            System Foundation, Role Governance &amp; Granular Permission Control
          </p>
        </div>

        {/* View Switcher for Demo & Testing */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
          <span className="text-xs font-medium text-slate-500 px-2">Preview Role:</span>
          {(['Superadmin', 'Admin', 'User'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                activeRole === role
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Foundation Users</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">3 Active</h3>
            <p className="text-xs text-slate-400 mt-0.5">Superadmin, Admin, User</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Granular Rights</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">36 Rights</h3>
            <p className="text-xs text-slate-400 mt-0.5">Seeded across 5 modules</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Key className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Database Driver</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {healthStatus?.supabase?.connected ? 'Supabase' : 'PostgreSQL'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">10 Foundation Tables</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Security State</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">Enforced</h3>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Last-Admin Safeguard On</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Role-Specific Content */}
      {activeRole === 'Superadmin' && (
        <div className="bg-gradient-to-r from-purple-900/10 via-white to-white p-6 rounded-xl border border-purple-200/80 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-purple-700" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Superadmin Governance Suite</h2>
              <p className="text-xs text-slate-500">
                Exclusive superuser privileges: accounts management, role changes, lockout protection &amp; system audit.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <Link
              href="/users"
              className="p-4 bg-white rounded-lg border border-purple-200 hover:border-purple-400 hover:shadow-sm transition flex items-center justify-between group"
            >
              <div>
                <p className="font-semibold text-slate-900 text-sm">Manage Users &amp; Roles</p>
                <p className="text-xs text-slate-500 mt-1">Assign roles, block/unblock accounts</p>
              </div>
              <ArrowRight className="w-4 h-4 text-purple-600 group-hover:translate-x-1 transition" />
            </Link>

            <Link
              href="/users"
              className="p-4 bg-white rounded-lg border border-purple-200 hover:border-purple-400 hover:shadow-sm transition flex items-center justify-between group"
            >
              <div>
                <p className="font-semibold text-slate-900 text-sm">36 Granular Rights Matrix</p>
                <p className="text-xs text-slate-500 mt-1">Configure permissions per user</p>
              </div>
              <ArrowRight className="w-4 h-4 text-purple-600 group-hover:translate-x-1 transition" />
            </Link>

            <div className="p-4 bg-purple-50/60 rounded-lg border border-purple-200">
              <p className="font-semibold text-purple-900 text-sm">Last-Superadmin Rule</p>
              <p className="text-xs text-purple-700 mt-1">
                System prevents blocking or removing the last active Superadmin automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeRole === 'Admin' && (
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-blue-700" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Department Administrator Panel</h2>
              <p className="text-xs text-slate-500">
                Manage operational departmental records and personnel profiles.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="font-semibold text-slate-800 text-sm">Operations Roster</p>
              <p className="text-xs text-slate-500 mt-1">View assigned personnel and module states</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="font-semibold text-slate-800 text-sm">Audit Trails</p>
              <p className="text-xs text-slate-500 mt-1">View departmental activity timestamps</p>
            </div>
          </div>
        </div>
      )}

      {activeRole === 'User' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Standard User Workspace</h2>
              <p className="text-xs text-slate-500">
                You have standard operational rights based on your department permissions.
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Sprint 1 focuses on authentication and permission governance. As modules in Sprints 2-4 are unlocked (Customers, Products, HR, Sales, Reports), they will appear here according to your granted rights!
          </p>
        </div>
      )}

      {/* 6 Modules Status Overview */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">ERP Modules Architecture</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              name: 'User Management & Security',
              sprint: 'Sprint 1',
              status: 'Completed',
              color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
              rights: '36 Seeded Rights & Superadmin Governance',
            },
            {
              name: 'Customer Registry',
              sprint: 'Sprint 2',
              status: 'Upcoming',
              color: 'text-slate-600 bg-slate-50 border-slate-200',
              rights: 'customer.add, customer.edit, customer.delete',
            },
            {
              name: 'Products & Effective Pricing',
              sprint: 'Sprint 2',
              status: 'Upcoming',
              color: 'text-slate-600 bg-slate-50 border-slate-200',
              rights: 'product.*, price.* (6 rights)',
            },
            {
              name: 'Human Resources (RA 10173)',
              sprint: 'Sprint 3',
              status: 'Upcoming',
              color: 'text-slate-600 bg-slate-50 border-slate-200',
              rights: 'emp.*, dept.*, job.*, jobhistory.* (13 rights)',
            },
            {
              name: 'Sales & Payments Processing',
              sprint: 'Sprint 4',
              status: 'Upcoming',
              color: 'text-slate-600 bg-slate-50 border-slate-200',
              rights: 'sale.*, saledetail.* (7 rights)',
            },
            {
              name: 'BI & System Reports',
              sprint: 'Sprint 4',
              status: 'Upcoming',
              color: 'text-slate-600 bg-slate-50 border-slate-200',
              rights: 'report.* (7 rights with PDF export)',
            },
          ].map((m, i) => (
            <div key={i} className={`p-4 rounded-xl border ${m.color}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-900 text-sm">{m.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/80 border border-slate-200">
                  {m.sprint}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">{m.rights}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
