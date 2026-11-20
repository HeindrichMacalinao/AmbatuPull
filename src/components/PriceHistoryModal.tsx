'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { AppUser, RoleName } from '@/types/erp';

interface ProductRecord {
  prodCode: string;
  description: string;
  unit: string | null;
}
interface PriceRecord {
  prodCode: string;
  effDate: string;
  unitPrice: number;
  status?: 'Active' | 'Inactive';
  stamp?: string;
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

export default function PriceHistoryModal({ product, role, user, onClose }: {
  product: ProductRecord;
  role: RoleName;
  user: AppUser | null;
  onClose: () => void;
}) {
  const isAdmin = role === 'Admin' || role === 'Superadmin';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Active');
  const [prices, setPrices] = useState<PriceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rights, setRights] = useState<string[]>([]);
  const [rightsError, setRightsError] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [selected, setSelected] = useState<PriceRecord | null>(null);
  const [effDate, setEffDate] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteRecord, setDeleteRecord] = useState<PriceRecord | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting && !deleteSubmitting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [deleteSubmitting, onClose, submitting]);

  useEffect(() => {
    if (role !== 'User' || !user?.userId) {
      setRights([]);
      setRightsError(false);
      return;
    }
    const controller = new AbortController();
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
      });
    return () => controller.abort();
  }, [role, user?.userId]);

  const loadPrices = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (isAdmin) params.set('status', statusFilter);
      const response = await fetch(`/api/products/${encodeURIComponent(product.prodCode)}/prices?${params.toString()}`, {
        headers: requestHeaders(role, user),
        signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load price history');
      if (!Array.isArray(data.prices)) throw new Error('The price history API returned an invalid response.');
      setPrices([...data.prices].sort((a: PriceRecord, b: PriceRecord) => b.effDate.localeCompare(a.effDate)));
    } catch (caught: unknown) {
      if (caught instanceof Error && caught.name === 'AbortError') return;
      setPrices([]);
      setError(caught instanceof Error ? caught.message : 'Failed to load price history');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [isAdmin, product.prodCode, role, statusFilter, user]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPrices(controller.signal);
    return () => controller.abort();
  }, [loadPrices]);

  const openForm = (mode: 'add' | 'edit', price?: PriceRecord) => {
    setFormMode(mode);
    setSelected(price || null);
    setEffDate(price?.effDate || '');
    setUnitPrice(price ? String(price.unitPrice) : '');
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
    if (!effDate.trim()) next.effDate = 'Effective date is required.';
    const numericPrice = Number(unitPrice);
    if (!unitPrice.trim()) next.unitPrice = 'Unit price is required.';
    else if (!Number.isFinite(numericPrice) || numericPrice <= 0) next.unitPrice = 'Unit price must be greater than zero.';
    setFormErrors(next);
    if (Object.keys(next).length || submitting) return;
    setSubmitting(true);
    try {
      const editing = formMode === 'edit';
      const url = editing
        ? `/api/products/${encodeURIComponent(product.prodCode)}/prices/${encodeURIComponent(selected?.effDate || '')}`
        : `/api/products/${encodeURIComponent(product.prodCode)}/prices`;
      const response = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...requestHeaders(role, user) },
        body: JSON.stringify({ effDate: effDate.trim(), unitPrice: numericPrice }),
      });
      if (!response.ok) throw new Error(await readError(response));
      closeForm();
      await loadPrices();
    } catch (caught: unknown) {
      setFormErrors({ server: caught instanceof Error ? caught.message : 'Unable to save price record.' });
    } finally {
      setSubmitting(false);
    }
  };
  const deletePrice = async () => {
    if (!deleteRecord) return;
    setDeleteSubmitting(true);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(product.prodCode)}/prices/${encodeURIComponent(deleteRecord.effDate)}`, {
        method: 'DELETE',
        headers: requestHeaders(role, user),
      });
      if (!response.ok) throw new Error(await readError(response));
      setDeleteRecord(null);
      await loadPrices();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete price record.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const canEdit = isAdmin || (!rightsError && rights.includes('price.edit'));
  const canDelete = isAdmin || (!rightsError && rights.includes('price.delete'));
  const showActions = isAdmin || canEdit || canDelete;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="price-history-title" className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 id="price-history-title" className="text-base font-bold">Price History — {product.prodCode} ({product.description} · Unit: {product.unit || '—'})</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500" aria-label="Close dialog"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          {isAdmin && <div className="flex items-center justify-between border-b"><div className="flex gap-1">{(['Active', 'Inactive', 'All'] as const).map((status) => <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${statusFilter === status ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>{status}</button>)}</div><button type="button" onClick={() => openForm('add')} className="mb-2 inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Add Price</button></div>}
          {rightsError && role === 'User' && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">Price permissions could not be loaded. Administrative price actions are unavailable.</p>}
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs font-semibold uppercase"><tr><th className="px-4 py-3">EFFECTIVE DATE</th><th className="px-4 py-3">UNIT PRICE</th>{isAdmin && <><th className="px-4 py-3">STATUS</th><th className="px-4 py-3">STAMP</th></>}{showActions && <th className="px-4 py-3 text-right">ACTIONS</th>}</tr></thead><tbody className="divide-y">{loading ? <tr><td colSpan={isAdmin ? 5 : showActions ? 3 : 2} className="px-4 py-10 text-center text-slate-500">Loading price history…</td></tr> : prices.length === 0 ? <tr><td colSpan={isAdmin ? 5 : showActions ? 3 : 2} className="px-4 py-10 text-center text-slate-500">No price records found for this product. {isAdmin ? "Click '+ Add Price' to set an initial price." : ''}</td></tr> : prices.map((price) => <tr key={`${price.prodCode}-${price.effDate}`} className={price.status === 'Inactive' ? 'bg-slate-100' : ''}><td className="px-4 py-3 font-mono">{price.effDate}</td><td className="px-4 py-3">₱{Number(price.unitPrice).toFixed(2)}</td>{isAdmin && <><td className="px-4 py-3">{price.status || 'Active'}</td><td className="px-4 py-3 text-xs text-slate-500">{price.stamp || '—'}</td></>}{showActions && <td className="px-4 py-3"><div className="flex justify-end gap-2">{canEdit && <button type="button" onClick={() => openForm('edit', price)} className="h-8 rounded-md border px-2.5 text-xs font-semibold">Edit</button>}{canDelete && <button type="button" onClick={() => setDeleteRecord(price)} className="h-8 rounded-md border border-rose-200 px-2.5 text-xs font-semibold text-rose-700">Delete</button>}</div></td>}</tr>)}</tbody></table></div>
        </div>
      </div>
      {formMode && <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => event.currentTarget === event.target && closeForm()}><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl border bg-white shadow-xl"><div className="flex items-center justify-between border-b px-5 py-4"><h3 className="font-bold">{formMode === 'add' ? 'Add Price' : 'Edit Price'}</h3><button type="button" onClick={closeForm} aria-label="Close price form"><X className="h-4 w-4" /></button></div><form onSubmit={submitForm}><div className="space-y-4 px-5 py-5">{formErrors.server && <p role="alert" className="text-sm text-rose-700">{formErrors.server}</p>}<div><label className="mb-1.5 block text-sm font-semibold">Effective Date *</label><input type="date" value={effDate} disabled={formMode === 'edit' || submitting} onChange={(event) => setEffDate(event.target.value)} className="h-10 w-full rounded-lg border px-3" />{formErrors.effDate && <p className="mt-1 text-xs text-rose-700">{formErrors.effDate}</p>}</div><div><label className="mb-1.5 block text-sm font-semibold">Unit Price *</label><input type="number" min="0.01" step="0.01" value={unitPrice} disabled={submitting} onChange={(event) => setUnitPrice(event.target.value)} className="h-10 w-full rounded-lg border px-3" />{formErrors.unitPrice && <p className="mt-1 text-xs text-rose-700">{formErrors.unitPrice}</p>}</div></div><div className="flex justify-end gap-2 border-t px-5 py-4"><button type="button" disabled={submitting} onClick={closeForm} className="h-10 rounded-lg border px-4 text-sm font-semibold">Cancel</button><button type="submit" disabled={submitting} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">{submitting ? 'Saving…' : 'Save Price'}</button></div></form></div></div>}
      {deleteRecord && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4"><div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-xl border bg-white shadow-xl"><div className="px-5 py-5"><p className="text-sm">Are you sure you want to delete this record? This action will deactivate the record.</p></div><div className="flex justify-end gap-2 border-t px-5 py-4"><button type="button" disabled={deleteSubmitting} onClick={() => setDeleteRecord(null)} className="h-10 rounded-lg border px-4 text-sm font-semibold">Cancel</button><button type="button" disabled={deleteSubmitting} onClick={() => void deletePrice()} className="h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white">{deleteSubmitting ? 'Deleting…' : 'Delete'}</button></div></div></div>}
    </div>
  );
}
