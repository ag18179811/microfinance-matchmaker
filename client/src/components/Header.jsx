export default function Header({ onLogoClick }) {
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
        </button>
      </div>
    </header>
  );
}
