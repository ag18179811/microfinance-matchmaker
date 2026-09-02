import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKS_BY_MODEL } from './application-pack.js';
import { APPLICATION_MODELS } from './lender-application-profiles.js';

test('every application model has its own pack block set', () => {
  for (const model of Object.keys(APPLICATION_MODELS)) {
    assert.ok(Array.isArray(BLOCKS_BY_MODEL[model]), `${model} has a block set`);
    assert.ok(BLOCKS_BY_MODEL[model].length >= 2, `${model} has at least two blocks`);
  }
});

test('the packs are genuinely different per model, not one template', () => {
  const kiva = new Set(BLOCKS_BY_MODEL.crowdfunding.map(([k]) => k));
  const cdfi = new Set(BLOCKS_BY_MODEL.cdfi_term_loan.map(([k]) => k));
  // Kiva builds a story + a private-lender invite; a CDFI pack builds a
  // repayment narrative. They should not be the same blocks.
  assert.ok(kiva.has('personal_story') && kiva.has('invite_message'));
  assert.ok(cdfi.has('repayment') && cdfi.has('use_of_funds'));
  assert.ok(!kiva.has('repayment'));
});

test('block entries are well-formed [key, label, description] triples', () => {
  for (const [model, blocks] of Object.entries(BLOCKS_BY_MODEL)) {
    for (const b of blocks) {
      assert.equal(b.length, 3, `${model} block is a triple`);
      assert.ok(b.every((s) => typeof s === 'string' && s.length > 0));
    }
  }
});
