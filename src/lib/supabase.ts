import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const invalidEnvironmentVariables = [
  !supabaseUrl?.trim() || supabaseUrl.includes('your-project.supabase.co')
    ? 'VITE_SUPABASE_URL'
    : null,
  !supabaseAnonKey?.trim() || supabaseAnonKey === 'your-supabase-anon-key'
    ? 'VITE_SUPABASE_ANON_KEY'
    : null,
].filter((variable): variable is string => variable !== null);

export const isSupabaseConfigured = invalidEnvironmentVariables.length === 0;
export const supabaseConfigurationError = invalidEnvironmentVariables;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
