import { useState } from 'react';
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
    <div>
      <h1>Microfinance Matchmaker</h1>
      {stage === 'describe' && <p className="hint">Tell us about your business in your own words, and we'll take it from there.</p>}
      {error && <p className="error">{error}</p>}

      {stage === 'describe' && <DescribeBusiness onExtracted={handleExtracted} />}
      {stage === 'followup' && (
        <FollowUp fields={partialFields} missingFields={missingFields} onComplete={handleFollowUpComplete} busy={busy} />
      )}
      {stage === 'results' && results && <Results results={results} onStartOver={startOver} />}
    </div>
  );
}
