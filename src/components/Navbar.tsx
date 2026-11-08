'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  LogOut,
  LogIn,
  UserPlus,
  Database,
  Cloud,
  ChevronDown,
} from 'lucide-react';
import type { AppUser } from '@/types/erp';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [healthInfo, setHealthInfo] = useState<any>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    // Read logged in user from localStorage
    const syncUser = () => {
      const stored = localStorage.getItem('erp_user');
      if (stored) {
        try {
          setCurrentUser(JSON.parse(stored));
        } catch {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    };

    syncUser();
    window.addEventListener('storage', syncUser);

    // Fetch system health
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => setHealthInfo(data))
      .catch(() => {});

    return () => window.removeEventListener('storage', syncUser);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('erp_user');
    setCurrentUser(null);
    setUserDropdownOpen(false);
    // Also remove cookie via API or client-side expire
    document.cookie = 'erp_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path;

  return (
    <header className="bg-slate-900 text-slate-100 border-b border-slate-800 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & System Status */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm group-hover:bg-blue-500 transition">
              H
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-white group-hover:text-blue-300 transition flex items-center gap-1.5">
                Hope, Inc. ERP
              </div>
              <div className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
                Enterprise Business Suite
              </div>
            </div>
          </Link>

          {/* Database Engine Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            {healthInfo?.database?.supabase?.connected ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-blue-300">Supabase Cloud</span>
              </>
            ) : (
              <>
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Hope Relational Engine</span>
              </>
            )}
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2 text-sm font-medium">
          {currentUser && (
            <>
              <Link
                href="/dashboard"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  isActive('/dashboard')
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>

              {/* User Management tab visible to admin/superadmin */}
              {(currentUser.role === 'Admin' || currentUser.role === 'Superadmin') && (
                <Link
                  href="/users"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                    isActive('/users')
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>User Management</span>
                </Link>
              )}
            </>
          )}

          {/* Auth State: Logged In vs Logged Out */}
          {currentUser ? (
            <div className="relative ml-2">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 transition"
              >
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                  {currentUser.firstName?.[0] || 'U'}
                </div>
                <div className="hidden sm:block text-left text-xs">
                  <div className="font-semibold text-white leading-tight">
                    {currentUser.firstName} {currentUser.lastName}
                  </div>
                  <div className="text-[10px] text-blue-300 font-mono">
                    {currentUser.role}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 text-slate-800 z-50 animate-in fade-in slide-in-from-top-1">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-xs text-slate-500 font-medium">Signed in as</p>
                    <p className="text-xs font-bold text-slate-900 truncate">{currentUser.email}</p>
                    <span
                      className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        currentUser.role === 'Superadmin'
                          ? 'bg-purple-100 text-purple-800'
                          : currentUser.role === 'Admin'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                  </div>

                  <Link
                    href="/dashboard"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
                    ERP Workspace
                  </Link>

                  <Link
                    href="/users"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    Access Governance
                  </Link>

                  <div className="border-t border-slate-100 my-1" />

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-2">
              <Link
                href="/login"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  isActive('/login')
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
