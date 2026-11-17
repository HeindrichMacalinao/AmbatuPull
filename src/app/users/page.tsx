'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Shield,
  Lock,
  Unlock,
  Key,
  X,
  Check,
  AlertCircle,
  CheckCircle2,
  Filter,
  RefreshCw,
  Database,
} from 'lucide-react';
import type { AppUser, RoleName } from '@/types/erp';

function formatRegistrationTime(createdAt?: string | null) {
  if (!createdAt) return 'Unavailable';
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString();
}

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [notification, setNotification] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<RoleName>('User');
  const [newEmpNo, setNewEmpNo] = useState('');

  // Rights Modal State
  const [showRightsModal, setShowRightsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [allRights, setAllRights] = useState<any[]>([]);
  const [userRights, setUserRights] = useState<string[]>([]);
  const [savingRights, setSavingRights] = useState(false);

  // Load Users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.append('search', search);
      if (roleFilter !== 'all') q.append('role', roleFilter);
      q.append('_t', Date.now().toString());

      const res = await fetch(`/api/users?${q.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
      if (data.provider) {
        setProvider(data.provider);
      }
    } catch {
      setNotification({ type: 'error', message: 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter]);

  // Handle Block / Unblock with Last-Superadmin Safeguard
  const handleToggleBlock = async (user: AppUser) => {
    const newBlockedState = !user.isBlocked;
    setNotification(null);

    try {
      const res = await fetch(`/api/users/${user.userId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: newBlockedState }),
      });

      const data = await res.json();
      if (!res.ok) {
        setNotification({ type: 'error', message: data.error || 'Operation denied' });
        return;
      }

      setNotification({
        type: 'success',
        message: `${user.firstName} ${user.lastName} has been ${newBlockedState ? 'blocked' : 'unblocked'}.`,
      });
      fetchUsers();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Block action failed' });
    }
  };

  // Open Rights Dialog
  const handleOpenRights = async (user: AppUser) => {
    setSelectedUser(user);
    setShowRightsModal(true);
    try {
      const res = await fetch(`/api/users/${user.userId}/rights`);
      const data = await res.json();
      if (data.allRights) setAllRights(data.allRights);
      if (data.grantedRights) setUserRights(data.grantedRights);
    } catch {
      setNotification({ type: 'error', message: 'Failed to fetch user permissions' });
    }
  };

  // Toggle individual right
  const toggleRight = (code: string) => {
    if (userRights.includes(code)) {
      setUserRights(userRights.filter((r) => r !== code));
    } else {
      setUserRights([...userRights, code]);
    }
  };

  // Shortcuts: All and None (Student Guide §3.8)
  const selectAllRights = () => {
    setUserRights(allRights.map((r) => r.rightCode));
  };

  const clearAllRights = () => {
    setUserRights([]);
  };

  const selectModuleRights = (moduleKey: string) => {
    const moduleCodes = (groupedRights[moduleKey] || []).map((r) => r.rightCode);
    setUserRights(Array.from(new Set([...userRights, ...moduleCodes])));
  };

  const clearModuleRights = (moduleKey: string) => {
    const moduleCodes = new Set((groupedRights[moduleKey] || []).map((r) => r.rightCode));
    setUserRights(userRights.filter((c) => !moduleCodes.has(c)));
  };

  // Save Rights
  const handleSaveRights = async () => {
    if (!selectedUser) return;
    setSavingRights(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.userId}/rights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rights: userRights }),
      });
      if (!res.ok) throw new Error('Failed to save permissions');
      setNotification({
        type: 'success',
        message: `Updated permissions for ${selectedUser.firstName} (${userRights.length} rights granted).`,
      });
      setShowRightsModal(false);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setSavingRights(false);
    }
  };

  // Create New User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: newFirstName,
          lastName: newLastName,
          email: newEmail,
          password: newPassword,
          role: newRole,
          empNo: newEmpNo || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'User creation failed');

      setNotification({ type: 'success', message: `User ${newFirstName} created successfully!` });
      setShowAddModal(false);
      // Reset form
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('User');
      setNewEmpNo('');
      fetchUsers();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  // Group rights by module
  const groupedRights: Record<string, any[]> = {};
  allRights.forEach((r) => {
    if (!groupedRights[r.moduleCode]) groupedRights[r.moduleCode] = [];
    groupedRights[r.moduleCode].push(r);
  });

  // Calculate Status Tab counts (§3.3 & docs/ui/design-system.md)
  const totalCount = users.length;
  const activeCount = users.filter((u) => !u.isBlocked).length;
  const blockedCount = users.filter((u) => u.isBlocked).length;

  const displayedUsers = users.filter((u) => {
    if (statusFilter === 'active') return !u.isBlocked;
    if (statusFilter === 'blocked') return u.isBlocked;
    return true;
  });

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            User Management &amp; Security
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Superadmin governance, account blocking safeguards, and 36 granular rights assignment.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {provider && (
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                provider === 'supabase'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
              title={
                provider === 'supabase'
                  ? 'Live connected to Supabase Cloud PostgreSQL'
                  : 'Running on local SQLite. Configure Supabase keys in Vercel to sync across all lambdas.'
              }
            >
              <Database className="w-3.5 h-3.5" />
              <span>{provider === 'supabase' ? 'Supabase Live' : 'SQLite Local'}</span>
            </span>
          )}

          <button
            type="button"
            onClick={fetchUsers}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg text-xs sm:text-sm border border-slate-300 dark:border-slate-700 transition shadow-xs disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Refresh user list from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-lg text-xs sm:text-sm transition shadow-xs focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          role="alert"
          className={`p-3.5 rounded-lg text-xs sm:text-sm flex items-start gap-2.5 border transition ${
            notification.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          )}
          <span className="flex-1">{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Tabs (§3.3 & docs/ui/design-system.md) */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 -mb-px transition flex items-center gap-1.5 ${
            statusFilter === 'all'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>All Accounts</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('active')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 -mb-px transition flex items-center gap-1.5 ${
            statusFilter === 'active'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>Active</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
            {activeCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('blocked')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 -mb-px transition flex items-center gap-1.5 ${
            statusFilter === 'blocked'
              ? 'border-rose-600 text-rose-700 dark:text-rose-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>Blocked / Inactive</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
            {blockedCount}
          </span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center gap-3 transition-colors">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-400 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg py-2 px-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-400 transition"
          >
            <option value="all">All Roles</option>
            <option value="Superadmin">Superadmin</option>
            <option value="Admin">Admin</option>
            <option value="User">User</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th scope="col" className="py-3 px-4">User</th>
                <th scope="col" className="py-3 px-4">Role</th>
                <th scope="col" className="py-3 px-4">Employee ID</th>
                <th scope="col" className="py-3 px-4">Account Status</th>
                <th scope="col" className="py-3 px-4">Registered</th>
                <th scope="col" className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Loading authorized user registry...</span>
                    </div>
                  </td>
                </tr>
              ) : displayedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 dark:text-slate-500">
                    <div className="max-w-sm mx-auto space-y-2">
                      <p className="font-medium text-slate-700 dark:text-slate-300">No users found</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {search || roleFilter !== 'all' || statusFilter !== 'all'
                          ? 'No account matches the current filter criteria.'
                          : 'No user accounts found in the active database engine.'}
                      </p>
                      {(search || roleFilter !== 'all' || statusFilter !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setRoleFilter('all');
                            setStatusFilter('all');
                          }}
                          className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayedUsers.map((u) => (
                  <tr
                    key={u.userId}
                    className={`transition ${
                      u.isBlocked
                        ? 'bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-500'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {u.firstName} {u.lastName}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{u.email}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold ${
                          u.role === 'Superadmin'
                            ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                            : u.role === 'Admin'
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        {u.role}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {u.empNo || '—'}
                    </td>

                    <td className="py-3.5 px-4">
                      {u.isBlocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                          <Lock className="w-3 h-3" />
                          Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
                          <Check className="w-3 h-3" />
                          Active
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                      {formatRegistrationTime(u.createdAt)}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleOpenRights(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition focus-visible:ring-2 focus-visible:ring-blue-500"
                        title="Configure 36 granular rights"
                      >
                        <Key className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Rights</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleBlock(u)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition focus-visible:ring-2 ${
                          u.isBlocked
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border-emerald-200 dark:border-emerald-800 focus-visible:ring-emerald-500'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border-rose-200 dark:border-rose-900/60 focus-visible:ring-rose-500'
                        }`}
                        title={u.isBlocked ? 'Unblock user account' : 'Block user account'}
                      >
                        {u.isBlocked ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Unblock</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Block</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 transition-colors">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">Add New ERP Account</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Close add user dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Corporate Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-400 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as RoleName)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-400 transition"
                  >
                    <option value="User">User</option>
                    <option value="Admin">Admin</option>
                    <option value="Superadmin">Superadmin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Employee ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP004"
                    value={newEmpNo}
                    onChange={(e) => setNewEmpNo(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 dark:focus:border-blue-400 transition"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs transition focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Granular Rights Modal (36 Rights) */}
      {showRightsModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col transition-colors">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Granular Permissions Matrix (36 Rights)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configuring authorization for <strong className="text-slate-800 dark:text-slate-200">{selectedUser.firstName} {selectedUser.lastName}</strong> ({selectedUser.role})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllRights}
                  className="px-2.5 py-1 text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded border border-blue-200 dark:border-blue-800 transition"
                >
                  All (36)
                </button>
                <button
                  type="button"
                  onClick={clearAllRights}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 transition"
                >
                  None
                </button>
                <button
                  type="button"
                  onClick={() => setShowRightsModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1.5"
                  aria-label="Close permissions dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {Object.keys(groupedRights).map((moduleKey) => (
                <div key={moduleKey} className="bg-slate-50 dark:bg-slate-800/50 p-3.5 sm:p-4 rounded-lg border border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Module: {moduleKey.replace('_', ' ').toUpperCase()} ({groupedRights[moduleKey].length} Rights)
                    </h3>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => selectModuleRights(moduleKey)}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                      >
                        All
                      </button>
                      <span className="text-slate-300 dark:text-slate-600">&bull;</span>
                      <button
                        type="button"
                        onClick={() => clearModuleRights(moduleKey)}
                        className="text-[11px] text-slate-500 dark:text-slate-400 hover:underline"
                      >
                        None
                      </button>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1 font-mono">
                        ({groupedRights[moduleKey].filter((r) => userRights.includes(r.rightCode)).length} / {groupedRights[moduleKey].length})
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {groupedRights[moduleKey].map((r) => {
                      const granted = userRights.includes(r.rightCode);
                      return (
                        <label
                          key={r.rightCode}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-start gap-2.5 transition ${
                            granted
                              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                              : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={granted}
                            onChange={() => toggleRight(r.rightCode)}
                            className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 mt-0.5"
                          />
                          <div>
                            <div className="font-mono font-semibold text-[11px]">{r.rightCode}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{r.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Total Granted: <strong className="text-slate-800 dark:text-slate-200">{userRights.length}</strong> of 36 Rights
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRightsModal(false)}
                  className="px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRights}
                  disabled={savingRights}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {savingRights ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
