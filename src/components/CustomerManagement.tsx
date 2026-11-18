'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { AppUser, RoleName } from '@/types/erp';

type CustomerStatus = 'Active' | 'Inactive';
type StatusFilter = 'Active' | 'Inactive' | 'All';

interface CustomerRecord {
  customerNo: string;
  customerName: string;
  address: string;
  paymentTerms: string;
  status: CustomerStatus;
  stamp: string;
}

const demoCustomers: CustomerRecord[] = [
  {
    customerNo: 'C0001',
    customerName: 'Globus Medical, Inc',
    address: '2560 Gen Armistead Ave Audubon CA 94031',
    paymentTerms: '30D',
    status: 'Active',
    stamp: 'ADD historical_import 2026-10-28',
  },
  {
    customerNo: 'C0002',
    customerName: 'RF Industries, Inc',
    address: '7610 Miramar Rd San Diego, CA 92602',
    paymentTerms: '45D',
    status: 'Active',
    stamp: 'ADD historical_import 2026-10-28',
  },
  {
    customerNo: 'C0003',
    customerName: 'Trisha Macdowell',
    address: '7642 Clairemont Mesa Blvd San Diego CA 90321',
    paymentTerms: 'COD',
    status: 'Active',
    stamp: 'ADD historical_import 2026-10-28',
  },
  {
    customerNo: 'C0005',
    customerName: 'Christian Andersen',
    address: '1120 Lincoln St Suite 809 Sacramento CA 95815',
    paymentTerms: 'COD',
    status: 'Active',
    stamp: 'ADD historical_import 2026-10-28',
  },
  {
    customerNo: 'C-004',
    customerName: 'Umbrella Corp',
    address: '',
    paymentTerms: '',
    status: 'Inactive',
    stamp: '',
  },
];

interface CustomerManagementProps {
  role: RoleName;
  user: AppUser | null;
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

function CustomerSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full sm:max-w-sm">
      <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        aria-label="Search customers"
        placeholder="Search customers..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
    </div>
  );
}

function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  const isActive = status === 'Active';
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        isActive
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
          : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
      }`}
    >
      {status}
    </span>
  );
}

function CustomerActions({
  customer,
  isAdmin,
  canEdit,
  canDelete,
}: {
  customer: CustomerRecord;
  isAdmin: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      {(isAdmin || canEdit) && (
        <button
          type="button"
          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label={`Edit ${customer.customerName}`}
        >
          Edit
        </button>
      )}
      {customer.status === 'Inactive' && isAdmin ? (
        <button
          type="button"
          className="rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
          aria-label={`Restore ${customer.customerName}`}
        >
          Restore
        </button>
      ) : (
        (isAdmin || canDelete) && (
          <button
            type="button"
            className="rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
            aria-label={`Delete ${customer.customerName}`}
          >
            Delete
          </button>
        )
      )}
    </div>
  );
}

function CustomerTable({
  customers,
  isAdmin,
  canEdit,
  canDelete,
}: {
  customers: CustomerRecord[];
  isAdmin: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm text-slate-600 dark:text-slate-300">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
          <tr>
            <th scope="col" className="px-4 py-3">CUST NO</th>
            <th scope="col" className="px-4 py-3">CUSTOMER NAME</th>
            <th scope="col" className="px-4 py-3">ADDRESS</th>
            <th scope="col" className="px-4 py-3">PAY TERMS</th>
            {isAdmin && (
              <>
                <th scope="col" className="px-4 py-3">STATUS</th>
                <th scope="col" className="px-4 py-3">STAMP</th>
              </>
            )}
            <th scope="col" className="px-4 py-3 text-right">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {customers.length === 0 ? (
            <tr>
              <td colSpan={isAdmin ? 7 : 5} className="px-4 py-10 text-center text-sm text-slate-500">
                No customers found.
              </td>
            </tr>
          ) : (
            customers.map((customer) => (
              <tr
                key={customer.customerNo}
                className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                  customer.status === 'Inactive' ? 'bg-slate-100 dark:bg-slate-800/70' : ''
                }`}
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {customer.customerNo}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                  {customer.customerName}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{customer.address || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3">{customer.paymentTerms || '—'}</td>
                {isAdmin && (
                  <>
                    <td className="whitespace-nowrap px-4 py-3">
                      <CustomerStatusBadge status={customer.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {customer.stamp || '—'}
                    </td>
                  </>
                )}
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <CustomerActions
                      customer={customer}
                      isAdmin={isAdmin}
                      canEdit={canEdit}
                      canDelete={canDelete}
                    />
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function CustomerManagement({ role, user }: CustomerManagementProps) {
  const isAdmin = role === 'Admin' || role === 'Superadmin';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Active');
  const [search, setSearch] = useState('');
  const [userRights, setUserRights] = useState<string[]>([]);
  const [rightsError, setRightsError] = useState(false);
  const [rightsLoading, setRightsLoading] = useState(false);

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

  const counts = useMemo(() => {
    const active = demoCustomers.filter((customer) => customer.status === 'Active').length;
    const inactive = demoCustomers.filter((customer) => customer.status === 'Inactive').length;
    return { Active: active, Inactive: inactive, All: demoCustomers.length };
  }, []);

  const visibleCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return demoCustomers.filter((customer) => {
      if (!isAdmin && customer.status !== 'Active') return false;
      if (isAdmin && statusFilter !== 'All' && customer.status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      return [
        customer.customerNo,
        customer.customerName,
        customer.address,
        customer.paymentTerms,
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [isAdmin, search, statusFilter]);

  const canEdit = role === 'User' && userRights.includes('customer.edit') && !rightsLoading;
  const canDelete = role === 'User' && userRights.includes('customer.delete') && !rightsLoading;

  return (
    <section className="space-y-5" aria-labelledby="customer-management-title">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id="customer-management-title" className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Customer Management
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage customer records and payment terms.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add Customer
          </button>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        {isAdmin && (
          <CustomerStatusTabs value={statusFilter} counts={counts} onChange={setStatusFilter} />
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CustomerSearch value={search} onChange={setSearch} />
          {isAdmin && <span className="text-xs text-slate-500">{visibleCustomers.length} customers</span>}
        </div>

        {role === 'User' && rightsError && (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Customer permissions could not be loaded. Edit and Delete actions are unavailable.
          </p>
        )}
        {role === 'User' && rightsLoading && (
          <p role="status" className="text-sm text-slate-500">Loading customer permissions…</p>
        )}

        <CustomerTable
          customers={visibleCustomers}
          isAdmin={isAdmin}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </div>
    </section>
  );
}
