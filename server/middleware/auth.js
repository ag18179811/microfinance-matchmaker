import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

// Verifies the bearer token against Supabase and attaches req.userId. This
// is the ONLY source of truth for "who is making this request" anywhere in
// the app — no route ever trusts a user id supplied in a request body,
// query string, or URL param.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign-in required' });

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'Invalid or expired session' });

  req.userId = data.user.id;
  next();
}
