function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Header({ stage, onLogoClick }) {
  const isLanding = stage === 'describe';

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button
          type="button"
          className="brand"
          onClick={onLogoClick}
          style={{ background: 'none', border: 'none', padding: 0, cursor: onLogoClick ? 'pointer' : 'default' }}
        >
          <span className="brand-mark">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 10.5l3-4 2.5 2.5L13 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="brand-name">Microfinance Matchmaker</span>
          <span className="brand-badge">Beta</span>
        </button>

        {isLanding ? (
          <nav className="nav-links">
            <button type="button" className="nav-link" onClick={() => scrollToId('how-it-works')}>
              How it works
            </button>
            <button type="button" className="nav-link" onClick={() => scrollToId('trust')}>
              Security &amp; trust
            </button>
            <a
              className="nav-link nav-link-external"
              href="https://www.cdfifund.gov/programs-training/programs/cdfi-fund-awards"
              target="_blank"
              rel="noreferrer"
            >
              CDFI Fund
            </a>
          </nav>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onLogoClick}>
            New application
          </button>
        )}
      </div>
    </header>
  );
}
