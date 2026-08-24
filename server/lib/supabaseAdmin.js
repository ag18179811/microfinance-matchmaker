import { createClient } from '@supabase/supabase-js';

// Server-only client, using the service role key. Used for (1) verifying a
// user's access token via auth.getUser(), and (2) running privileged queries
// on their behalf once server-side ownership checks have already passed —
// it never receives an untrusted token from the client for anything beyond
// that verification call.
//
// Lazily created (not validated at import time) so this module can be
// imported safely in tests without real Supabase credentials configured —
// the same discipline groq-extract.js and groq-coach.js already use for
// GROQ_API_KEY.
let client = null;

export function getSupabaseAdmin() {
  if (client) return client;
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set. Get them from Supabase (Project Settings -> API). ' +
        'The service role key is a full database bypass credential — it must only ever live in the server .env, never in the client.'
    );
  }
  client = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
