import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameSearchKey } from '../../shared/src/index.js';
import { validateCards, errorSummary } from '../src/validation.js';
test('search keys tolerate punctuation, accents, case and whitespace without merging identities', () => {
  assert.equal(nameSearchKey('  JOÃO-Pedro. '), nameSearchKey('Joao Pedro'));
  assert.equal(nameSearchKey('O’Compley'), nameSearchKey('OCompley'));
});
test('deck quantities and format-specific totals are validated before persistence', () => {
  const card = { name: 'Grass Energy', set: 'SVE', number: '1', category: 'energy' as const, count: 60 };
  assert.equal(validateCards([card], 60)[0].count, 60);
  assert.throws(() => validateCards([{ ...card, count: 59 }], 60), /Expected 60 cards/);
  assert.throws(() => validateCards([{ ...card, count: 0 }], null));
  assert.equal(validateCards([{ ...card, count: 40 }], null)[0].count, 40);
});
test('persisted errors do not include database credentials', () => {
  assert.doesNotMatch(errorSummary(new Error('connection to postgresql://user:secret@localhost/db failed')), /secret/);
  assert.equal(errorSummary(Object.assign(new Error('Invalid tx.deck.upsert with internal invocation details'),{code:'P2028'})),'Database operation failed; inspect database availability and constraints.');
});
