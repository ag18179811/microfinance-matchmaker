import { useState } from 'react';
import { FIELD_META } from '../constants.js';

export default function FollowUp({ fields, missingFields, onComplete, busy }) {
  const [answers, setAnswers] = useState(() => {
    const initial = {};
    for (const key of missingFields) {
      const meta = FIELD_META[key];
      initial[key] = meta?.type === 'select' ? meta.options[0] : '';
    }
    return initial;
  });
  const [error, setError] = useState(null);

  function handleChange(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const unanswered = missingFields.find((key) => answers[key] === '' || answers[key] === undefined);
    if (unanswered) {
      setError('Please answer every question below.');
      return;
    }
    setError(null);
    onComplete({ ...fields, ...answers });
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>A few more details</h2>
      <p className="hint">
        We picked up the rest from your description — just need these {missingFields.length} to find
        your best matches.
      </p>

      {missingFields.map((key) => {
        const meta = FIELD_META[key];
        if (!meta) return null;

        if (meta.type === 'select') {
          return (
            <div key={key}>
              <label htmlFor={key}>{meta.label}</label>
              <select id={key} value={answers[key]} onChange={(e) => handleChange(key, e.target.value)}>
                {meta.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        return (
          <div key={key}>
            <label htmlFor={key}>{meta.label}</label>
            <input
              id={key}
              type={meta.type}
              min={meta.type === 'number' ? '0' : undefined}
              value={answers[key]}
              onChange={(e) => handleChange(key, e.target.value)}
            />
          </div>
        );
      })}

      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Finding your matches…' : 'Get my funding matches'}
      </button>
    </form>
  );
}
