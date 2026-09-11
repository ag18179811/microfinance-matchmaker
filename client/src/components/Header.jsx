import { useState } from 'react';
import ThemeToggle from './ThemeToggle.jsx';

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Header({ stage, onLogoClick, user, onSignOut, onOpenHistory }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // The marketing nav (how it works / trust / CDFI link) only makes sense on
  // the logged-out landing. Those anchor sections don't exist once signed
  // in, where the describe screen goes straight to the composer.
  const isLanding = stage === 'describe' && !user;
  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.full_name || user?.email || 'Account';

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
              <path d="M8 14V7.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M8 7.6C8 7.6 3.6 7.8 3 3.6C6.9 3.3 8 5.4 8 7.6Z" fill="white" />
              <path d="M8 7.6C8 7.6 12.4 7.8 13 3.6C9.1 3.3 8 5.4 8 7.6Z" fill="white" />
            </svg>
          </span>
          <span className="brand-name">Microfinance Matchmaker</span>
        </button>

        <div className="topbar-right">
          {isLanding && (
            <nav className="nav-links">
              <button type="button" className="nav-link" onClick={() => scrollToId('features')}>
                Features
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
          )}

          <ThemeToggle />

          {user && (
            <>
              <button type="button" className="nav-icon-btn" onClick={onOpenHistory} aria-label="Chat history" title="Chat history">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M9 4.5v4.5l3 2M15.5 9a6.5 6.5 0 11-1.9-4.6M15.5 3v3.5H12"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <div className="user-menu">
                <button type="button" className="user-menu-trigger" onClick={() => setMenuOpen((v) => !v)} aria-label="Account menu">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="user-avatar" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="user-avatar user-avatar-fallback">{displayName[0]?.toUpperCase()}</span>
                  )}
                </button>
                {menuOpen && (
                  <>
                    <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                    <div className="user-menu-dropdown">
                      <div className="user-menu-name">{displayName}</div>
                      <button
                        type="button"
                        className="user-menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          onSignOut();
                        }}
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
