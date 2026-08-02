import { useState } from 'react';
import { apiUrl } from '../api.js';

const PLACEHOLDER =
  "e.g. I run a coffee shop in Austin, TX. We've been open about 3 years, do roughly " +
  "$180,000 a year in revenue, and I'm looking for $20,000 to buy a new espresso machine " +
  'and renovate the seating area.';

export default function DescribeBusiness({ onExtracted }) {
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/intake/extract'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze description');
      onExtracted(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="description">Describe your startup or business</label>
      <textarea
        id="description"
        rows="6"
        placeholder={PLACEHOLDER}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />
      <p className="hint">
        Mention what you do, where you're located, how long you've been operating, your
        revenue, how much funding you want, and what it's for — the more you include, the
        fewer follow-up questions we'll need to ask.
      </p>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Analyzing…' : 'Analyze my business'}
      </button>
    </form>
  );
}
