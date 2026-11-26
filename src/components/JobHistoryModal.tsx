'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { AppUser, RoleName } from '@/types/erp';

interface EmployeeRecord {
  empNo: string;
  lastName: string | null;
  firstName: string | null;
}

interface JobHistoryRecord {
  empNo: string;
  jobCode: string;
  jobDesc?: string | null;
  effDate: string;
  salary: number;
  deptCode: string | null;
  deptName?: string | null;
  status?: 'Active' | 'Inactive';
  stamp?: string;
}

interface JobRecord {
  jobCode: string;
  jobDesc: string | null;
}

interface DepartmentRecord {
  deptCode: string;
  deptName: string | null;
}

type StatusFilter = 'Active' | 'Inactive' | 'All';

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

function formatDate(value: string) {
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

export default function JobHistoryModal({
  employee,
  role,
  user,
  onClose,
}: {
  employee: EmployeeRecord;
  role: RoleName;
  user: AppUser | null;
  onClose: () => void;
}) {
  const isAdmin = role === 'Admin' || role === 'Superadmin';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Active');
  const [history, setHistory] = useState<JobHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rights, setRights] = useState<string[]>([]);
  const [rightsLoading, setRightsLoading] = useState(false);
  const [rightsError, setRightsError] = useState(false);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [lookupsError, setLookupsError] = useState('');
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [selected, setSelected] = useState<JobHistoryRecord | null>(null);
  const [jobCode, setJobCode] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [effDate, setEffDate] = useState('');
  const [salary, setSalary] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteRecord, setDeleteRecord] = useState<JobHistoryRecord | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting && !deleteSubmitting && !restoreSubmitting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [deleteSubmitting, onClose, restoreSubmitting, submitting]);

  useEffect(() => {
    if (role !== 'User' || !user?.userId) {
      setRights([]);
      setRightsLoading(false);
      setRightsError(false);
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

  const canViewHistory = isAdmin || (
    role === 'User'
    && !rightsLoading
    && !rightsError
    && rights.includes('jobhistory.view')
  );

  const loadHistory = useCallback(async (signal?: AbortSignal) => {
    if (!canViewHistory) {
      setHistory([]);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (isAdmin) params.set('status', statusFilter);
      const response = await fetch(
        `/api/hr/employees/${encodeURIComponent(employee.empNo)}/history?${params.toString()}`,
        { headers: requestHeaders(role, user), signal }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load employee history');
      if (!Array.isArray(data.history)) throw new Error('The employee history API returned an invalid response.');
      setHistory([...data.history].sort((a: JobHistoryRecord, b: JobHistoryRecord) => b.effDate.localeCompare(a.effDate)));
    } catch (caught: unknown) {
      if (caught instanceof Error && caught.name === 'AbortError') return;
      setHistory([]);
      setError(caught instanceof Error ? caught.message : 'Failed to load employee history');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [canViewHistory, employee.empNo, isAdmin, role, statusFilter, user]);

  useEffect(() => {
    const controller = new AbortController();
    void loadHistory(controller.signal);
    return () => controller.abort();
  }, [loadHistory]);

  const loadLookups = useCallback(async () => {
    setLookupsLoading(true);
    setLookupsError('');
    const controller = new AbortController();
    try {
      const [jobsResponse, departmentsResponse] = await Promise.all([
        fetch('/api/hr/jobs?status=Active', { headers: requestHeaders(role, user), signal: controller.signal }),
        fetch('/api/hr/departments?status=Active', { headers: requestHeaders(role, user), signal: controller.signal }),
      ]);
      const jobsData = await jobsResponse.json();
      const departmentsData = await departmentsResponse.json();
      if (!jobsResponse.ok) throw new Error(jobsData.error || 'Failed to load active jobs');
      if (!departmentsResponse.ok) throw new Error(departmentsData.error || 'Failed to load active departments');
      if (!Array.isArray(jobsData.jobs) || !Array.isArray(departmentsData.departments)) {
        throw new Error('The lookup APIs returned invalid responses.');
      }
      setJobs(jobsData.jobs);
      setDepartments(departmentsData.departments);
    } catch (caught: unknown) {
      if (caught instanceof Error && caught.name === 'AbortError') return;
      setJobs([]);
      setDepartments([]);
      setLookupsError(caught instanceof Error ? caught.message : 'Failed to load history options');
    } finally {
      if (!controller.signal.aborted) setLookupsLoading(false);
    }
  }, [role, user]);

  const openForm = (mode: 'add' | 'edit', record?: JobHistoryRecord) => {
    setFormMode(mode);
    setSelected(record || null);
    setJobCode(record?.jobCode || '');
    setDeptCode(record?.deptCode || '');
    setEffDate(record?.effDate || '');
    setSalary(record ? String(record.salary) : '');
    setFormErrors({});
    void loadLookups();
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
    if (!jobCode) next.jobCode = 'Job is required.';
    if (!deptCode) next.deptCode = 'Department is required.';
    if (!effDate) next.effDate = 'Effective date is required.';
    const numericSalary = Number(salary);
    if (!salary.trim()) next.salary = 'Salary is required.';
    else if (!Number.isFinite(numericSalary) || numericSalary <= 0) next.salary = 'Salary must be greater than zero.';
    setFormErrors(next);
    if (Object.keys(next).length || submitting) return;

    setSubmitting(true);
    try {
      const editing = formMode === 'edit';
      const url = editing
        ? `/api/hr/employees/${encodeURIComponent(employee.empNo)}/history/${encodeURIComponent(selected?.jobCode || '')}/${encodeURIComponent(selected?.effDate || '')}`
        : `/api/hr/employees/${encodeURIComponent(employee.empNo)}/history`;
      const response = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...requestHeaders(role, user) },
        body: JSON.stringify({ jobCode, deptCode, effDate, salary: numericSalary }),
      });
      if (!response.ok) throw new Error(await readError(response));
      setFormMode(null);
      setSelected(null);
      setFormErrors({});
      await loadHistory();
      showToast('success', editing ? 'Job history updated successfully.' : 'Job history added successfully.');
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : 'Unable to save job history record.';
      setFormErrors({ server: message });
      showToast('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteHistory = async () => {
    if (!deleteRecord) return;
    setDeleteSubmitting(true);
    try {
      const response = await fetch(
        `/api/hr/employees/${encodeURIComponent(employee.empNo)}/history/${encodeURIComponent(deleteRecord.jobCode)}/${encodeURIComponent(deleteRecord.effDate)}`,
        { method: 'DELETE', headers: requestHeaders(role, user) }
      );
      if (!response.ok) throw new Error(await readError(response));
      setDeleteRecord(null);
      await loadHistory();
      showToast('success', 'Job history record deleted successfully.');
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : 'Unable to delete job history record.';
      setError(message);
      showToast('error', message);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const restoreHistory = async (record: JobHistoryRecord) => {
    setRestoreSubmitting(true);
    try {
      const response = await fetch(
        `/api/hr/employees/${encodeURIComponent(employee.empNo)}/history/${encodeURIComponent(record.jobCode)}/${encodeURIComponent(record.effDate)}/restore`,
        { method: 'PUT', headers: requestHeaders(role, user) }
      );
      if (!response.ok) throw new Error(await readError(response));
      await loadHistory();
      showToast('success', 'Job history record restored successfully.');
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : 'Unable to restore job history record.';
      setError(message);
      showToast('error', message);
    } finally {
      setRestoreSubmitting(false);
    }
  };

  const canAdd = isAdmin || (!rightsError && !rightsLoading && rights.includes('jobhistory.add'));
  const canEdit = isAdmin || (!rightsError && !rightsLoading && rights.includes('jobhistory.edit'));
  const canDelete = isAdmin || (!rightsError && !rightsLoading && rights.includes('jobhistory.delete'));
  const showActions = isAdmin || canEdit || canDelete;
  const employeeName = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();
  const modalTitle = `Job History — ${employeeName || employee.empNo} (${employee.empNo})`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      {toast && (
        <div role="status" className={`fixed right-4 top-4 z-[80] rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
          {toast.message}
        </div>
      )}
      <div role="dialog" aria-modal="true" aria-labelledby="job-history-title" className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 id="job-history-title" className="text-base font-bold text-slate-900 dark:text-slate-100">{modalTitle}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          {role === 'User' && rightsLoading && (
            <div role="status" aria-label="Loading history permissions" className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <span className="block h-4 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <span className="block h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          )}
          {role === 'User' && !rightsLoading && !canViewHistory && (
            <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-bold">Privacy Restriction</p>
              <p className="mt-1">Access to employee Job History information is restricted. Your account does not have the required permission to view these personal records.</p>
            </div>
          )}
          {canViewHistory && isAdmin && (
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
              <div className="flex gap-1">
                {(['Active', 'Inactive', 'All'] as const).map((status) => (
                  <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${statusFilter === status ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-slate-500'}`}>
                    {status}
                  </button>
                ))}
              </div>
              {canAdd && (
                <button type="button" onClick={() => openForm('add')} className="mb-2 inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />Add History</button>
              )}
            </div>
          )}
          {canViewHistory && !isAdmin && canAdd && (
            <div className="flex justify-end">
              <button type="button" onClick={() => openForm('add')} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />Add History</button>
            </div>
          )}
          {canViewHistory && rightsError && role === 'User' && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">History permissions could not be loaded. Administrative history actions are unavailable.</p>}
          {canViewHistory && error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
          {canViewHistory && <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3">EFF DATE</th>
                  <th className="px-4 py-3">JOB</th>
                  <th className="px-4 py-3">DEPARTMENT</th>
                  <th className="px-4 py-3">SALARY</th>
                  {isAdmin && <><th className="px-4 py-3">STATUS</th><th className="px-4 py-3">STAMP</th></>}
                  {showActions && <th className="px-4 py-3 text-right">ACTIONS</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={isAdmin ? 7 : showActions ? 5 : 4} className="px-4 py-5"><div className="space-y-3">{[0, 1, 2].map((row) => <div key={row} className="grid grid-cols-6 gap-4">{[0, 1, 2, 3, 4, 5].map((cell) => <span key={cell} className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />)}</div>)}</div></td></tr>
                ) : history.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 7 : showActions ? 5 : 4} className="px-4 py-10 text-center text-slate-500">{isAdmin && statusFilter !== 'All' ? 'No records match the selected filters.' : 'No records available yet.'}</td></tr>
                ) : history.map((record) => (
                  <tr key={`${record.jobCode}-${record.effDate}`} className={record.status === 'Inactive' ? 'bg-slate-100 dark:bg-slate-800/50' : ''}>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(record.effDate)}</td>
                    <td className="px-4 py-3"><span className="font-semibold">{record.jobCode}</span>{record.jobDesc ? <span className="block text-xs text-slate-500">{record.jobDesc}</span> : null}</td>
                    <td className="px-4 py-3"><span className="font-medium">{record.deptCode || '—'}</span>{record.deptName ? <span className="block text-xs text-slate-500">{record.deptName}</span> : null}</td>
                    <td className="whitespace-nowrap px-4 py-3">{new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(record.salary)}</td>
                    {isAdmin && <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${record.status === 'Inactive' ? 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'}`}>{record.status || '—'}</span></td>}
                    {isAdmin && <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{record.stamp || '—'}</td>}
                    {showActions && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canEdit && record.status !== 'Inactive' && <button type="button" onClick={() => openForm('edit', record)} className="h-8 rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">Edit</button>}
                          {canDelete && record.status !== 'Inactive' && <button type="button" onClick={() => setDeleteRecord(record)} className="h-8 rounded-md border border-rose-200 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300">Delete</button>}
                          {isAdmin && record.status === 'Inactive' && <button type="button" disabled={restoreSubmitting} onClick={() => void restoreHistory(record)} className="h-8 rounded-md border border-emerald-200 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-300">Restore</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </div>
      </div>

      {formMode && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && closeForm()}>
          <div role="dialog" aria-modal="true" aria-labelledby="job-history-form-title" className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <h3 id="job-history-form-title" className="font-bold">{formMode === 'add' ? 'Add History' : 'Edit History'}</h3>
              <button type="button" onClick={closeForm} disabled={submitting} aria-label="Close history form" className="rounded-md p-1.5 text-slate-500"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={submitForm}>
              <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
                {formErrors.server && <p role="alert" className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{formErrors.server}</p>}
                {lookupsError && <p role="alert" className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{lookupsError}</p>}
                <div className="sm:col-span-2">
                  <label htmlFor="historyJob" className="mb-1.5 block text-sm font-semibold">Job *</label>
                  <select id="historyJob" value={jobCode} disabled={submitting || lookupsLoading} onChange={(event) => setJobCode(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 dark:border-slate-700 dark:bg-slate-800">
                    <option value="">Select job</option>
                    {jobs.map((job) => <option key={job.jobCode} value={job.jobCode}>{job.jobCode} — {job.jobDesc || 'Untitled job'}</option>)}
                  </select>
                  {formErrors.jobCode && <p className="mt-1 text-xs text-rose-700">{formErrors.jobCode}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="historyDepartment" className="mb-1.5 block text-sm font-semibold">Department *</label>
                  <select id="historyDepartment" value={deptCode} disabled={submitting || lookupsLoading} onChange={(event) => setDeptCode(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 dark:border-slate-700 dark:bg-slate-800">
                    <option value="">Select department</option>
                    {departments.map((department) => <option key={department.deptCode} value={department.deptCode}>{department.deptCode} — {department.deptName || 'Unnamed department'}</option>)}
                  </select>
                  {formErrors.deptCode && <p className="mt-1 text-xs text-rose-700">{formErrors.deptCode}</p>}
                </div>
                <div>
                  <label htmlFor="historyEffDate" className="mb-1.5 block text-sm font-semibold">Effective Date *</label>
                  <input id="historyEffDate" type="date" value={effDate} disabled={submitting || lookupsLoading} onChange={(event) => setEffDate(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 dark:border-slate-700 dark:bg-slate-800" />
                  {formErrors.effDate && <p className="mt-1 text-xs text-rose-700">{formErrors.effDate}</p>}
                </div>
                <div>
                  <label htmlFor="historySalary" className="mb-1.5 block text-sm font-semibold">Salary *</label>
                  <input id="historySalary" type="number" min="0.01" step="0.01" value={salary} disabled={submitting || lookupsLoading} onChange={(event) => setSalary(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 dark:border-slate-700 dark:bg-slate-800" />
                  {formErrors.salary && <p className="mt-1 text-xs text-rose-700">{formErrors.salary}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
                <button type="button" disabled={submitting} onClick={closeForm} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold dark:border-slate-700">Cancel</button>
                <button type="submit" disabled={submitting || lookupsLoading || !!lookupsError} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Saving…' : formMode === 'add' ? 'Add History' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteRecord && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="px-5 py-5"><p className="text-sm">Delete this job history record? The database record will be kept and marked inactive.</p></div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
              <button type="button" disabled={deleteSubmitting} onClick={() => setDeleteRecord(null)} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold dark:border-slate-700">Cancel</button>
              <button type="button" disabled={deleteSubmitting} onClick={() => void deleteHistory()} className="h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-60">{deleteSubmitting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
