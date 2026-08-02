import { useState } from 'react';
import IntakeForm from './pages/IntakeForm.jsx';
import Results from './pages/Results.jsx';

export default function App() {
  const [results, setResults] = useState(null);

  return (
    <div>
      <h1>Microfinance Matchmaker</h1>
      {results ? (
        <Results results={results} onStartOver={() => setResults(null)} />
      ) : (
        <IntakeForm onMatched={setResults} />
      )}
    </div>
  );
}
