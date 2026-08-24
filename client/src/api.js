import { supabase } from './supabaseClient.js';

// In local dev this stays empty and Vite's proxy (vite.config.js) forwards
// /api/* to the server. In production, set VITE_API_BASE_URL at build time
// to the deployed backend's full origin (e.g. https://your-api.onrender.com).
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

// Every API call in this app is authenticated — this attaches the current
// Supabase session's access token so the backend can verify who's asking.
export async function authedFetch(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(apiUrl(path), { ...options, headers });
}
