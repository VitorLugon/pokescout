import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateExpansionManifest } from '../src/historical-expansion.js';
const event = { label: 'Sample', url: 'https://limitlesstcg.com/tournaments/569', maxDecklists: 1 };
test('international selection rejects over six events, duplicate events and excess lists before retrieval', () => {
  assert.equal(validateExpansionManifest({ events: [event] })[0].division, null);
  assert.throws(() => validateExpansionManifest({ events: Array.from({ length: 7 }, (_v, i) => ({ ...event, url: `https://limitlesstcg.com/tournaments/${i+1}` })) }));
  assert.throws(() => validateExpansionManifest({ events: [event, event] }), /duplicate/);
  assert.throws(() => validateExpansionManifest({ events: [{ ...event, maxDecklists: 2 }] }));
  assert.throws(() => validateExpansionManifest({ events: [{ ...event, url: 'https://play.limitlesstcg.com/tournaments/569' }] }));
  assert.throws(() => validateExpansionManifest({ events: [{ ...event, url: 'https://user:pass@limitlesstcg.com/tournaments/569' }] }));
});
