import { useState } from 'react';

const INDUSTRIES = [
  'Retail',
  'Food Service',
  'Personal Services',
  'Professional Services',
  'Manufacturing',
  'Construction',
  'Transportation',
  'Wholesale',
  'Agriculture',
  'Tourism',
  'Health Care',
  'Child Care',
  'Arts and Entertainment',
  'Technology',
  'Real Estate',
];

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const initialState = {
  business_name: '',
  industry: INDUSTRIES[0],
  city: '',
  state: STATES[0],
  time_in_business_months: '',
  annual_revenue: '',
  requested_amount: '',
  purpose: '',
};

export default function IntakeForm({ onMatched }) {
  const [form, setForm] = useState(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const createRes = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const application = await createRes.json();
      if (!createRes.ok) throw new Error(application.error || 'Failed to save application');

      const matchRes = await fetch(`/api/match/${application.id}`, { method: 'POST' });
      const matchData = await matchRes.json();
      if (!matchRes.ok) throw new Error(matchData.error || 'Failed to compute matches');

      onMatched(matchData);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Tell us about your business</h2>

      <label htmlFor="business_name">Business name</label>
      <input id="business_name" name="business_name" value={form.business_name} onChange={handleChange} required />

      <label htmlFor="industry">Industry</label>
      <select id="industry" name="industry" value={form.industry} onChange={handleChange}>
        {INDUSTRIES.map((i) => (
          <option key={i} value={i}>{i}</option>
        ))}
      </select>

      <label htmlFor="city">City</label>
      <input id="city" name="city" value={form.city} onChange={handleChange} required />

      <label htmlFor="state">State</label>
      <select id="state" name="state" value={form.state} onChange={handleChange}>
        {STATES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <label htmlFor="time_in_business_months">Time in business (months)</label>
      <input
        id="time_in_business_months"
        name="time_in_business_months"
        type="number"
        min="0"
        value={form.time_in_business_months}
        onChange={handleChange}
        required
      />

      <label htmlFor="annual_revenue">Annual revenue ($)</label>
      <input
        id="annual_revenue"
        name="annual_revenue"
        type="number"
        min="0"
        value={form.annual_revenue}
        onChange={handleChange}
        required
      />

      <label htmlFor="requested_amount">Requested loan amount ($)</label>
      <input
        id="requested_amount"
        name="requested_amount"
        type="number"
        min="0"
        value={form.requested_amount}
        onChange={handleChange}
        required
      />

      <label htmlFor="purpose">Purpose of funds</label>
      <textarea id="purpose" name="purpose" rows="3" value={form.purpose} onChange={handleChange} />

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Finding matches…' : 'Find my matches'}
      </button>
    </form>
  );
}
