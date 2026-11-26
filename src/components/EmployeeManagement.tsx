'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { History, Plus, Search, X } from 'lucide-react';
import type { AppUser, RoleName } from '@/types/erp';
import JobHistoryModal from '@/components/JobHistoryModal';

type StatusFilter = 'Active' | 'Inactive' | 'All';

interface EmployeeRecord {
  empNo: string;
  lastName: string | null;
  firstName: string | null;
  gender: string | null;
  birthDate: string | null;
  hireDate: string | null;
  sepDate: string | null;
  status?: 'Active' | 'Inactive';
  stamp?: string;
}

function requestHeaders(role: RoleName, user: AppUser | null) {
  const headers: Record<string, string> = { 'x-user-role': role };
  if (user?.email) headers['x-user-email'] = user.email;
  if (user?.userId) headers['x-user-id'] = String(user.userId);
  return headers;
}

async function readError(response: Response) {
  try {
    const data = await response.json();
    return data.error || data.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

export default function EmployeeManagement({
  role,
  user,
  statusFilter,
}: {
  role: RoleName;
  user: AppUser | null;
  statusFilter: StatusFilter;
}) {
  const isAdmin = role === 'Admin' || role === 'Superadmin';
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rights, setRights] = useState<string[]>([]);
  const [rightsLoading, setRightsLoading] = useState(false);
  const [rightsError, setRightsError] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [selected, setSelected] = useState<EmployeeRecord | null>(null);
  const [empNo, setEmpNo] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [gender, setGender] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [sepDate, setSepDate] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ employee: EmployeeRecord; action: 'delete' | 'restore' } | null>(null);
  const [confirmationSubmitting, setConfirmationSubmitting] = useState(false);
  const [historyEmployee, setHistoryEmployee] = useState<EmployeeRecord | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (role !== 'User' || !user?.userId) {
      setRights([]);
      setRightsError(false);
      setRightsLoading(false);
      return;
    }
    const controller = new AbortController();
    setRightsLoading(true);
    fetch(`/api/users/${user.userId}/rights`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load permissions');
        setRights(Array.isArray(data.grantedRights) ? data.grantedRights : []);
        setRightsError(false);
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === 'AbortError') return;
        setRights([]);
        setRightsError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRightsLoading(false);
      });
    return () => controller.abort();
  }, [role, user?.userId]);

  const loadEmployees = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    params.set('status', isAdmin ? statusFilter.toLowerCase() : 'active');
    try {
      const response = await fetch(`/api/hr/employees?${params.toString()}`, {
        headers: requestHeaders(role, user),
        signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load employees');
      if (!Array.isArray(data.employees)) throw new Error('The employees API returned an invalid response.');
      setEmployees(data.employees);
    } catch (caught: unknown) {
      if (caught instanceof Error && caught.name === 'AbortError') return;
      setEmployees([]);
      setError(caught instanceof Error ? caught.message : 'Failed to load employees');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [isAdmin, role, search, statusFilter, user]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void loadEmployees(controller.signal), 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadEmployees]);

  const openForm = (mode: 'add' | 'edit', employee?: EmployeeRecord) => {
    setFormMode(mode);
    setSelected(employee || null);
    setEmpNo(employee?.empNo || '');
    setLastName(employee?.lastName || '');
    setFirstName(employee?.firstName || '');
    setGender(employee?.gender || '');
    setBirthDate(employee?.birthDate || '');
    setHireDate(employee?.hireDate || '');
    setSepDate(employee?.sepDate || '');
    setFormErrors({});
  };

  const closeForm = () => {
    if (!submitting) {
      setFormMode(null);
      setSelected(null);
      setFormErrors({});
    }
  };

  const clearFormError = (field: string) => {
    setFormErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validateForm = () => {
    const next: Record<string, string> = {};
    if (!empNo.trim()) next.empNo = 'Employee number is required.';
    if (empNo.trim().length > 10) next.empNo = 'Employee number must not exceed 10 characters.';
    if (!lastName.trim()) next.lastName = 'Last name is required.';
    if (!firstName.trim()) next.firstName = 'First name is required.';
    if (!gender) next.gender = 'Gender is required.';
    if (!birthDate) next.birthDate = 'Birth date is required.';
    if (!hireDate) next.hireDate = 'Hire date is required.';
    if (birthDate && hireDate && birthDate >= hireDate) {
      next.birthDate = 'Birth date must be earlier than hire date.';
    }
    if (sepDate && hireDate && sepDate < hireDate) {
      next.sepDate = 'Separation date must be on or after hire date.';
    }
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm() || submitting) return;

    setSubmitting(true);
    try {
      const editing = formMode === 'edit';
      const response = await fetch(
        editing
          ? `/api/hr/employees/${encodeURIComponent(selected?.empNo || '')}`
          : '/api/hr/employees',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', ...requestHeaders(role, user) },
          body: JSON.stringify({
            empNo: empNo.trim(),
            lastName: lastName.trim(),
            firstName: firstName.trim(),
            gender,
            birthDate,
            hireDate,
            sepDate: sepDate || null,
          }),
        }
      );
      if (!response.ok) throw new Error(await readError(response));
      await loadEmployees();
      setFormMode(null);
      setSelected(null);
      setFormErrors({});
      showToast(
        'success',
        editing ? 'Employee updated successfully.' : 'Employee created successfully.'
      );
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : 'Unable to save employee.';
      setFormErrors({ server: message });
      showToast('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const canAdd = isAdmin || (role === 'User' && rights.includes('emp.add') && !rightsLoading && !rightsError);
  const canEdit = isAdmin || (role === 'User' && rights.includes('emp.edit') && !rightsLoading && !rightsError);
  const canDelete = isAdmin || (role === 'User' && rights.includes('emp.delete') && !rightsLoading && !rightsError);
  const canViewHistory = isAdmin || (role === 'User' && rights.includes('jobhistory.view') && !rightsLoading && !rightsError);
  const visibleCount = useMemo(
    () => `${employees.length} employee${employees.length === 1 ? '' : 's'}`,
    [employees.length]
  );

  const confirmMutation = async () => {
    if (!confirmation) return;
    setConfirmationSubmitting(true);
    try {
      const restoring = confirmation.action === 'restore';
      const response = await fetch(
        restoring
          ? `/api/hr/employees/${encodeURIComponent(confirmation.employee.empNo)}/restore`
          : `/api/hr/employees/${encodeURIComponent(confirmation.employee.empNo)}`,
        { method: restoring ? 'PUT' : 'DELETE', headers: requestHeaders(role, user) }
      );
      if (!response.ok) throw new Error(await readError(response));
      await loadEmployees();
      setConfirmation(null);
      showToast(
        'success',
        restoring ? 'Employee restored successfully.' : 'Employee deleted successfully.'
      );
    } catch (caught: unknown) {
      showToast('error', caught instanceof Error ? caught.message : 'Unable to update employee.');
    } finally {
      setConfirmationSubmitting(false);
    }
  };

  return (
    <section className="space-y-4" aria-labelledby="employee-management-title">
      {toast && (
        <div
          role="status"
          className={`fixed right-4 top-4 z-[70] rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 id="employee-management-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
            Employee Master Registry
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Manage employee personal and employment records.
          </p>
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={() => openForm('add')}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Add Employee
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Search employees"
            placeholder="Search employee number or name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        {isAdmin && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{visibleCount}</span>
        )}
      </div>

      {role === 'User' && rightsError && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Employee permissions could not be loaded. Restricted actions are unavailable.
        </p>
      )}
      {role === 'User' && rightsLoading && (
        <p role="status" className="text-sm text-slate-500">Loading employee permissions…</p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[1180px] text-left text-sm text-slate-600 dark:text-slate-300">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">EMP NO</th>
              <th className="px-4 py-3">LAST NAME</th>
              <th className="px-4 py-3">FIRST NAME</th>
              <th className="px-4 py-3">GENDER</th>
              <th className="whitespace-nowrap px-4 py-3">BIRTH DATE</th>
              <th className="whitespace-nowrap px-4 py-3">HIRE DATE</th>
              <th className="whitespace-nowrap px-4 py-3">SEP DATE</th>
              {isAdmin && (
                <>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3">STAMP</th>
                </>
              )}
              <th className="px-4 py-3 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={isAdmin ? 10 : 8} className="px-4 py-5">
                  <div className="space-y-3">
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="grid grid-cols-6 gap-4">
                        {[0, 1, 2, 3, 4, 5].map((cell) => (
                          <span key={cell} className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                        ))}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 10 : 8} className="px-4 py-10 text-center text-slate-500">
                  {error
                    ? 'Employees unavailable.'
                    : search.trim()
                      ? 'No matching records found.'
                      : statusFilter !== 'All'
                        ? 'No records match the selected filters.'
                        : 'No records available yet.'}
                </td>
              </tr>
            ) : (
              employees.map((employee) => {
                const status = employee.status || 'Active';
                return (
                  <tr
                    key={employee.empNo}
                    className={
                      status === 'Inactive'
                        ? 'bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300'
                        : 'transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {employee.empNo}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                      {employee.lastName || '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                      {employee.firstName || '—'}
                    </td>
                    <td className="px-4 py-3">{employee.gender || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(employee.birthDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(employee.hireDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(employee.sepDate)}</td>
                    {isAdmin && (
                      <>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              status === 'Active'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                          {employee.stamp || '—'}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canViewHistory && (
                          <button
                            type="button"
                            onClick={() => setHistoryEmployee(employee)}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                          >
                            <History className="h-3.5 w-3.5" />
                            History
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openForm('edit', employee)}
                            className="h-8 rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                          >
                            Edit
                          </button>
                        )}
                        {status === 'Inactive' && isAdmin ? (
                          <button
                            type="button"
                            onClick={() => setConfirmation({ employee, action: 'restore' })}
                            className="h-8 rounded-md border border-emerald-200 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
                          >
                            Restore
                          </button>
                        ) : (
                          canDelete && status === 'Active' && (
                            <button
                              type="button"
                              onClick={() => setConfirmation({ employee, action: 'delete' })}
                              className="h-8 rounded-md border border-rose-200 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300"
                            >
                              Delete
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {formMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="presentation"
          onMouseDown={(event) => event.currentTarget === event.target && closeForm()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-form-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <h2 id="employee-form-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                {formMode === 'add' ? 'Add Employee' : `Edit ${selected?.empNo}`}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                aria-label="Close dialog"
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitForm}>
              <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
                {formErrors.server && (
                  <p role="alert" className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                    {formErrors.server}
                  </p>
                )}
                <div>
                  <label htmlFor="empNo" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Employee Number *
                  </label>
                  <input
                    id="empNo"
                    value={empNo}
                    disabled={formMode === 'edit' || submitting}
                    onChange={(event) => {
                      setEmpNo(event.target.value);
                      clearFormError('empNo');
                    }}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {formErrors.empNo && <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{formErrors.empNo}</p>}
                </div>
                <div>
                  <label htmlFor="gender" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Gender *
                  </label>
                  <select
                    id="gender"
                    value={gender}
                    disabled={submitting}
                    onChange={(event) => {
                      setGender(event.target.value);
                      clearFormError('gender');
                    }}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">Select gender</option>
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                  {formErrors.gender && <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{formErrors.gender}</p>}
                </div>
                <div>
                  <label htmlFor="lastName" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Last Name *
                  </label>
                  <input
                    id="lastName"
                    value={lastName}
                    disabled={submitting}
                    onChange={(event) => {
                      setLastName(event.target.value);
                      clearFormError('lastName');
                    }}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {formErrors.lastName && <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{formErrors.lastName}</p>}
                </div>
                <div>
                  <label htmlFor="firstName" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    First Name *
                  </label>
                  <input
                    id="firstName"
                    value={firstName}
                    disabled={submitting}
                    onChange={(event) => {
                      setFirstName(event.target.value);
                      clearFormError('firstName');
                    }}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {formErrors.firstName && <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{formErrors.firstName}</p>}
                </div>
                <div>
                  <label htmlFor="birthDate" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Birth Date *
                  </label>
                  <input
                    id="birthDate"
                    type="date"
                    value={birthDate}
                    disabled={submitting}
                    onChange={(event) => {
                      setBirthDate(event.target.value);
                      clearFormError('birthDate');
                    }}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {formErrors.birthDate && <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{formErrors.birthDate}</p>}
                </div>
                <div>
                  <label htmlFor="hireDate" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Hire Date *
                  </label>
                  <input
                    id="hireDate"
                    type="date"
                    value={hireDate}
                    disabled={submitting}
                    onChange={(event) => {
                      setHireDate(event.target.value);
                      clearFormError('hireDate');
                    }}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {formErrors.hireDate && <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{formErrors.hireDate}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="sepDate" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Separation Date
                  </label>
                  <input
                    id="sepDate"
                    type="date"
                    value={sepDate}
                    disabled={submitting}
                    onChange={(event) => {
                      setSepDate(event.target.value);
                      clearFormError('sepDate');
                    }}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {formErrors.sepDate && <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{formErrors.sepDate}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={submitting}
                  className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Saving…' : formMode === 'add' ? 'Add Employee' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmation && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/50 p-4">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="px-5 py-5">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {confirmation.action === 'delete'
                  ? `Soft-delete employee ${confirmation.employee.empNo}? The database record will be kept and marked inactive.`
                  : `Restore employee ${confirmation.employee.empNo}? It will become active again.`}
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
              <button
                type="button"
                disabled={confirmationSubmitting}
                onClick={() => setConfirmation(null)}
                className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmationSubmitting}
                onClick={() => void confirmMutation()}
                className={`h-10 rounded-lg px-4 text-sm font-semibold text-white ${confirmation.action === 'delete' ? 'bg-rose-600' : 'bg-emerald-600'}`}
              >
                {confirmationSubmitting ? 'Saving…' : confirmation.action === 'delete' ? 'Delete' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyEmployee && (
        <JobHistoryModal
          employee={historyEmployee}
          role={role}
          user={user}
          onClose={() => setHistoryEmployee(null)}
        />
      )}
    </section>
  );
}
