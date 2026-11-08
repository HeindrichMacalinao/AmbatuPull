import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const started = Date.now();
  let supabaseConnected = false;
  let error: string | null = null;

  try {
    const supabase = getAdminClient();
    const { error: queryError } = await supabase.from('role').select('roleName').limit(1);
    if (!queryError) {
      supabaseConnected = true;
    } else {
      error = queryError.message;
    }
  } catch (err: any) {
    error = err.message || 'Supabase connection failed';
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - started,
    supabase: {
      connected: supabaseConnected,
      error,
    },
    version: '1.0.0-next-supabase',
  });
}
