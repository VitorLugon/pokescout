import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, sameSourceIdentity, type Player } from '../src/index.js';

test('normalization preserves useful punctuation while matching accents, case and spacing', () => {
  assert.equal(normalizeName('  João   Pedro  '), 'joao pedro');
  assert.equal(normalizeName('JOAO PEDRO'), 'joao pedro');
  assert.equal(normalizeName('Esteban O’Compley'), "esteban o'compley");
  assert.equal(normalizeName('Ana–Maria'), 'ana-maria');
});
const player = (externalId: string, name: string, source: Player['reference']['source'] = 'limitless-labs'): Player => ({
  reference: { source, externalId, sourceUrl: 'https://example.com/player', lastSyncedAt: '2026-10-14T00:00:00Z' },
  originalName: name, normalizedName: normalizeName(name),
});
test('matching names never merge different identities or source namespaces', () => {
  assert.equal(sameSourceIdentity(player('1', 'João Pedro'), player('2', 'JOAO PEDRO')), false);
  assert.equal(sameSourceIdentity(player('1', 'João Pedro'), player('1', 'João Pedro', 'limitless-api')), false);
  assert.equal(sameSourceIdentity(player('1', 'Original Name'), player('1', 'Changed Name')), true);
});
