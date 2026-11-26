'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import type { AppUser, RoleName } from '@/types/erp';

type StatusFilter = 'Active' | 'Inactive' | 'All';
interface DepartmentRecord {
  deptCode: string;
  deptName: string | null;
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

export default function DepartmentManagement({
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
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rights, setRights] = useState<string[]>([]);
  const [rightsLoading, setRightsLoading] = useState(false);
  const [rightsError, setRightsError] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [selected, setSelected] = useState<DepartmentRecord | null>(null);
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ department: DepartmentRecord; action: 'delete' | 'restore' } | null>(null);
  const [confirmationSubmitting, setConfirmationSubmitting] = useState(false);
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

  const loadDepartments = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    params.set('status', isAdmin ? statusFilter.toLowerCase() : 'active');
    try {
      const response = await fetch(`/api/hr/departments?${params.toString()}`, {
        headers: requestHeaders(role, user),
        signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load departments');
      if (!Array.isArray(data.departments)) throw new Error('The departments API returned an invalid response.');
      setDepartments(data.departments);
    } catch (caught: unknown) {
      if (caught instanceof Error && caught.name === 'AbortError') return;
      setDepartments([]);
      setError(caught instanceof Error ? caught.message : 'Failed to load departments');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [isAdmin, role, search, statusFilter, user]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void loadDepartments(controller.signal), 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadDepartments]);

  const openForm = (mode: 'add' | 'edit', department?: DepartmentRecord) => {
    setFormMode(mode);
    setSelected(department || null);
    setDeptCode(department?.deptCode || '');
    setDeptName(department?.deptName || '');
    setFormErrors({});
  };
  const closeForm = () => {
    if (!submitting) {
      setFormMode(null);
      setSelected(null);
      setFormErrors({});
    }
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (formMode === 'add' && !deptCode.trim()) next.deptCode = 'Department code is required.';
    if (!deptName.trim()) next.deptName = 'Department name is required.';
    if (deptCode.trim().length > 10) next.deptCode = 'Department code must not exceed 10 characters.';
    if (deptName.trim().length > 100) next.deptName = 'Department name must not exceed 100 characters.';
    setFormErrors(next);
    if (Object.keys(next).length || submitting) return;

    setSubmitting(true);
    try {
      const editing = formMode === 'edit';
      const response = await fetch(
        editing ? `/api/hr/departments/${encodeURIComponent(selected?.deptCode || '')}` : '/api/hr/departments',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', ...requestHeaders(role, user) },
          body: JSON.stringify(editing ? { deptName: deptName.trim() } : { deptCode: deptCode.trim(), deptName: deptName.trim() }),
        }
      );
      if (!response.ok) throw new Error(await readError(response));
      await loadDepartments();
      closeForm();
      showToast('success', editing ? 'Department updated successfully.' : 'Department created successfully.');
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : 'Unable to save department.';
      setFormErrors({ server: message });
      showToast('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmMutation = async () => {
    if (!confirmation) return;
    setConfirmationSubmitting(true);
    try {
      const restoring = confirmation.action === 'restore';
      const response = await fetch(
        restoring
          ? `/api/hr/departments/${encodeURIComponent(confirmation.department.deptCode)}/restore`
          : `/api/hr/departments/${encodeURIComponent(confirmation.department.deptCode)}`,
        { method: restoring ? 'PUT' : 'DELETE', headers: requestHeaders(role, user) }
      );
      if (!response.ok) throw new Error(await readError(response));
      await loadDepartments();
      setConfirmation(null);
      showToast('success', restoring ? 'Department restored successfully.' : 'Department deleted successfully.');
    } catch (caught: unknown) {
      showToast('error', caught instanceof Error ? caught.message : 'Unable to update department.');
    } finally {
      setConfirmationSubmitting(false);
    }
  };

  const canAdd = isAdmin || (role === 'User' && rights.includes('dept.add') && !rightsLoading && !rightsError);
  const canEdit = isAdmin || (role === 'User' && rights.includes('dept.edit') && !rightsLoading && !rightsError);
  const canDelete = isAdmin || (role === 'User' && rights.includes('dept.delete') && !rightsLoading && !rightsError);
  const visibleCount = useMemo(() => `${departments.length} department${departments.length === 1 ? '' : 's'}`, [departments.length]);

  return (
    <section className="space-y-4" aria-labelledby="department-management-title">
      {toast && <div role="status" className={`fixed right-4 top-4 z-[70] rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300'}`}>{toast.message}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 id="department-management-title" className="text-base font-bold text-slate-900 dark:text-slate-100">Department Management</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Manage department codes and names.</p></div>
        {canAdd && <button type="button" onClick={() => openForm('add')} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />Add Department</button>}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" aria-label="Search departments" placeholder="Search departments..." value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" /></div>
        {isAdmin && <span className="text-xs text-slate-500 dark:text-slate-400">{visibleCount}</span>}
      </div>
      {role === 'User' && rightsError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Department permissions could not be loaded. Restricted actions are unavailable.</p>}
      {role === 'User' && rightsLoading && <p role="status" className="text-sm text-slate-500">Loading department permissions…</p>}
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[680px] text-left text-sm text-slate-600 dark:text-slate-300">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300"><tr><th className="px-4 py-3">DEPT CODE</th><th className="px-4 py-3">DEPARTMENT NAME</th>{isAdmin && <><th className="px-4 py-3">STATUS</th><th className="px-4 py-3">STAMP</th></>}<th className="px-4 py-3 text-right">ACTIONS</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? <tr><td colSpan={isAdmin ? 5 : 3} className="px-4 py-5"><div className="space-y-3">{[0, 1, 2].map((row) => <div key={row} className="grid grid-cols-3 gap-4"><span className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /><span className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /><span className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /></div>)}</div></td></tr> : departments.length === 0 ? <tr><td colSpan={isAdmin ? 5 : 3} className="px-4 py-10 text-center text-slate-500">{error ? 'Departments unavailable.' : search.trim() ? 'No matching records found.' : statusFilter !== 'All' ? 'No records match the selected filters.' : 'No records available yet.'}</td></tr> : departments.map((department) => {
              const status = department.status || 'Active';
              return <tr key={department.deptCode} className={status === 'Inactive' ? 'bg-slate-100 dark:bg-slate-800/70' : 'transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50'}>
                <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100">{department.deptCode}</td><td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{department.deptName || '—'}</td>
                {isAdmin && <><td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status === 'Active' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{status}</span></td><td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">{department.stamp || '—'}</td></>}
                <td className="px-4 py-3"><div className="flex justify-end gap-2">{canEdit && <button type="button" onClick={() => openForm('edit', department)} className="h-8 rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">Edit</button>}{status === 'Inactive' && isAdmin ? <button type="button" onClick={() => setConfirmation({ department, action: 'restore' })} className="h-8 rounded-md border border-emerald-200 px-2.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:text-emerald-300">Restore</button> : canDelete && <button type="button" onClick={() => setConfirmation({ department, action: 'delete' })} className="h-8 rounded-md border border-rose-200 px-2.5 text-xs font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-300">Delete</button>}</div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {formMode && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && closeForm()}><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700"><h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{formMode === 'add' ? 'Add Department' : `Edit ${selected?.deptCode}`}</h2><button type="button" onClick={closeForm} disabled={submitting} aria-label="Close dialog" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div><form onSubmit={submitForm}><div className="space-y-4 px-5 py-5">{formErrors.server && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{formErrors.server}</p>}<div><label htmlFor="deptCode" className="mb-1.5 block text-sm font-semibold">Department Code *</label><input id="deptCode" value={deptCode} disabled={formMode === 'edit' || submitting} onChange={(event) => setDeptCode(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 dark:border-slate-700 dark:bg-slate-800" />{formErrors.deptCode && <p className="mt-1 text-xs text-rose-700">{formErrors.deptCode}</p>}</div><div><label htmlFor="deptName" className="mb-1.5 block text-sm font-semibold">Department Name *</label><input id="deptName" value={deptName} disabled={submitting} onChange={(event) => setDeptName(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 dark:border-slate-700 dark:bg-slate-800" />{formErrors.deptName && <p className="mt-1 text-xs text-rose-700">{formErrors.deptName}</p>}</div></div><div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700"><button type="button" onClick={closeForm} disabled={submitting} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold">Cancel</button><button type="submit" disabled={submitting} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">{submitting ? 'Saving…' : formMode === 'add' ? 'Add Department' : 'Save Changes'}</button></div></form></div></div>}
      {confirmation && <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/50 p-4"><div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"><div className="px-5 py-5"><p className="text-sm text-slate-700 dark:text-slate-200">{confirmation.action === 'delete' ? `Soft-delete department ${confirmation.department.deptCode}? The database record will be kept and marked inactive.` : `Restore department ${confirmation.department.deptCode}? It will become active again.`}</p></div><div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700"><button type="button" disabled={confirmationSubmitting} onClick={() => setConfirmation(null)} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold">Cancel</button><button type="button" disabled={confirmationSubmitting} onClick={() => void confirmMutation()} className={`h-10 rounded-lg px-4 text-sm font-semibold text-white ${confirmation.action === 'delete' ? 'bg-rose-600' : 'bg-emerald-600'}`}>{confirmationSubmitting ? 'Saving…' : confirmation.action === 'delete' ? 'Delete' : 'Restore'}</button></div></div></div>}
    </section>
  );
}
