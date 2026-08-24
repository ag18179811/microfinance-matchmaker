export default function SignIn({ onSignIn }) {
  return (
    <div className="hero">
      <span className="hero-eyebrow">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1l1.4 3 3.3.4-2.4 2.3.6 3.3L6 8.4 3.1 10l.6-3.3L1.3 4.4l3.3-.4L6 1z" fill="currentColor" />
        </svg>
        AI-powered funding readiness
      </span>
      <h1>Sign in to get started</h1>
      <p className="hero-subtitle">
        Your funding readiness score, matched lenders, and full chat history are saved to your account so you can
        pick up the conversation anytime.
      </p>

      <button type="button" className="google-signin-btn" onClick={onSignIn}>
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.71v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.61z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 009 18z"
          />
          <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 013.68 9c0-.59.1-1.17.27-1.7V4.97H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
          />
        </svg>
        Sign in with Google
      </button>

      <div className="trust-row" style={{ marginTop: '2rem' }}>
        <span className="trust-item">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="7" fill="var(--color-success-light)" />
            <path d="M4 7.2l2 2 4-4.4" stroke="var(--color-success)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Google handles your sign-in — we never see or store a password
        </span>
      </div>
    </div>
  );
}
