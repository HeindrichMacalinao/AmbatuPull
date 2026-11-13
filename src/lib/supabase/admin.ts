import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function getAdminClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseUrl = rawUrl ? rawUrl.trim().replace(/^["']|["']$/g, '') : 'https://placeholder-url.supabase.co';
  const rawKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;
  const supabaseKey = rawKey ? rawKey.trim().replace(/^["']|["']$/g, '') : 'placeholder-key';

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
