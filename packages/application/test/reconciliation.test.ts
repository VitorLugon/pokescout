import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardFingerprint } from '../src/decklist-reconciliation.js';
import type { DeckCard } from '@tcg-scout/shared';
const card: DeckCard = { category: 'pokemon', count: 4, name: 'Example', set: 'SET', number: '1' };
test('list comparison ignores ordering and equivalent repeated rows', () => {
  const other: DeckCard = { ...card, name: 'Other', count: 2 };
  assert.equal(cardFingerprint([card, other]), cardFingerprint([other, { ...card, count: 2 }, { ...card, count: 2 }]));
});
test('list comparison detects quantities and source printing changes', () => {
  for (const changed of [{ ...card, count: 3 }, { ...card, set: 'OTHER' }, { ...card, number: '2' }, { ...card, name: 'Other' }]) {
    assert.notEqual(cardFingerprint([card]), cardFingerprint([changed]));
  }
});
