export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="brand" style={{ cursor: 'default' }}>
            <span className="brand-mark">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 14V7.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M8 7.6C8 7.6 3.6 7.8 3 3.6C6.9 3.3 8 5.4 8 7.6Z" fill="white" />
                <path d="M8 7.6C8 7.6 12.4 7.8 13 3.6C9.1 3.3 8 5.4 8 7.6Z" fill="white" />
              </svg>
            </span>
            <span className="brand-name">Microfinance Matchmaker</span>
          </div>
          <p className="footer-tagline">
            Helping small business owners find real CDFI and city microloan programs, and get ready to apply.
          </p>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <div className="footer-col-title">Product</div>
            <a href="#how-it-works">How it works</a>
            <a href="#trust">Security &amp; trust</a>
          </div>
          <div className="footer-col">
            <div className="footer-col-title">Resources</div>
            <a href="https://www.cdfifund.gov" target="_blank" rel="noreferrer">
              CDFI Fund
            </a>
            <a href="https://www.sba.gov" target="_blank" rel="noreferrer">
              U.S. Small Business Administration
            </a>
          </div>
        </div>
      </div>

      <div className="footer-disclaimer">
        <p>
          Microfinance Matchmaker is not a lender and does not guarantee approval. Readiness scores and match
          percentages are informational estimates, not credit decisions. © {new Date().getFullYear()} Microfinance
          Matchmaker.
        </p>
      </div>
    </footer>
  );
}
