'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BriefcaseBusiness,
  Building2,
  LoaderCircle,
  Users,
} from 'lucide-react';
import type { AppUser, RoleName } from '@/types/erp';
import JobManagement from '@/components/JobManagement';
import DepartmentManagement from '@/components/DepartmentManagement';

type HrTab = 'Employees' | 'Jobs' | 'Departments';
type StatusFilter = 'Active' | 'Inactive' | 'All';

interface HumanResourcesManagementProps {
  role: RoleName;
  user: AppUser | null;
}

const tabs: { id: HrTab; label: HrTab; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'Employees', label: 'Employees', icon: Users },
  { id: 'Jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { id: 'Departments', label: 'Departments', icon: Building2 },
];

function isRoleName(value: unknown): value is RoleName {
  return value === 'Superadmin' || value === 'Admin' || value === 'User';
}

export default function HumanResourcesManagement({
  role,
  user,
}: HumanResourcesManagementProps) {
  const [activeTab, setActiveTab] = useState<HrTab>('Employees');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Active');
  const [sessionRole, setSessionRole] = useState<RoleName | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const controller = new AbortController();

    if (!user?.userId) {
      setSessionRole(null);
      setSessionError('No authenticated session is available.');
      setSessionLoading(false);
      return () => controller.abort();
    }

    setSessionLoading(true);
    setSessionError('');
    const sessionRoleHeader = role === user.role ? role : user.role;

    fetch('/api/auth/session', {
      headers: {
        'x-user-role': sessionRoleHeader,
        'x-user-id': String(user.userId),
        'x-user-email': user.email,
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to verify the HR session.');

        const resolvedRole = isRoleName(data.role) ? data.role : null;
        if (!resolvedRole) throw new Error('The authenticated role is unavailable.');
        setSessionRole(resolvedRole);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setSessionRole(null);
        setSessionError(
          error instanceof Error ? error.message : 'Unable to verify the HR session.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setSessionLoading(false);
      });

    return () => controller.abort();
  }, [role, user?.userId, user?.email, user?.role]);

  const isPrivileged = sessionRole === 'Admin' || sessionRole === 'Superadmin';

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + direction + tabs.length) % tabs.length;
    setActiveTab(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  if (sessionLoading) {
    return (
      <div
        className="flex min-h-48 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
        role="status"
      >
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        Verifying HR session...
      </div>
    );
  }

  if (!sessionRole) {
    return (
      <div
        className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        role="alert"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <div>
          <p className="font-bold">HR access requires a resolved session.</p>
          <p className="mt-1 text-xs">{sessionError}</p>
        </div>
      </div>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900"
      aria-label="Human Resources Management"
    >
      <header className="border-b border-slate-200 p-4 sm:p-5 dark:border-slate-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BriefcaseBusiness className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Human Resources Management
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Personnel, jobs, and department records
            </p>
          </div>

          {isPrivileged ? (
            <div className="min-w-0">
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="radiogroup"
                aria-label="Record status filter"
              >
                {(['Active', 'Inactive', 'All'] as StatusFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    role="radio"
                    aria-checked={statusFilter === filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      statusFilter === filter
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-slate-100'
                    }`}
                  >
                    <span>{filter}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <span className="inline-flex self-start rounded border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
              {sessionRole} view
            </span>
          )}
        </div>
      </header>

      <nav
        className="flex overflow-x-auto border-b border-slate-200 px-2 sm:px-4 dark:border-slate-800"
        role="tablist"
        aria-label="Human Resources sections"
      >
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`hr-tab-${tab.id.toLowerCase()}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`hr-panel-${tab.id.toLowerCase()}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`flex min-w-fit items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition sm:px-4 ${
                isSelected
                  ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div
        id={`hr-panel-${activeTab.toLowerCase()}`}
        role="tabpanel"
        aria-labelledby={`hr-tab-${activeTab.toLowerCase()}`}
        className="p-4 sm:p-5"
      >
        {activeTab === 'Employees' && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/40">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Employees</h3>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Employee management will be available in its corresponding Sprint 3 task.
            </p>
          </div>
        )}
        {activeTab === 'Jobs' && (
          <JobManagement role={sessionRole} user={user} statusFilter={statusFilter} />
        )}
        {activeTab === 'Departments' && (
          <DepartmentManagement role={sessionRole} user={user} statusFilter={statusFilter} />
        )}
      </div>
    </section>
  );
}
