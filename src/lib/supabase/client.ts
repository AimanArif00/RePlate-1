import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function cleanEnv(value: string | undefined): string {
  return (value ?? '').trim().replace(/^['"]|['"]$/g, '');
}

const supabaseUrl = cleanEnv(
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL,
);

const supabaseAnonKey = cleanEnv(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  if (
    supabaseUrl.includes('YOUR_PROJECT_ID') ||
    supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY') ||
    supabaseAnonKey.includes('YOUR_SUPABASE_PUBLISHABLE_KEY') ||
    supabaseAnonKey.startsWith('sb_secret_')
  ) {
    return false;
  }
  return /^https?:\/\//i.test(supabaseUrl);
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return cachedClient;
}
