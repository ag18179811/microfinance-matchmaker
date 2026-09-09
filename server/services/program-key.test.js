import { test } from 'node:test';
import assert from 'node:assert/strict';
import { programKey } from './program-key.js';

test('slugifies a program name to a URL-safe, stable key', () => {
  assert.equal(programKey('Accion Opportunity Fund'), 'accion-opportunity-fund');
  assert.equal(programKey('Community Reinvestment Fund, USA (CRF)'), 'community-reinvestment-fund-usa-crf');
  assert.equal(programKey('  Kiva U.S.  '), 'kiva-u-s');
});

test('the same program name always produces the same key (survives a re-search)', () => {
  const a = programKey('DreamSpring');
  const b = programKey('DreamSpring');
  assert.equal(a, b);
  assert.equal(a, 'dreamspring');
});

test('is case- and punctuation-insensitive', () => {
  assert.equal(programKey('SBA Microloan Program'), programKey('sba microloan program'));
  assert.equal(programKey('Amber Grant for Women (WomensNet)'), programKey('Amber Grant for Women - WomensNet'));
});

test('never returns an empty string', () => {
  assert.equal(programKey(''), 'program');
  assert.equal(programKey(null), 'program');
  assert.equal(programKey('!!!'), 'program');
});

test('caps length at 80 characters', () => {
  const long = 'A'.repeat(200);
  assert.ok(programKey(long).length <= 80);
});
