import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set (see client/.env.example).');
}

// The anon key is safe to ship to the browser by design — it can only do
// what Supabase's row-level security policies (server/db/schema.sql) allow,
// and this app only ever uses it for auth, never for direct data queries.
export const supabase = createClient(url, anonKey);
