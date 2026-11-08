import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Hope, Inc. ERP — Enterprise Business Suite',
  description: 'Enterprise Resource Planning system featuring multi-role RBAC, PostgreSQL and SQLite persistence, and Vercel cloud deployment.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <strong>Hope, Inc. ERP</strong> &copy; {new Date().getFullYear()} &bull; Enterprise Resource Planning Platform
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <span>Next.js App Router</span>
              <span>&bull;</span>
              <span>Supabase PostgreSQL</span>
              <span>&bull;</span>
              <span>Granular 36-Rights RBAC</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
