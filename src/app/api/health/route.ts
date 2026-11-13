import { NextResponse } from 'next/server';
import { isSupabaseConfigured, getSqliteDb } from '@/lib/erp-db';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const started = Date.now();
  let supabaseConnected = false;
  let supabaseMessage: string = 'Not configured or offline (local HopeERP.db active)';
  let sqliteConnected = false;
  let counts: any = {};

  let supabaseUserCount: number | null = null;

  // Check SQLite
  try {
    const db = getSqliteDb();
    const cust = db.prepare("SELECT COUNT(*) as c FROM CUSTOMER").get() as any;
    const users = db.prepare("SELECT COUNT(*) as c FROM app_user").get() as any;
    sqliteConnected = true;
    counts = { customers: cust?.c || 0, users: users?.c || 0 };
  } catch (e: any) {
    sqliteConnected = false;
  }

  // Check Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = getAdminClient();
      const { error } = await supabase.from('role').select('roleName').limit(1);
      if (!error) {
        supabaseConnected = true;
        supabaseMessage = 'Connected to Supabase PostgreSQL';
        const { count } = await supabase.from('app_user').select('*', { count: 'exact', head: true });
        if (typeof count === 'number') {
          supabaseUserCount = count;
        }
      } else {
        supabaseMessage = `Supabase query error: ${error.message}`;
      }
    } catch (err: any) {
      supabaseMessage = `Supabase unreachable: ${err.message}`;
    }
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - started,
    database: {
      activeEngine: supabaseConnected ? 'Supabase Cloud (PostgreSQL)' : 'Local SQLite Engine (HopeERP.db)',
      sqlite: {
        connected: sqliteConnected,
        recordCounts: counts,
      },
      supabase: {
        configured: isSupabaseConfigured(),
        connected: supabaseConnected,
        userCount: supabaseUserCount,
        status: supabaseMessage,
      },
    },
    version: '1.0.0-hope-erp',
  });
}
