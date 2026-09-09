import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '../api.js';

// Upload the documents lenders ask for once, tagged by kind. Lender prep
// then shows "you have 2 of 5 documents this program needs". Files are
// private; downloads go through a short-lived signed URL.

const KIND_ORDER = [
  'bank_statement', 'tax_return', 'financial_statement', 'business_plan',
  'projections', 'id', 'voided_check', 'registration', 'other',
];

function fmtSize(bytes) {
  if (!bytes) return '';
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

export default function DocumentVault({ applicationId, onChange }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState([]);
  const [kinds, setKinds] = useState({});
  const [kind, setKind] = useState('bank_statement');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const loadedRef = useRef(false);

  async function load() {
    try {
      const res = await authedFetch(`/api/documents/${applicationId}`);
      const data = await res.json();
      if (res.ok) {
        setDocs(data.documents || []);
        setKinds(data.kinds || {});
      }
    } catch {
      /* non-critical */
    }
  }

  useEffect(() => {
    if (open && !loadedRef.current) {
      loadedRef.current = true;
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      const res = await authedFetch(`/api/documents/${applicationId}`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      await load();
      onChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function download(doc) {
    try {
      const res = await authedFetch(`/api/documents/${applicationId}/${doc.id}/url`);
      const data = await res.json();
      if (res.ok && data.url) window.open(data.url, '_blank', 'noreferrer');
    } catch {
      /* non-critical */
    }
  }

  async function remove(doc) {
    if (!window.confirm(`Remove ${doc.filename}?`)) return;
    try {
      const res = await authedFetch(`/api/documents/${applicationId}/${doc.id}`, { method: 'DELETE' });
      if (res.ok) {
        await load();
        onChange?.();
      }
    } catch {
      /* non-critical */
    }
  }

  const sortedKinds = Object.keys(kinds).sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b));

  return (
    <div className="dv-card">
      <button type="button" className="cf-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="dv-panel">
        <span>
          <span className="cf-toggle-title">Document vault{docs.length > 0 ? ` (${docs.length})` : ''}</span>
          <span className="cf-toggle-sub">
            Upload what lenders ask for once — bank statements, tax returns, your plan
          </span>
        </span>
        <span className={`whatif-chevron ${open ? 'is-open' : ''}`} aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="cf-body" id="dv-panel" role="region" aria-label="Document vault">
          <div className="dv-upload">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {sortedKinds.map((k) => (
                <option key={k} value={k}>{kinds[k]}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? 'Uploading…' : 'Upload a file'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx"
              style={{ display: 'none' }}
              onChange={onFile}
            />
          </div>
          {error && <p className="bc-error">{error}</p>}

          {docs.length === 0 ? (
            <p className="dv-empty">Nothing uploaded yet. Files stay private — only you and this app can open them.</p>
          ) : (
            <ul className="dv-list">
              {docs.map((d) => (
                <li key={d.id}>
                  <span className="dv-kind">{d.kindLabel}</span>
                  <button type="button" className="dv-name" onClick={() => download(d)}>
                    {d.filename}
                  </button>
                  <span className="dv-size">{fmtSize(d.sizeBytes)}</span>
                  <button type="button" className="tracker-remove" onClick={() => remove(d)} aria-label="Remove">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
