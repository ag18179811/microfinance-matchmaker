import { useState } from 'react';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import DescribeBusiness from './pages/DescribeBusiness.jsx';
import Chat from './pages/Chat.jsx';
import Results from './pages/Results.jsx';
import { apiUrl } from './api.js';

async function submitApplication(fields, onProgress) {
  onProgress?.('saving');
  const createRes = await fetch(apiUrl('/api/applications'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  const application = await createRes.json();
  if (!createRes.ok) throw new Error(application.error || 'Failed to save application');

  onProgress?.('matching');
  const matchRes = await fetch(apiUrl(`/api/match/${application.id}`), { method: 'POST' });
  const matchData = await matchRes.json();
  if (!matchRes.ok) throw new Error(matchData.error || 'Failed to compute matches');
  return matchData;
}

export default function App() {
  const [stage, setStage] = useState('describe'); // 'describe' | 'chat' | 'results'
  const [initialDescription, setInitialDescription] = useState('');
  const [results, setResults] = useState(null);

  function handleStart(description) {
    setInitialDescription(description);
    setStage('chat');
  }

  async function finalizeApplication(fields, onProgress) {
    const data = await submitApplication(fields, onProgress);
    setResults(data);
    setStage('results');
    return data;
  }

  function startOver() {
    setStage('describe');
    setInitialDescription('');
    setResults(null);
  }

  return (
    <>
      <Header stage={stage} onLogoClick={stage !== 'describe' ? startOver : undefined} />
      <main className="main">
        <div className="stage-transition" key={stage}>
          {stage === 'describe' && <DescribeBusiness onStart={handleStart} />}
          {stage === 'chat' && <Chat initialDescription={initialDescription} onComplete={finalizeApplication} />}
          {stage === 'results' && results && <Results results={results} onStartOver={startOver} />}
        </div>
      </main>
      {stage !== 'chat' && <Footer />}
    </>
  );
}
