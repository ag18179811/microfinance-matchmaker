import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLanguage, languageName, languageDirective } from './language.js';

test('normalizeLanguage accepts a known code and falls back to en otherwise', () => {
  assert.equal(normalizeLanguage('es'), 'es');
  assert.equal(normalizeLanguage('ES'), 'es');
  assert.equal(normalizeLanguage('es-MX'), 'es');
  assert.equal(normalizeLanguage('xx'), 'en');
  assert.equal(normalizeLanguage(null), 'en');
  assert.equal(normalizeLanguage(''), 'en');
});

test('English still gets the writing-style rule (no em dashes), just no translation instruction', () => {
  const en = languageDirective('en');
  assert.match(en, /em dash/i);
  assert.doesNotMatch(en, /LANGUAGE:/);
  assert.equal(languageDirective('en'), languageDirective('xx'), 'unknown codes fall back to the same as en');
});

test('a non-English directive names the language, preserves JSON keys, and keeps the style rule', () => {
  const d = languageDirective('es');
  assert.match(d, /Spanish/);
  assert.match(d, /JSON keys/i);
  assert.match(d, /em dash/i);
  assert.equal(languageName('es'), 'Spanish');
});
