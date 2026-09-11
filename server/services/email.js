// Thin email sender. Uses Resend when RESEND_API_KEY is set; otherwise a
// no-op that logs and reports skipped, same graceful-degradation
// discipline as the Groq/OpenAI services, so nothing in the app breaks
// without an email provider configured.
//
// FROM_EMAIL must be a verified sender/domain in Resend. APP_URL is the
// public frontend URL (Vercel), used for "open the app" links. Links that
// hit the API itself (the unsubscribe endpoint) use apiUrl() instead, 
// Render injects RENDER_EXTERNAL_URL automatically, so that needs no config.

const RESEND_URL = 'https://api.resend.com/emails';

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL);
}

// Frontend links (Vercel).
export function appUrl(path = '') {
  const base = (process.env.APP_URL || '').replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}

// Links served by this API process (e.g. /api/unsubscribe).
export function apiUrl(path = '') {
  const base = (process.env.API_URL || process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || '').replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}

// Returns { ok: true } on send, { ok: false, skipped: true } when no
// provider is configured, { ok: false, error } on failure. Never throws.
export async function sendEmail({ to, subject, html, text }) {
  if (!emailConfigured()) {
    console.log(`[email] skipped (no RESEND_API_KEY/FROM_EMAIL): would send "${subject}" to ${to}`);
    return { ok: false, skipped: true };
  }
  if (!to || !subject || (!html && !text)) return { ok: false, error: 'missing fields' };

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL,
        to: [to],
        subject,
        html: html || undefined,
        text: text || undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] send failed (${res.status}): ${body.slice(0, 200)}`);
      return { ok: false, error: `${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error('[email] send threw:', err.message);
    return { ok: false, error: err.message };
  }
}

// Minimal, safe HTML wrapper, plain, no external assets.
export function wrapHtml(bodyHtml, unsubscribeUrl) {
  return (
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.6">` +
    bodyHtml +
    (unsubscribeUrl
      ? `<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/><p style="font-size:12px;color:#888">You're getting this because you have an application in progress on Microfinance Matchmaker. <a href="${unsubscribeUrl}" style="color:#888">Turn off these reminders</a>.</p>`
      : '') +
    `</div>`
  );
}
