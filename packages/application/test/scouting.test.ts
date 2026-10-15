import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ScoutingEntry } from '@tcg-scout/shared';
import { analyzeScouting, archetypeKey } from '../src/scouting-analysis.js';
import { calendarDate, scoutingFiltersSchema, scoutingEvidenceSchema } from '../src/scouting-filters.js';

// Synthetic source results, not an imported player or career.
function row(id: string, name: string | null = 'Dragapult ex'): ScoutingEntry {
  return { id, originalName: 'João 山田', country: null, placement: null, wins: null, losses: null, ties: null, disqualified: null,
    sourceUrl: 'https://example.org/result', lastSyncedAt: '2026-10-14T12:00:00Z', duplicateResultsAsA: [], duplicateResultsAsB: [],
    tournament: { id: `event-${id}`, source: 'limitless-main', externalId: id, name: '国際大会', dateLabel: '24th May 2026', eventDate: '2026-05-24', country: 'KR', format: 'standard-jp', division: null,
      resultsCoverage: 'PUBLISHED_RESULTS', fullySynchronized: false, sourceUrl: 'https://example.org/event', lastSyncedAt: '2026-10-14T12:00:00Z', duplicateEventsAsA: [], duplicateEventsAsB: [] },
    deck: { id: `deck-${id}`, source: 'limitless-main', sourceUrl: 'https://example.org/deck', lastSyncedAt: '2026-10-14T12:00:00Z', archetypeId: name ? '42' : null, archetypeName: name, availableAtSource: true, listStatus: 'AVAILABLE', listImportedAt: null } };
}

test('all results determine denominators, including unknown archetypes and multiple duplicate signals', () => {
  const rows = Array.from({ length: 25 }, (_, i) => row(String(i)));
  rows[0].deck = null; rows[1].deck!.archetypeName = null; rows[1].deck!.archetypeId = null;
  rows[2].duplicateResultsAsA = [{ id: 'result-candidate' }]; rows[2].tournament.duplicateEventsAsB = [{ id: 'event-candidate' }];
  rows[3].tournament.duplicateEventsAsA = [{ id: 'other-event-candidate' }];
  const result = analyzeScouting(rows, scoutingFiltersSchema.parse({}));
  assert.deepEqual(result.counts, { availableResults: 25, matchingResults: 25, excludedUnknownDateByPeriod: 0, excludedPossibleDuplicates: 2, eligibleResults: 23, knownArchetypeResults: 21, unknownArchetypeResults: 2 });
  assert.equal(result.groups[0].resultCount, 21); assert.equal(result.groups[0].denominator, 21); assert.equal(result.groups[0].percentage, 100);
  assert.equal(result.groups[0].events.length, 3); assert.equal(result.groups[0].eventCount, 21); assert.equal(result.groups[0].eventsTruncated, true);
  assert.equal(rows[2].duplicateResultsAsA.length, 1); // Analysis does not mutate evidence.
});

test('taxonomy keys preserve source IDs, original labels and namespace separation', () => {
  const a = row('a'), b = row('b', 'ドラパルトex'), c = row('c'), d = row('d'), e = row('e'), f = row('f', ' dragapult ex ');
  c.deck!.archetypeId = '43'; d.deck!.source = 'limitless-labs';
  e.deck!.archetypeId = null; f.deck!.archetypeId = null;
  assert.equal(archetypeKey(a), archetypeKey(b));
  assert.notEqual(archetypeKey(a), archetypeKey(c)); assert.notEqual(archetypeKey(a), archetypeKey(d));
  assert.notEqual(archetypeKey(e), archetypeKey(f));
  const analysis = analyzeScouting([a,b,c,d,e,f], scoutingFiltersSchema.parse({}));
  assert.equal(analysis.groups.length, 5); assert.equal(analysis.groups[0].resultCount, 2);
  assert.deepEqual(analysis.groups[0].labels, ['Dragapult ex', 'ドラパルトex']);
});

test('date bounds are inclusive, unknown dates remain without an interval and are counted when excluded', () => {
  const a = row('a'), b = row('b'), c = row('c'), d = row('d'), e = row('e');
  b.tournament.eventDate = '2026-06-01'; c.tournament.eventDate = null;
  d.tournament.eventDate = '2026-02-30'; e.tournament.eventDate = '2026-05-23';
  assert.equal(analyzeScouting([a,b,c,d,e], scoutingFiltersSchema.parse({})).counts.matchingResults, 5);
  const analysis = analyzeScouting([a,b,c,d,e], scoutingFiltersSchema.parse({ from: '2026-05-24', to: '2026-06-01' }));
  assert.equal(analysis.counts.matchingResults, 2); assert.equal(analysis.counts.excludedUnknownDateByPeriod, 2);
  assert.deepEqual(analysis.matched.map(entry => entry.id), ['a','b']);
  assert.equal(analyzeScouting([a,b,c,d,e], scoutingFiltersSchema.parse({ to: '2026-05-24' })).counts.matchingResults, 2);
  assert.equal(analyzeScouting([a,b,c,d,e], scoutingFiltersSchema.parse({ dateState: 'unknown' })).counts.matchingResults, 2);
  assert.equal(calendarDate('2024-02-29'), '2024-02-29'); assert.equal(calendarDate('2025-02-29'), null);
});

test('format/division filter literal values never equate regional formats or fill nulls', () => {
  const a = row('a'), b = row('b'), c = row('c');
  b.tournament.format = 'standard'; b.tournament.division = 'MA'; c.tournament.format = null;
  const analysis = analyzeScouting([a,b,c], scoutingFiltersSchema.parse({ formatMode: 'known', format: 'standard-jp', divisionMode: 'unknown' }));
  assert.deepEqual(analysis.matched.map(entry => entry.id), ['a']);
  assert.equal(analyzeScouting([a,b,c], scoutingFiltersSchema.parse({ formatMode: 'unknown' })).counts.matchingResults, 1);
  assert.equal(analyzeScouting([a,b,c], scoutingFiltersSchema.parse({ divisionMode: 'known' })).counts.matchingResults, 1);
});

test('empty and unknown-only denominators produce no percentages, fractional groups round to one decimal', () => {
  const unknown = row('u', null);
  const result = analyzeScouting([unknown], scoutingFiltersSchema.parse({}));
  assert.equal(result.groups.length, 0); assert.equal(result.counts.unknownArchetypeResults, 1);
  assert.deepEqual(analyzeScouting([], scoutingFiltersSchema.parse({})).groups, []);
  const rows = [row('a'), row('b'), row('c')]; rows[1].deck!.archetypeId = '2'; rows[2].deck!.archetypeId = '3';
  assert.deepEqual(analyzeScouting(rows, scoutingFiltersSchema.parse({})).groups.map(group => group.percentage), [33.3,33.3,33.3]);
});

test('filter validation rejects impossible dates, contradictory values and unbounded evidence parameters', () => {
  for (const input of [{ from: '2026-02-30' }, { from: '0000-01-01' }, { from: '2026-01-02', to: '2026-01-01' }, { dateState: 'unknown', from: '2026-01-01' }, { formatMode: 'unknown', format: 'standard' }, { division: 'MA' }, { unexpected: true }]) assert.equal(scoutingFiltersSchema.safeParse(input).success, false);
  for (const input of [{ limit: 101 }, { offset: -1 }, { offset: 100001 }, { scope: 'duplicates', group: 'unknown' }, { group: 'x'.repeat(2001) }]) assert.equal(scoutingEvidenceSchema.safeParse(input).success, false);
});
