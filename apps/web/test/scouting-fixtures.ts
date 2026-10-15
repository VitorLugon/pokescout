import type { ScoutingEntry, ScoutingEvidence, ScoutingFilters, ScoutingSummary } from '@tcg-scout/shared';
import { candidate, deck, entry } from './fixtures';
import { eventId } from './evidence-fixtures';

// Synthetic JSON projections. They are not records in the application database.
export const groupKey = JSON.stringify(['limitless-main', 'id', 'dragapult']);
const { cards: _cards, ...metadata } = deck;
export const scoutingRows: ScoutingEntry[] = Array.from({ length: 18 }, (_, index) => ({
  ...entry, id: `scouting-entry-${index}`, originalName: 'João 山田', duplicateResultsAsA: [], duplicateResultsAsB: [],
  tournament: { ...entry.tournament, id: `scouting-event-${index}`, name: `Evento sintético ${index + 1}`, eventDate: '2026-05-24', lastSyncedAt: entry.lastSyncedAt, duplicateEventsAsA: index >= 16 ? [{ id: eventId }] : [], duplicateEventsAsB: [] },
  deck: index === 15 ? null : { ...metadata, archetypeId: index < 12 ? 'dragapult' : 'other', archetypeName: index < 12 ? 'Dragapult ex' : 'サーナイトex' },
}));
export const filters: ScoutingFilters = { dateState: 'all', formatMode: 'all', divisionMode: 'all' };
export const scoutingSummary: ScoutingSummary = {
  player: candidate, filters, options: { formats: [null,'standard-jp','standard'], divisions: [null,'MA'] },
  counts: { availableResults: 18, matchingResults: 18, excludedUnknownDateByPeriod: 0, excludedPossibleDuplicates: 2, eligibleResults: 16, knownArchetypeResults: 15, unknownArchetypeResults: 1 },
  groups: [
    { key: groupKey, source: 'limitless-main', externalId: 'dragapult', name: 'Dragapult ex', labels: ['Dragapult ex'], resultCount: 12, denominator: 15, percentage: 80, eventCount: 12, events: [{ id: 'event', name: 'Evento sintético', dateLabel: '24th May 2026', eventDate: '2026-05-24', country: 'KR', sourceUrl: entry.sourceUrl }], eventsTruncated: true },
    { key: JSON.stringify(['limitless-main','id','other']), source: 'limitless-main', externalId: 'other', name: 'サーナイトex', labels: ['サーナイトex'], resultCount: 3, denominator: 15, percentage: 20, eventCount: 3, events: [], eventsTruncated: false },
  ], unit: 'published-source-results', percentageDenominator: 'eligible-known-archetype-results', revision: 'fixture-r1', computedAt: entry.lastSyncedAt,
};
export function evidenceFixture(params: URLSearchParams): ScoutingEvidence {
  const scope = (params.get('scope') ?? 'eligible') as ScoutingEvidence['scope'];
  const group = params.get('group') ?? undefined;
  let rows = scope === 'duplicates' ? scoutingRows.slice(16) : scope === 'matched' ? scoutingRows : scoutingRows.slice(0, 16);
  if (group === 'unknown') rows = scoutingRows.slice(15,16);
  else if (group === groupKey) rows = scoutingRows.slice(0,12);
  else if (group) rows = scoutingRows.slice(12,15);
  const offset = Number(params.get('offset') ?? 0), limit = Number(params.get('limit') ?? 10);
  return { player: candidate, filters, scope, ...(group ? { group } : {}), entries: rows.slice(offset, offset + limit), total: rows.length, offset, limit, truncated: offset + limit < rows.length, unit: 'published-source-results', revision: 'fixture-r1' };
}
