import { useState } from 'react';
import ScoreGauge from './ScoreGauge.jsx';

function InterviewVisual() {
  return (
    <div className="feat-chat">
      <div className="feat-chat-msg feat-chat-msg-ai">
        How long have you been operating, and roughly what did you bring in last year?
      </div>
      <div className="feat-chat-msg feat-chat-msg-user">
        About 3 years. Somewhere around $180,000 last year.
      </div>
    </div>
  );
}

function ScoreVisual() {
  const factors = [['Time in business', 90], ['Cash flow pattern', 65]];
  return (
    <div className="feat-score">
      <ScoreGauge value={73} size={72} strokeWidth={7} />
      <div className="feat-score-factors">
        {factors.map(([label, pct]) => (
          <div className="feat-factor-row" key={label}>
            <span className="feat-factor-label">{label}</span>
            <div className="feat-factor-track"><div className="feat-factor-fill" style={{ width: `${pct}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImprovementVisual() {
  const levers = [
    ['Add 6 months of bank statements', '+8 pts'],
    ['Bring the ask within program range', '+5 pts'],
  ];
  return (
    <div className="feat-levers">
      {levers.map(([name, pts]) => (
        <div className="feat-lever-row" key={name}>
          <span className="feat-lever-name">{name}</span>
          <span className="feat-lever-badge">{pts}</span>
        </div>
      ))}
    </div>
  );
}

function FundingVisual() {
  return (
    <div className="feat-funding">
      <div className="feat-stack-bar">
        <div className="feat-stack-seg" style={{ width: '55%', background: 'var(--color-primary)' }} />
        <div className="feat-stack-seg" style={{ width: '25%', background: 'var(--color-accent)' }} />
        <div className="feat-stack-seg" style={{ width: '20%', background: 'var(--color-border-strong)' }} />
      </div>
      <div className="feat-stack-legend">
        <span><i style={{ background: 'var(--color-primary)' }} />CDFI term loan, $22k</span>
        <span><i style={{ background: 'var(--color-accent)' }} />Storefront grant, $10k</span>
        <span><i style={{ background: 'var(--color-border-strong)' }} />Owner contribution, $8k</span>
      </div>
    </div>
  );
}

function BusinessCaseVisual() {
  return (
    <div className="feat-quote">
      "I've run Rivera Family Bakery for three years. Revenue grew 22% last year on repeat catering
      orders, and this loan buys the walk-in cooler I've been renting space around."
    </div>
  );
}

function UnderwriterVisual() {
  return (
    <div className="feat-chat feat-chat-underwriter">
      <div className="feat-chat-msg feat-chat-msg-ai">
        Your cash flow shows two months with a negative balance. Walk me through what happened there.
      </div>
      <div className="feat-chat-msg feat-chat-msg-user">
        Both were oven repairs, one-time costs, not a pattern.
      </div>
    </div>
  );
}

const FEATURES = [
  {
    tabLabel: 'Interview',
    kicker: 'Before the match',
    title: 'One conversation, not a form',
    body: "Describe your business in plain English. The interview only asks about what you didn't already cover, and a half-finished conversation picks up right where you left off.",
    Visual: InterviewVisual,
  },
  {
    tabLabel: 'Readiness score',
    kicker: 'At the match',
    title: 'A score you can see the reasons for',
    body: 'Readiness is scored on five factors, revenue, time in business, credit, cash flow, and profile completeness, all on fixed rules, not a model. Every point gained or lost has a stated reason.',
    Visual: ScoreVisual,
  },
  {
    tabLabel: 'Improvement plan',
    kicker: 'At the match',
    title: 'A real plan to raise the number',
    body: 'Every lever comes with its actual projected impact: the scoring engine re-run with that one change applied, not a guess at what might help.',
    Visual: ImprovementVisual,
  },
  {
    tabLabel: 'Funding plan',
    kicker: 'At the match',
    title: "When one program isn't enough",
    body: 'If no single match covers what you need, the funding plan lays out a capital stack: which programs, how much from each, and the order to pursue them in.',
    Visual: FundingVisual,
  },
  {
    tabLabel: 'Business case',
    kicker: 'After the match',
    title: 'Your story, in your own words',
    body: 'A first-person funding narrative built from your interview, refined by talking to it. Every extrapolation stays a correctable assumption; nothing is invented.',
    Visual: BusinessCaseVisual,
  },
  {
    tabLabel: 'Underwriter practice',
    kicker: 'After the match',
    title: 'Practice with the actual reviewer',
    body: "A practice review held as that specific program's reviewer, a CDFI cash-flow analyst or an SBA-intermediary counselor, grounded in your file's real cautions. You leave with prepared answers.",
    Visual: UnderwriterVisual,
  },
];

export default function FeatureTour() {
  const [activeFeature, setActiveFeature] = useState(0);

  return (
    <section id="features" className="section-band">
      <div className="section-inner">
        <div className="section-heading">
          <div className="card-eyebrow" style={{ textAlign: 'center' }}>The product</div>
          <h2 className="section-band-title">See what each part actually does</h2>
        </div>

        <div className="feature-tabs" role="tablist">
          {FEATURES.map((f, i) => (
            <button
              type="button"
              role="tab"
              aria-selected={i === activeFeature}
              className={`feature-tab${i === activeFeature ? ' feature-tab-active' : ''}`}
              onClick={() => setActiveFeature(i)}
              key={f.tabLabel}
            >
              {f.tabLabel}
            </button>
          ))}
        </div>

        <div className="feature-panel">
          <div className="feature-text">
            <div className="feature-kicker">{FEATURES[activeFeature].kicker}</div>
            <h3 className="feature-title">{FEATURES[activeFeature].title}</h3>
            <p className="feature-body">{FEATURES[activeFeature].body}</p>
          </div>
          <div className="feature-visual" aria-hidden="true">
            {(() => {
              const Visual = FEATURES[activeFeature].Visual;
              return <Visual />;
            })()}
          </div>
        </div>
      </div>
    </section>
  );
}
