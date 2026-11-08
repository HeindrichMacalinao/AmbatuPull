import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Hope, Inc. ERP — System Foundation',
  description: 'Enterprise Resource Planning system powered by Next.js, Supabase, and Vercel',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased">
        <header className="bg-slate-900 text-slate-100 border-b border-slate-800 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm">
                H
              </div>
              <Link href="/" className="font-semibold text-lg tracking-tight hover:text-blue-300 transition">
                Hope, Inc. ERP
              </Link>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 font-mono border border-blue-700/50">
                Next.js + Supabase
              </span>
            </div>

            <nav className="flex items-center gap-2 sm:gap-4 text-sm font-medium">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition"
              >
                Dashboard
              </Link>
              <Link
                href="/users"
                className="px-3 py-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition"
              >
                User Management
              </Link>
              <Link
                href="/login"
                className="ml-2 px-3.5 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-500 transition shadow-sm"
              >
                Sign In
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4">
            Hope, Inc. ERP &copy; {new Date().getFullYear()} &bull; Built with Next.js, Supabase &amp; Vercel &bull; AmbatuPull Sprint 1
          </div>
        </footer>
      </body>
    </html>
  );
}
