import { useState } from 'react';
import Header from './components/Header.jsx';
import DescribeBusiness from './pages/DescribeBusiness.jsx';
import FollowUp from './pages/FollowUp.jsx';
import Results from './pages/Results.jsx';
import { apiUrl } from './api.js';

async function submitApplication(fields) {
  const createRes = await fetch(apiUrl('/api/applications'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  const application = await createRes.json();
  if (!createRes.ok) throw new Error(application.error || 'Failed to save application');

  const matchRes = await fetch(apiUrl(`/api/match/${application.id}`), { method: 'POST' });
  const matchData = await matchRes.json();
  if (!matchRes.ok) throw new Error(matchData.error || 'Failed to compute matches');
  return matchData;
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <div className="loading-title">Finding your matches…</div>
      <p className="loading-subtitle">Scoring your readiness and checking you against our lender database.</p>
    </div>
  );
}

export default function App() {
  const [stage, setStage] = useState('describe'); // 'describe' | 'followup' | 'results'
  const [partialFields, setPartialFields] = useState(null);
  const [missingFields, setMissingFields] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleExtracted({ fields, missingFields: missing }) {
    setPartialFields(fields);
    setMissingFields(missing);

    if (missing.length === 0) {
      setBusy(true);
      setError(null);
      try {
        setResults(await submitApplication(fields));
        setStage('results');
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    } else {
      setStage('followup');
    }
  }

  async function handleFollowUpComplete(completeFields) {
    setBusy(true);
    setError(null);
    try {
      setResults(await submitApplication(completeFields));
      setStage('results');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setStage('describe');
    setPartialFields(null);
    setMissingFields([]);
    setResults(null);
    setError(null);
  }

  return (
    <>
      <Header onLogoClick={stage !== 'describe' ? startOver : undefined} />
      <main className="main">
        {busy ? (
          <LoadingScreen />
        ) : (
          <>
            {error && (
              <div className="page" style={{ paddingBottom: 0 }}>
                <div className="alert alert-danger">{error}</div>
              </div>
            )}
            {stage === 'describe' && <DescribeBusiness onExtracted={handleExtracted} />}
            {stage === 'followup' && (
              <FollowUp fields={partialFields} missingFields={missingFields} onComplete={handleFollowUpComplete} busy={busy} />
            )}
            {stage === 'results' && results && <Results results={results} onStartOver={startOver} />}
          </>
        )}
      </main>
    </>
  );
}
