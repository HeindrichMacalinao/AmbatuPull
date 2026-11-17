'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  LogOut,
  LogIn,
  UserPlus,
  Database,
  Cloud,
  ChevronDown,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import type { AppUser } from '@/types/erp';
import ThemeToggle from '@/components/ThemeToggle';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [healthInfo, setHealthInfo] = useState<any>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Close menus on route change
  useEffect(() => {
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('erp_user');
    setCurrentUser(null);
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
    document.cookie = 'erp_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path;

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & System Status */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-xs group-hover:bg-blue-500 transition">
              H
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base tracking-tight text-white group-hover:text-blue-300 transition flex items-center gap-1.5 leading-tight">
                Hope, Inc. ERP
              </div>
              <div className="text-[10px] text-slate-400 font-medium tracking-wider uppercase leading-none">
                Enterprise Business Suite
              </div>
            </div>
          </Link>

          {/* Database Engine Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60">
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

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-2 text-sm font-medium">
          {currentUser && (
            <>
              <Link
                href="/dashboard"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  isActive('/dashboard')
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>

              {/* User Management tab visible to admin/superadmin */}
              {(currentUser.role === 'Admin' || currentUser.role === 'Superadmin') && (
                <Link
                  href="/users"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isActive('/users')
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>User Management</span>
                </Link>
              )}
            </>
          )}

          {/* Theme Toggle Button */}
          <ThemeToggle />

          {/* Auth State */}
          {currentUser ? (
            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 hover:bg-slate-700/80 text-slate-200 transition focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-expanded={userDropdownOpen}
                aria-haspopup="true"
              >
                <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                  {currentUser.firstName?.[0] || 'U'}
                </div>
                <div className="text-left text-xs">
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
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 text-slate-800 dark:text-slate-200 z-50">
                  <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Signed in as</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.email}</p>
                    <span
                      className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                        currentUser.role === 'Superadmin'
                          ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                          : currentUser.role === 'Admin'
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      <Shield className="w-2.5 h-2.5" />
                      {currentUser.role}
                    </span>
                  </div>

                  <Link
                    href="/dashboard"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
                    ERP Operations Dashboard
                  </Link>

                  {(currentUser.role === 'Admin' || currentUser.role === 'Superadmin') && (
                    <Link
                      href="/users"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                    >
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      User Management &amp; RBAC
                    </Link>
                  )}

                  <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-1">
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile controls: Theme toggle + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition border border-slate-700/60"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900/95 px-4 pt-3 pb-5 space-y-3">
          {currentUser ? (
            <div className="space-y-2">
              <div className="p-3 bg-slate-800/80 rounded-lg flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                  {currentUser.firstName?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-xs truncate">
                    {currentUser.firstName} {currentUser.lastName}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{currentUser.email}</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                  {currentUser.role}
                </span>
              </div>

              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                  isActive('/dashboard') ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>

              {(currentUser.role === 'Admin' || currentUser.role === 'Superadmin') && (
                <Link
                  href="/users"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                    isActive('/users') ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>User Management</span>
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:bg-slate-800 text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-100 hover:bg-slate-700"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Corporate Account</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
