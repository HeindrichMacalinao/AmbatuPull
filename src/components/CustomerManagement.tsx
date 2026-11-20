'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import type { AppUser, RoleName } from '@/types/erp';

type CustomerStatus = 'Active' | 'Inactive';
type StatusFilter = 'Active' | 'Inactive' | 'All';

interface CustomerRecord {
  custNo: string;
  custName: string;
  address: string | null;
  payTerms: string | null;
  status?: CustomerStatus;
  stamp?: string;
}

interface CustomerManagementProps {
  role: RoleName;
  user: AppUser | null;
}

interface CustomerFormValues {
  custNo: string;
  custName: string;
  address: string;
  payTerms: string;
}

interface CustomerFormErrors {
  custNo?: string;
  custName?: string;
  address?: string;
  payTerms?: string;
  server?: string;
}

const PAY_TERMS = ['Net 15', 'Net 30', 'Net 45', 'COD', 'Prepaid'] as const;

function requestHeaders(role: RoleName, user: AppUser | null) {
  const headers: Record<string, string> = { 'x-user-role': role };
  if (user?.email) headers['x-user-email'] = user.email;
  if (user?.userId) headers['x-user-id'] = String(user.userId);
  return headers;
}

async function readApiError(response: Response) {
  try {
    const data = await response.json();
    return data.error || data.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

function CustomerStatusTabs({
  value,
  counts,
  onChange,
}: {
  value: StatusFilter;
  counts: Record<StatusFilter, number>;
  onChange: (status: StatusFilter) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist" aria-label="Customer status">
      {(['Active', 'Inactive', 'All'] as const).map((status) => (
        <button
          key={status}
          type="button"
          role="tab"
          aria-selected={value === status}
          onClick={() => onChange(status)}
          className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
            value === status
              ? 'border-blue-600 text-blue-700 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {status}
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300">
            {counts[status]}
          </span>
        </button>
      ))}
    </div>
  );
}

function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  const isActive = status === 'Active';
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
      isActive
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
        : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
    }`}>
      {status}
    </span>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby="customer-modal-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 id="customer-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CustomerForm({
  mode,
  initial,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: {
  mode: 'add' | 'edit';
  initial: CustomerFormValues;
  submitting: boolean;
  serverError: string;
  onCancel: () => void;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<CustomerFormErrors>(serverError ? { server: serverError } : {});

  useEffect(() => setErrors((current) => ({ ...current, server: serverError })), [serverError]);

  const validate = () => {
    const next: CustomerFormErrors = {};
    if (mode === 'add' && !values.custNo.trim()) next.custNo = 'Customer number is required.';
    if (!values.custName.trim()) next.custName = 'Customer name is required.';
    if (!values.address.trim()) next.address = 'Billing address is required.';
    if (!values.payTerms) next.payTerms = 'Payment terms are required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !validate()) return;
    void onSubmit({
      custNo: values.custNo.trim(),
      custName: values.custName.trim(),
      address: values.address.trim(),
      payTerms: values.payTerms,
    });
  };

  const invalid = mode === 'add'
    ? !values.custNo.trim() || !values.custName.trim() || !values.address.trim() || !values.payTerms
    : !values.custName.trim() || !values.address.trim() || !values.payTerms;

  const inputClass = (hasError?: string) => `h-10 w-full rounded-lg border px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100 ${
    hasError
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
      : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/20 dark:border-slate-700'
  } disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`;

  return (
    <form onSubmit={submit}>
      <div className="space-y-4 px-5 py-5">
        {errors.server && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{errors.server}</p>}
        {mode === 'add' && (
          <div>
            <label htmlFor="custNo" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Customer Number <span className="text-rose-600">*</span></label>
            <input id="custNo" value={values.custNo} onChange={(event) => setValues({ ...values, custNo: event.target.value })} disabled={submitting} placeholder="e.g. C0006" className={inputClass(errors.custNo)} />
            {errors.custNo && <p className="mt-1 text-xs text-rose-700">{errors.custNo}</p>}
          </div>
        )}
        <div>
          <label htmlFor="custName" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Customer Name <span className="text-rose-600">*</span></label>
          <input id="custName" value={values.custName} onChange={(event) => setValues({ ...values, custName: event.target.value })} disabled={submitting} placeholder="Enter customer name" className={inputClass(errors.custName)} />
          {errors.custName && <p className="mt-1 text-xs text-rose-700">{errors.custName}</p>}
        </div>
        <div>
          <label htmlFor="address" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Billing Address <span className="text-rose-600">*</span></label>
          <textarea id="address" value={values.address} onChange={(event) => setValues({ ...values, address: event.target.value })} disabled={submitting} rows={3} placeholder="Enter billing address" className={`${inputClass(errors.address)} h-auto py-2`} />
          {errors.address && <p className="mt-1 text-xs text-rose-700">{errors.address}</p>}
        </div>
        <div>
          <label htmlFor="payTerms" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Payment Terms <span className="text-rose-600">*</span></label>
          <select id="payTerms" value={values.payTerms} onChange={(event) => setValues({ ...values, payTerms: event.target.value })} disabled={submitting} className={inputClass(errors.payTerms)}>
            <option value="">Select payment terms</option>
            {PAY_TERMS.map((term) => <option key={term} value={term}>{term}</option>)}
          </select>
          {errors.payTerms && <p className="mt-1 text-xs text-rose-700">{errors.payTerms}</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
        <button type="button" onClick={onCancel} disabled={submitting} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
        <button type="submit" disabled={submitting || invalid} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? 'Saving…' : mode === 'add' ? 'Add Customer' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

export default function CustomerManagement({ role, user }: CustomerManagementProps) {
  const isAdmin = role === 'Admin' || role === 'Superadmin';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [counts, setCounts] = useState<Record<StatusFilter, number>>({ Active: 0, Inactive: 0, All: 0 });
  const [loading, setLoading] = useState(true);
  const hasLoadedCustomers = useRef(false);
  const [listError, setListError] = useState('');
  const [userRights, setUserRights] = useState<string[]>([]);
  const [rightsError, setRightsError] = useState(false);
  const [rightsLoading, setRightsLoading] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formServerError, setFormServerError] = useState('');
  const [deleteCustomer, setDeleteCustomer] = useState<CustomerRecord | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
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
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (role !== 'User' || !user?.userId) {
      setUserRights([]);
      setRightsError(false);
      setRightsLoading(false);
      return;
    }
    const controller = new AbortController();
    setRightsLoading(true);
    setRightsError(false);
    fetch(`/api/users/${user.userId}/rights`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load customer permissions');
        setUserRights(Array.isArray(data.grantedRights) ? data.grantedRights : []);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setUserRights([]);
        setRightsError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRightsLoading(false);
      });
    return () => controller.abort();
  }, [role, user?.userId]);

  const refreshCounts = useCallback(async () => {
    const controller = new AbortController();
    try {
      if (!isAdmin) {
        const response = await fetch('/api/customers?status=active', { headers: requestHeaders(role, user), signal: controller.signal });
        if (!response.ok) throw new Error(await readApiError(response));
        const data = await response.json();
        const active = Array.isArray(data.customers) ? data.customers.length : 0;
        setCounts({ Active: active, Inactive: 0, All: active });
        return;
      }
      const responses = await Promise.all([
        fetch('/api/customers?status=active', { headers: requestHeaders(role, user), signal: controller.signal }),
        fetch('/api/customers?status=inactive', { headers: requestHeaders(role, user), signal: controller.signal }),
        fetch('/api/customers?status=all', { headers: requestHeaders(role, user), signal: controller.signal }),
      ]);
      for (const response of responses) {
        if (!response.ok) throw new Error(await readApiError(response));
      }
      const [activeData, inactiveData, allData] = await Promise.all(responses.map((response) => response.json()));
      setCounts({
        Active: Array.isArray(activeData.customers) ? activeData.customers.length : 0,
        Inactive: Array.isArray(inactiveData.customers) ? inactiveData.customers.length : 0,
        All: Array.isArray(allData.customers) ? allData.customers.length : 0,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError') setCounts({ Active: 0, Inactive: 0, All: 0 });
    }
  }, [isAdmin, role, user]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    const controller = new AbortController();
    if (!hasLoadedCustomers.current) setLoading(true);
    setListError('');
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    params.set('status', isAdmin ? statusFilter.toLowerCase() : 'active');
    fetch(`/api/customers?${params.toString()}`, {
      headers: requestHeaders(role, user),
      signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load customers');
      if (!Array.isArray(data.customers)) throw new Error('The customer API returned an invalid response.');
      setCustomers(data.customers.map((customer: CustomerRecord) => ({
        ...customer,
        status: customer.status || 'Active',
      })));
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') return;
      setCustomers([]);
      setListError(error instanceof Error ? error.message : 'Failed to load customers');
    }).finally(() => {
      if (!controller.signal.aborted) {
        hasLoadedCustomers.current = true;
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [debouncedSearch, isAdmin, role, statusFilter, user]);

  const refreshAfterMutation = useCallback(async () => {
    await refreshCounts();
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    params.set('status', isAdmin ? statusFilter.toLowerCase() : 'active');
    const response = await fetch(`/api/customers?${params.toString()}`, { headers: requestHeaders(role, user) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to refresh customers');
    setCustomers(Array.isArray(data.customers) ? data.customers.map((customer: CustomerRecord) => ({ ...customer, status: customer.status || 'Active' })) : []);
  }, [debouncedSearch, isAdmin, refreshCounts, role, statusFilter, user]);

  const canAdd = isAdmin || (role === 'User' && userRights.includes('customer.add') && !rightsLoading && !rightsError);
  const canEdit = isAdmin || (role === 'User' && userRights.includes('customer.edit') && !rightsLoading && !rightsError);
  const canDelete = isAdmin || (role === 'User' && userRights.includes('customer.delete') && !rightsLoading && !rightsError);

  const openAdd = () => {
    setFormMode('add');
    setSelectedCustomer(null);
    setFormServerError('');
  };
  const openEdit = (customer: CustomerRecord) => {
    setFormMode('edit');
    setSelectedCustomer(customer);
    setFormServerError('');
  };
  const closeForm = () => {
    if (!submitting) {
      setFormMode(null);
      setSelectedCustomer(null);
      setFormServerError('');
    }
  };

  const submitForm = async (values: CustomerFormValues) => {
    setSubmitting(true);
    setFormServerError('');
    try {
      const isEdit = formMode === 'edit';
      const url = isEdit ? `/api/customers/${encodeURIComponent(selectedCustomer?.custNo || '')}` : '/api/customers';
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...requestHeaders(role, user) },
        body: JSON.stringify(isEdit
          ? { custName: values.custName, address: values.address, payTerms: values.payTerms }
          : values),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      await refreshAfterMutation();
      setFormMode(null);
      setSelectedCustomer(null);
      showToast('success', isEdit ? 'Customer updated successfully.' : 'Customer created successfully.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to save customer.';
      setFormServerError(message);
      showToast('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteCustomer) return;
    setDeleteSubmitting(true);
    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(deleteCustomer.custNo)}`, {
        method: 'DELETE',
        headers: requestHeaders(role, user),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      await refreshAfterMutation();
      setDeleteCustomer(null);
      showToast('success', 'Customer deleted successfully.');
    } catch (error: unknown) {
      showToast('error', error instanceof Error ? error.message : 'Unable to delete customer.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const restoreCustomer = async (customer: CustomerRecord) => {
    if (!isAdmin) return;
    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(customer.custNo)}/restore`, {
        method: 'PUT',
        headers: requestHeaders(role, user),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      await refreshAfterMutation();
      showToast('success', 'Customer restored successfully.');
    } catch (error: unknown) {
      showToast('error', error instanceof Error ? error.message : 'Unable to restore customer.');
    }
  };

  const visibleCountLabel = useMemo(() => `${customers.length} customer${customers.length === 1 ? '' : 's'}`, [customers.length]);

  return (
    <section className="space-y-5" aria-labelledby="customer-management-title">
      {toast && (
        <div role="status" className={`fixed right-4 top-4 z-[60] rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg ${
          toast.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
            : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300'
        }`}>
          {toast.message}
        </div>
      )}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id="customer-management-title" className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Customer Management</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage customer records and payment terms.</p>
        </div>
        {canAdd && (
          <button type="button" onClick={openAdd} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">
            <Plus aria-hidden="true" className="h-4 w-4" /> Add Customer
          </button>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        {isAdmin && <CustomerStatusTabs value={statusFilter} counts={counts} onChange={setStatusFilter} />}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="search" aria-label="Search customers" placeholder="Search customers..." value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          {isAdmin && <span className="text-xs text-slate-500">{visibleCountLabel}</span>}
        </div>

        {role === 'User' && rightsError && (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Customer permissions could not be loaded. Edit and Delete actions are unavailable.</p>
        )}
        {role === 'User' && rightsLoading && <p role="status" className="text-sm text-slate-500">Loading customer permissions…</p>}
        {listError && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{listError}</p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
              <tr>
                <th scope="col" className="px-4 py-3">CUST NO</th>
                <th scope="col" className="px-4 py-3">CUSTOMER NAME</th>
                <th scope="col" className="px-4 py-3">ADDRESS</th>
                <th scope="col" className="px-4 py-3">PAY TERMS</th>
                {isAdmin && <><th scope="col" className="px-4 py-3">STATUS</th><th scope="col" className="px-4 py-3">STAMP</th></>}
                <th scope="col" className="px-4 py-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={isAdmin ? 7 : 5} className="px-4 py-10 text-center text-sm text-slate-500">Loading customers…</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={isAdmin ? 7 : 5} className="px-4 py-10 text-center text-sm text-slate-500">{listError ? 'Customers unavailable.' : 'No customers found.'}</td></tr>
              ) : customers.map((customer) => {
                const status = customer.status || 'Active';
                return (
                  <tr key={customer.custNo} className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${status === 'Inactive' ? 'bg-slate-100 dark:bg-slate-800/70' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100">{customer.custNo}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{customer.custName}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{customer.address || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{customer.payTerms || '—'}</td>
                    {isAdmin && <><td className="whitespace-nowrap px-4 py-3"><CustomerStatusBadge status={status} /></td><td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{customer.stamp || '—'}</td></>}
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        {(isAdmin || canEdit) && (
                          <button type="button" onClick={() => openEdit(customer)} className="h-8 rounded-md border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" aria-label={`Edit ${customer.custName}`}>Edit</button>
                        )}
                        {status === 'Inactive' && isAdmin ? (
                          <button type="button" onClick={() => void restoreCustomer(customer)} className="h-8 rounded-md border border-emerald-200 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/60" aria-label={`Restore ${customer.custName}`}>Restore</button>
                        ) : ((isAdmin || canDelete) && (
                          <button type="button" onClick={() => setDeleteCustomer(customer)} className="h-8 rounded-md border border-rose-200 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40" aria-label={`Delete ${customer.custName}`}>Delete</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {formMode && (
        <Modal title={formMode === 'add' ? 'Add Customer' : `Edit ${selectedCustomer?.custName || 'Customer'}`} onClose={closeForm}>
          <CustomerForm
            mode={formMode}
            initial={{
              custNo: selectedCustomer?.custNo || '',
              custName: selectedCustomer?.custName || '',
              address: selectedCustomer?.address || '',
              payTerms: selectedCustomer?.payTerms || '',
            }}
            submitting={submitting}
            serverError={formServerError}
            onCancel={closeForm}
            onSubmit={submitForm}
          />
        </Modal>
      )}

      {deleteCustomer && (
        <Modal title="Delete Customer" onClose={() => { if (!deleteSubmitting) setDeleteCustomer(null); }}>
          <div className="px-5 py-5">
            <p className="text-sm text-slate-600 dark:text-slate-300">Delete <strong className="text-slate-900 dark:text-slate-100">{deleteCustomer.custName}</strong> ({deleteCustomer.custNo})? The customer will be marked inactive and can be restored by an Admin.</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
            <button type="button" disabled={deleteSubmitting} onClick={() => setDeleteCustomer(null)} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200">Cancel</button>
            <button type="button" disabled={deleteSubmitting} onClick={() => void confirmDelete()} className="h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60">{deleteSubmitting ? 'Deleting…' : 'Delete Customer'}</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
