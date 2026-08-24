import { useState } from 'react';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import ChatHistoryDrawer from './components/ChatHistoryDrawer.jsx';
import SignIn from './pages/SignIn.jsx';
import DescribeBusiness from './pages/DescribeBusiness.jsx';
import Chat from './pages/Chat.jsx';
import Results from './pages/Results.jsx';
import { useAuth } from './hooks/useAuth.js';
import { authedFetch } from './api.js';

async function submitApplication(fields, conversationId, onProgress) {
  onProgress?.('saving');
  const createRes = await authedFetch('/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fields, conversationId }),
  });
  const application = await createRes.json();
  if (!createRes.ok) throw new Error(application.error || 'Failed to save application');

  onProgress?.('matching');
  const matchRes = await authedFetch(`/api/match/${application.id}`, { method: 'POST' });
  const matchData = await matchRes.json();
  if (!matchRes.ok) throw new Error(matchData.error || 'Failed to compute matches');
  return matchData;
}

export default function App() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [stage, setStage] = useState('describe'); // 'describe' | 'chat' | 'results'
  const [initialDescription, setInitialDescription] = useState('');
  const [results, setResults] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  function handleStart(description) {
    setInitialDescription(description);
    setConversationId(null);
    setStage('chat');
  }

  async function finalizeApplication(fields, chatConversationId, onProgress) {
    const data = await submitApplication(fields, chatConversationId, onProgress);
    setConversationId(chatConversationId);
    setResults(data);
    setStage('results');
    return data;
  }

  function startOver() {
    setStage('describe');
    setInitialDescription('');
    setResults(null);
    setConversationId(null);
    setHistoryOpen(false);
  }

  async function handleSelectConversation(id) {
    setHistoryError(null);
    try {
      const res = await authedFetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load that conversation');
      if (!data.results) throw new Error('This conversation has no results to show yet');
      setResults(data.results);
      setConversationId(id);
      setStage('results');
      setHistoryOpen(false);
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="hero">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Header stage="describe" />
        <main className="main">
          <SignIn onSignIn={signInWithGoogle} />
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header
        stage={stage}
        onLogoClick={stage !== 'describe' ? startOver : undefined}
        user={user}
        onSignOut={signOut}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      <ChatHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleSelectConversation}
        onNewChat={startOver}
      />
      {historyError && (
        <div className="page" style={{ paddingBottom: 0 }}>
          <div className="alert alert-danger">{historyError}</div>
        </div>
      )}
      <main className="main">
        <div className="stage-transition" key={stage}>
          {stage === 'describe' && <DescribeBusiness onStart={handleStart} />}
          {stage === 'chat' && <Chat initialDescription={initialDescription} onComplete={finalizeApplication} />}
          {stage === 'results' && results && <Results results={results} conversationId={conversationId} />}
        </div>
      </main>
      {stage !== 'chat' && <Footer />}
    </>
  );
}
