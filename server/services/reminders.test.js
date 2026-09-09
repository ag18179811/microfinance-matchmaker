import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysBetween, reminderForTracked } from './reminders.js';

const NOW = new Date('2026-06-15T12:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();
const daysAhead = (n) => new Date(NOW.getTime() + n * 86400000).toISOString().slice(0, 10);

test('daysBetween is positive when the second date is later', () => {
  assert.equal(daysBetween('2026-06-10', '2026-06-15'), 5);
  assert.equal(daysBetween('2026-06-15', '2026-06-10'), -5);
});

test('a deadline within four days triggers a deadline reminder', () => {
  const r = reminderForTracked({ lender_name: 'X Fund', status: 'preparing', deadline: daysAhead(3), updated_at: daysAgo(1) }, NOW);
  assert.equal(r.kind, 'deadline');
  assert.match(r.text, /deadline is in 3 days/);
});

test('a deadline further out does not trigger a deadline reminder', () => {
  const r = reminderForTracked({ lender_name: 'X Fund', status: 'preparing', deadline: daysAhead(20), updated_at: daysAgo(1) }, NOW);
  assert.equal(r, null);
});

test('a preparing row untouched for 12+ days triggers a stale-prep nudge', () => {
  const r = reminderForTracked({ lender_name: 'X Fund', status: 'preparing', updated_at: daysAgo(14) }, NOW);
  assert.equal(r.kind, 'stale_prep');
});

test('a submitted row untouched for 16+ days triggers a check-in nudge', () => {
  const r = reminderForTracked({ lender_name: 'X Fund', status: 'submitted', updated_at: daysAgo(18) }, NOW);
  assert.equal(r.kind, 'stale_submitted');
});

test('a decided row is never reminded', () => {
  for (const status of ['approved', 'declined', 'funded']) {
    assert.equal(reminderForTracked({ lender_name: 'X', status, deadline: daysAhead(1), updated_at: daysAgo(90) }, NOW), null);
  }
});

test('a fresh preparing row with no deadline gets nothing', () => {
  assert.equal(reminderForTracked({ lender_name: 'X', status: 'preparing', updated_at: daysAgo(2) }, NOW), null);
});
