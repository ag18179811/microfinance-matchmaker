// Estimates how far along a funding-readiness interview is, as a 0–100
// percentage plus a human phase label, so the chat UI can show a progress
// bar toward "here are your matches". This is a UX signal ONLY — it never
// influences what gets asked or when the interview actually ends (the model
// owns the done decision, groq-interview.js / interview-fallback.js). The
// only hard guarantee callers rely on: once `done` is true this returns
// 100, and until then it never returns 100.
//
// The interview is adaptive, so there is no exact "question N of M". This
// blends three monotonic-by-construction signals — every one of them only
// ever moves up as the conversation continues:
//   1. how many core required fields are captured (business basics)
//   2. how many of the deeper profile fields are captured
//   3. how many free-form business-specific facts have been gathered
//   4. raw turn count against a soft target
// so the bar advances on every answer without ever jumping backward.

import { REQUIRED_APPLICATION_FIELDS, DEEP_PROFILE_FIELDS, DEEP_PROFILE_FIELD_ORDER } from '../constants.js';

// A thorough interview usually wraps around here; the hard ceiling in
// groq-interview.js is 16. Turn count alone shouldn't be able to fill the
// bar, so this is only one weighted input below.
const SOFT_TARGET_TURNS = 13;

// ownership_demographics is optional and never gates completion, so it's
// excluded from the "how much of the profile is filled" ratio.
const SCORED_DEEP_FIELDS = DEEP_PROFILE_FIELD_ORDER.filter((k) => !DEEP_PROFILE_FIELDS[k].optional);

// Roughly how many distinct business-specific notes a rich interview
// gathers — past this, extra notes don't move the bar further.
const NOTES_TARGET = 10;

const WEIGHTS = { core: 0.34, deep: 0.24, notes: 0.14, turns: 0.28 };

// Bar never sits at a literal 0 (there's always been an opening
// description) and never reaches 100 while questions are still coming.
const MIN_PERCENT = 6;
const MAX_PERCENT_BEFORE_DONE = 95;

// Ordered low→high; the label is the last one whose threshold the percent
// has reached.
const PHASES = [
  { atLeast: 0, label: 'Getting the basics' },
  { atLeast: 34, label: 'Digging into your business' },
  { atLeast: 66, label: 'Filling in the last details' },
  { atLeast: 90, label: 'Almost ready to match' },
];
const DONE_PHASE = 'Building your matches';

function isFilled(value) {
  return value !== null && value !== undefined && value !== '';
}

function phaseFor(percent) {
  let label = PHASES[0].label;
  for (const phase of PHASES) {
    if (percent >= phase.atLeast) label = phase.label;
  }
  return label;
}

// fields: the structured profile gathered so far (conversation.fields)
// notes:  the free-form {topic, detail} facts list (conversation.notes)
// turnCount: assistant turns taken so far
// done:   whether the interview has declared itself complete this turn
export function computeInterviewProgress({ fields = {}, notes = [], turnCount = 0, done = false } = {}) {
  if (done) {
    return { percent: 100, phase: DONE_PHASE };
  }

  const coreFilled = REQUIRED_APPLICATION_FIELDS.filter((k) => isFilled(fields[k])).length;
  const deepFilled = SCORED_DEEP_FIELDS.filter((k) => isFilled(fields[k])).length;
  const noteCount = Array.isArray(notes) ? notes.length : 0;

  const coreRatio = coreFilled / REQUIRED_APPLICATION_FIELDS.length;
  const deepRatio = deepFilled / SCORED_DEEP_FIELDS.length;
  const notesRatio = Math.min(noteCount / NOTES_TARGET, 1);
  const turnsRatio = Math.min(turnCount / SOFT_TARGET_TURNS, 1);

  const blended =
    WEIGHTS.core * coreRatio +
    WEIGHTS.deep * deepRatio +
    WEIGHTS.notes * notesRatio +
    WEIGHTS.turns * turnsRatio;

  const percent = Math.max(MIN_PERCENT, Math.min(MAX_PERCENT_BEFORE_DONE, Math.round(blended * 100)));

  return { percent, phase: phaseFor(percent) };
}
