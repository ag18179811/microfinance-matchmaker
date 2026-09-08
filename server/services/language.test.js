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

test('English produces an empty directive so English prompts are unchanged', () => {
  assert.equal(languageDirective('en'), '');
  assert.equal(languageDirective('xx'), '');
});

test('a non-English directive names the language and preserves JSON keys', () => {
  const d = languageDirective('es');
  assert.match(d, /Spanish/);
  assert.match(d, /JSON keys/i);
  assert.equal(languageName('es'), 'Spanish');
});
