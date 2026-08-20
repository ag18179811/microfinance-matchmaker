export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="brand" style={{ cursor: 'default' }}>
            <span className="brand-mark">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 10.5l3-4 2.5 2.5L13 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="brand-name">Microfinance Matchmaker</span>
          </div>
          <p className="footer-tagline">
            Helping small business owners find real CDFI and city microloan programs — and get ready to apply.
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
