import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventEvidence, evidenceSignals } from '../src/evidence.js';

test('evidence projection excludes raw snapshots even when given a full database object', () => {
  const event = { id: 'event', source: 'limitless-main', externalId: '42', name: '国際大会', country: null, dateLabel: '2026', division: null, format: 'standard-jp', resultsCoverage: 'PUBLISHED_RESULTS', fullySynchronized: false, sourceUrl: 'https://limitlesstcg.com/tournaments/42', lastSyncedAt: new Date('2026-10-14T12:00:00Z'), raw: { hidden: 'must not leak' } };
  const projected = eventEvidence(event);
  assert.equal('raw' in projected, false); assert.equal(projected.division, null);
  assert.equal(projected.name, '国際大会'); assert.equal(projected.lastSyncedAt, '2026-10-14T12:00:00.000Z');
  assert.deepEqual(evidenceSignals({ signals: ['same-calendar-start', 5, null] }), ['same-calendar-start']);
  assert.equal(evidenceSignals({ signals: Array(50).fill('a'.repeat(300)) }).length, 20);
  assert.equal(evidenceSignals({ signals: ['a'.repeat(300)] })[0].length, 200);
  assert.deepEqual(evidenceSignals(null), []);
});
