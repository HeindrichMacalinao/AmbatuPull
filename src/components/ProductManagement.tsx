'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import type { AppUser, RoleName } from '@/types/erp';
import PriceHistoryModal from '@/components/PriceHistoryModal';

type StatusFilter = 'Active' | 'Inactive' | 'All';

interface ProductRecord {
  prodCode: string;
  description: string;
  unit: string | null;
  currentPrice: number | null;
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

export default function ProductManagement({ role, user }: { role: RoleName; user: AppUser | null }) {
  const isAdmin = role === 'Admin' || role === 'Superadmin';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [counts, setCounts] = useState<Record<StatusFilter, number>>({ Active: 0, Inactive: 0, All: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRights, setUserRights] = useState<string[]>([]);
  const [rightsError, setRightsError] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [selected, setSelected] = useState<ProductRecord | null>(null);
  const [prodCode, setProdCode] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ product: ProductRecord; action: 'delete' | 'restore' } | null>(null);
  const [confirmationSubmitting, setConfirmationSubmitting] = useState(false);
  const [priceProduct, setPriceProduct] = useState<ProductRecord | null>(null);
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
      return;
    }
    const controller = new AbortController();
    fetch(`/api/users/${user.userId}/rights`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load permissions');
        setUserRights(Array.isArray(data.grantedRights) ? data.grantedRights : []);
        setRightsError(false);
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === 'AbortError') return;
        setUserRights([]);
        setRightsError(true);
      });
    return () => controller.abort();
  }, [role, user?.userId]);

  const refreshCounts = useCallback(async () => {
    if (!isAdmin) {
      setCounts({ Active: products.length, Inactive: 0, All: products.length });
      return;
    }
    const responses = await Promise.all([
      fetch('/api/products?status=active', { headers: requestHeaders(role, user) }),
      fetch('/api/products?status=inactive', { headers: requestHeaders(role, user) }),
      fetch('/api/products?status=all', { headers: requestHeaders(role, user) }),
    ]);
    for (const response of responses) if (!response.ok) throw new Error(await readError(response));
    const [active, inactive, all] = await Promise.all(responses.map((response) => response.json()));
    setCounts({
      Active: Array.isArray(active.products) ? active.products.length : 0,
      Inactive: Array.isArray(inactive.products) ? inactive.products.length : 0,
      All: Array.isArray(all.products) ? all.products.length : 0,
    });
  }, [isAdmin, role, user, products.length]);

  const loadProducts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    params.set('status', isAdmin ? statusFilter.toLowerCase() : 'active');
    try {
      const response = await fetch(`/api/products?${params.toString()}`, { headers: requestHeaders(role, user), signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load products');
      if (!Array.isArray(data.products)) throw new Error('The product API returned an invalid response.');
      setProducts(data.products);
      if (isAdmin) await refreshCounts();
      else setCounts({ Active: data.products.length, Inactive: 0, All: data.products.length });
    } catch (caught: unknown) {
      if (caught instanceof Error && caught.name === 'AbortError') return;
      setProducts([]);
      setError(caught instanceof Error ? caught.message : 'Failed to load products');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [debouncedSearch, isAdmin, refreshCounts, role, statusFilter, user]);

  useEffect(() => {
    const controller = new AbortController();
    void loadProducts(controller.signal);
    return () => controller.abort();
  }, [loadProducts]);

  const openForm = (mode: 'add' | 'edit', product?: ProductRecord) => {
    setFormMode(mode);
    setSelected(product || null);
    setProdCode(product?.prodCode || '');
    setDescription(product?.description || '');
    setUnit(product?.unit || 'pcs');
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
    if (formMode === 'add' && !prodCode.trim()) next.prodCode = 'Product code is required.';
    if (!description.trim()) next.description = 'Description is required.';
    setFormErrors(next);
    if (Object.keys(next).length || submitting) return;
    setSubmitting(true);
    try {
      const editing = formMode === 'edit';
      const response = await fetch(editing ? `/api/products/${encodeURIComponent(selected?.prodCode || '')}` : '/api/products', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...requestHeaders(role, user) },
        body: JSON.stringify(editing ? { description: description.trim(), unit } : { prodCode: prodCode.trim(), description: description.trim(), unit }),
      });
      if (!response.ok) throw new Error(await readError(response));
      closeForm();
      await loadProducts();
      showToast('success', editing ? 'Product updated successfully.' : 'Product created successfully.');
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : 'Unable to save product.';
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
      const restore = confirmation.action === 'restore';
      const response = await fetch(
        restore
          ? `/api/products/${encodeURIComponent(confirmation.product.prodCode)}/restore`
          : `/api/products/${encodeURIComponent(confirmation.product.prodCode)}`,
        { method: restore ? 'PUT' : 'DELETE', headers: requestHeaders(role, user) }
      );
      if (!response.ok) throw new Error(await readError(response));
      await loadProducts();
      setConfirmation(null);
      showToast('success', restore ? 'Product restored successfully.' : 'Product deleted successfully.');
    } catch (caught: unknown) {
      showToast('error', caught instanceof Error ? caught.message : 'Unable to update product.');
    } finally {
      setConfirmationSubmitting(false);
    }
  };

  const canEdit = isAdmin;
  const canDelete = isAdmin;
  const visibleCount = useMemo(() => `${products.length} product${products.length === 1 ? '' : 's'}`, [products.length]);

  return (
    <section className="space-y-5" aria-labelledby="product-management-title">
      {toast && <div role="status" className={`fixed right-4 top-4 z-[70] rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{toast.message}</div>}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 id="product-management-title" className="text-xl font-bold text-slate-900 dark:text-slate-100">Product Management</h1><p className="mt-1 text-sm text-slate-500">Manage product records and dynamic pricing.</p></div>
        {canAdd && <button type="button" onClick={() => openForm('add')} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />Add Product</button>}
      </div>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {isAdmin && <div className="flex gap-1 border-b border-slate-200" role="tablist" aria-label="Product status">{(['Active', 'Inactive', 'All'] as const).map((status) => <button key={status} type="button" role="tab" aria-selected={statusFilter === status} onClick={() => setStatusFilter(status)} className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${statusFilter === status ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>{status}<span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{counts[status]}</span></button>)}</div>}
        <div className="flex items-center justify-between gap-3"><div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" aria-label="Search products" placeholder="Search products..." value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm" /></div>{isAdmin && <span className="text-xs text-slate-500">{visibleCount}</span>}</div>
        {role === 'User' && rightsError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Product permissions could not be loaded. Restricted actions are unavailable.</p>}
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs font-semibold uppercase"><tr><th className="px-4 py-3">PROD CODE</th><th className="px-4 py-3">DESCRIPTION</th><th className="px-4 py-3">UNIT</th><th className="px-4 py-3">CURRENT PRICE</th>{isAdmin && <><th className="px-4 py-3">STATUS</th><th className="px-4 py-3">STAMP</th></>}<th className="px-4 py-3 text-right">ACTIONS</th></tr></thead><tbody className="divide-y">{loading ? <tr><td colSpan={isAdmin ? 7 : 5} className="px-4 py-10 text-center text-slate-500">Loading products…</td></tr> : products.length === 0 ? <tr><td colSpan={isAdmin ? 7 : 5} className="px-4 py-10 text-center text-slate-500">{error ? 'Products unavailable.' : search.trim() ? `No customers/products found matching '${search.trim()}'. Clear search or add a new record.` : 'No products found.'}</td></tr> : products.map((product) => {
          const status = product.status || 'Active';
          return <tr key={product.prodCode} className={status === 'Inactive' ? 'bg-slate-100 dark:bg-slate-800/70' : ''}><td className="px-4 py-3 font-mono font-semibold">{product.prodCode}</td><td className="px-4 py-3 font-medium">{product.description}</td><td className="px-4 py-3">{product.unit || '—'}</td><td className="px-4 py-3">{status === 'Inactive' || product.currentPrice == null ? '—' : `₱${Number(product.currentPrice).toFixed(2)}`}</td>{isAdmin && <><td className="px-4 py-3"><span className={status === 'Active' ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800' : 'rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800'}>{status}</span></td><td className="px-4 py-3 text-xs text-slate-500">{product.stamp || '—'}</td></>}<td className="px-4 py-3"><div className="flex justify-end gap-2">{canPrice && <button type="button" onClick={() => setPriceProduct(product)} className="h-8 rounded-md border px-2.5 text-xs font-semibold text-blue-700">Prices</button>}{canEdit && <button type="button" onClick={() => openForm('edit', product)} className="h-8 rounded-md border px-2.5 text-xs font-semibold">Edit</button>}{status === 'Inactive' && isAdmin ? <button type="button" onClick={() => setConfirmation({ product, action: 'restore' })} className="h-8 rounded-md border border-emerald-200 px-2.5 text-xs font-semibold text-emerald-800">Restore</button> : canDelete && <button type="button" onClick={() => setConfirmation({ product, action: 'delete' })} className="h-8 rounded-md border border-rose-200 px-2.5 text-xs font-semibold text-rose-700">Delete</button>}</div></td></tr>;
        })}</tbody></table></div>
      </div>
      {formMode && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => event.currentTarget === event.target && closeForm()}><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-xl border bg-white shadow-xl"><div className="flex items-center justify-between border-b px-5 py-4"><h2 className="font-bold">{formMode === 'add' ? 'Add Product' : `Edit ${selected?.prodCode}`}</h2><button type="button" onClick={closeForm} aria-label="Close dialog"><X className="h-4 w-4" /></button></div><form onSubmit={submitForm}><div className="space-y-4 px-5 py-5">{formErrors.server && <p role="alert" className="text-sm text-rose-700">{formErrors.server}</p>}<div><label className="mb-1.5 block text-sm font-semibold">Product Code *</label><input value={prodCode} disabled={formMode === 'edit' || submitting} onChange={(event) => setProdCode(event.target.value)} className="h-10 w-full rounded-lg border px-3" />{formErrors.prodCode && <p className="mt-1 text-xs text-rose-700">{formErrors.prodCode}</p>}</div><div><label className="mb-1.5 block text-sm font-semibold">Description *</label><input value={description} disabled={submitting} onChange={(event) => setDescription(event.target.value)} className="h-10 w-full rounded-lg border px-3" />{formErrors.description && <p className="mt-1 text-xs text-rose-700">{formErrors.description}</p>}</div><div><label className="mb-1.5 block text-sm font-semibold">Packaging Unit</label><select value={unit} disabled={submitting} onChange={(event) => setUnit(event.target.value)} className="h-10 w-full rounded-lg border px-3">{['pcs','can','pair','meter','roll','box','kg'].map((value) => <option key={value} value={value}>{value}</option>)}</select></div></div><div className="flex justify-end gap-2 border-t px-5 py-4"><button type="button" disabled={submitting} onClick={closeForm} className="h-10 rounded-lg border px-4 text-sm font-semibold">Cancel</button><button type="submit" disabled={submitting} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">{submitting ? 'Saving…' : formMode === 'add' ? 'Add Product' : 'Save Changes'}</button></div></form></div></div>}
      {confirmation && <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/50 p-4"><div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-xl border bg-white shadow-xl"><div className="px-5 py-5"><p className="text-sm">{confirmation.action === 'delete' ? 'Are you sure you want to delete this record? This action will deactivate the record.' : 'Are you sure you want to restore this record? It will become available again.'}</p></div><div className="flex justify-end gap-2 border-t px-5 py-4"><button type="button" disabled={confirmationSubmitting} onClick={() => setConfirmation(null)} className="h-10 rounded-lg border px-4 text-sm font-semibold">Cancel</button><button type="button" disabled={confirmationSubmitting} onClick={() => void confirmMutation()} className={`h-10 rounded-lg px-4 text-sm font-semibold text-white ${confirmation.action === 'delete' ? 'bg-rose-600' : 'bg-emerald-600'}`}>{confirmationSubmitting ? 'Saving…' : confirmation.action === 'delete' ? 'Delete' : 'Restore'}</button></div></div></div>}
      {priceProduct && <PriceHistoryModal product={priceProduct} role={role} user={user} onClose={() => setPriceProduct(null)} />}
    </section>
  );
}
