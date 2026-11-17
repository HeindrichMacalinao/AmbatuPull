import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Hope, Inc. ERP — Enterprise Business Suite',
  description: 'Centralized operational ERP suite featuring multi-role RBAC, dual-mode relational database persistence, and dark navy enterprise styling.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (stored === 'dark' || (!stored && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[var(--canvas)] text-[var(--text-primary)] antialiased selection:bg-blue-600 selection:text-white transition-colors duration-150">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="bg-white dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <strong className="text-slate-700 dark:text-slate-200 font-semibold">Hope, Inc. ERP</strong> &copy; {new Date().getFullYear()} &bull; Enterprise Operations Platform
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
              <span>Next.js App Router</span>
              <span>&bull;</span>
              <span>Relational Engine &amp; Supabase</span>
              <span>&bull;</span>
              <span>Granular 36-Rights RBAC</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
