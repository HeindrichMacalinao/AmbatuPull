'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Shield,
  ShieldCheck,
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

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            User Management &amp; RBAC
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Superadmin governance, account blocking safeguards, and granular 36-rights assignment.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {provider && (
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                provider === 'supabase'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
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
            onClick={fetchUsers}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg text-sm border border-slate-300 transition shadow-sm disabled:opacity-50"
            title="Refresh user list from database"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-lg text-sm flex items-start gap-2 border ${
            notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-slate-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
          >
            <option value="all">All Roles</option>
            <option value="Superadmin">Superadmin</option>
            <option value="Admin">Admin</option>
            <option value="User">User</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Registered</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.userId} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {u.firstName} {u.lastName}
                      </div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          u.role === 'Superadmin'
                            ? 'bg-purple-100 text-purple-800'
                            : u.role === 'Admin'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        {u.role}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      {u.empNo || '—'}
                    </td>

                    <td className="py-3.5 px-4">
                      {u.isBlocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                          <Lock className="w-3 h-3" />
                          Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <Check className="w-3 h-3" />
                          Active
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                      {formatRegistrationTime(u.createdAt)}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenRights(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
                        title="Manage 36 granular permissions"
                      >
                        <Key className="w-3.5 h-3.5 text-blue-600" />
                        Rights
                      </button>

                      <button
                        onClick={() => handleToggleBlock(u)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                          u.isBlocked
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                        title={u.isBlocked ? 'Unblock user' : 'Block user'}
                      >
                        {u.isBlocked ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            Unblock
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            Block
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Add New ERP Account</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as RoleName)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="User">User</option>
                    <option value="Admin">Admin</option>
                    <option value="Superadmin">Superadmin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employee ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP004"
                    value={newEmpNo}
                    onChange={(e) => setNewEmpNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Key className="w-5 h-5 text-blue-600" />
                  Configure Granular Permissions (36 Rights)
                </h2>
                <p className="text-xs text-slate-500">
                  Editing rights for {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.role})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllRights}
                  className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md border border-blue-200 transition"
                >
                  All (Grant All 36)
                </button>
                <button
                  type="button"
                  onClick={clearAllRights}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md transition"
                >
                  None (Revoke All)
                </button>
                <button onClick={() => setShowRightsModal(false)} className="text-slate-400 hover:text-slate-600 ml-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-6">
              {Object.keys(groupedRights).map((moduleKey) => (
                <div key={moduleKey} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Module: {moduleKey.replace('_', ' ').toUpperCase()} ({groupedRights[moduleKey].length} Rights)
                    </h3>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => selectModuleRights(moduleKey)}
                        className="text-[11px] text-blue-600 hover:underline font-medium"
                      >
                        All
                      </button>
                      <span className="text-slate-300">&bull;</span>
                      <button
                        type="button"
                        onClick={() => clearModuleRights(moduleKey)}
                        className="text-[11px] text-slate-500 hover:underline"
                      >
                        None
                      </button>
                      <span className="text-[11px] text-slate-500 ml-1 font-mono">
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
                              ? 'bg-blue-50/70 border-blue-300 text-blue-900'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={granted}
                            onChange={() => toggleRight(r.rightCode)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                          />
                          <div>
                            <div className="font-mono font-medium text-[11px]">{r.rightCode}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{r.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-slate-500">
                Total Granted: <strong>{userRights.length}</strong> of 36 Rights
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRightsModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRights}
                  disabled={savingRights}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
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
