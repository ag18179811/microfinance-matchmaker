// In local dev this stays empty and Vite's proxy (vite.config.js) forwards
// /api/* to the server. In production, set VITE_API_BASE_URL at build time
// to the deployed backend's full origin (e.g. https://your-api.onrender.com).
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}
