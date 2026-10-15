import type { HistoricalDeck, HistoricalEntry, PlayerCandidate, PlayerHistoryResponse } from '@tcg-scout/shared';
// Entirely synthetic API fixtures: no private information or website requests.
export const candidate: PlayerCandidate = {
  id: '11111111-1111-4111-8111-111111111111', displayName: 'João 山田', aliases: ['João 山田', 'JOAO 山田'],
  countries: ['JP'], identities: [{ source: 'limitless-main', scope: 'global', externalId: '42' }],
  possibleMatchIds: ['22222222-2222-4222-8222-222222222222'],
};
export const other: PlayerCandidate = { ...candidate, id: candidate.possibleMatchIds[0], identities: [{ source: 'limitless-labs', scope: 'global', externalId: '84' }] };
export const deck: HistoricalDeck = {
  id: 'deck-1', source: 'limitless-main', sourceUrl: 'https://limitlesstcg.com/decks/list/42', archetypeName: 'Dragapult ex',
  availableAtSource: true, listStatus: 'IMPORTED', listImportedAt: '2026-10-14T12:00:00.000Z', lastSyncedAt: '2026-10-14T12:00:00.000Z',
  cards: [{ id: 'card-1', category: 'pokemon', name: 'ドラパルトex', quantity: 3, setCode: 'TWM', collectorNumber: '130', language: 'ja' }],
};
export const entry: HistoricalEntry = {
  id: '33333333-3333-4333-8333-333333333333', originalName: candidate.displayName, country: 'JP', placement: 1,
  wins: null, losses: null, ties: null, disqualified: null, sourceUrl: 'https://limitlesstcg.com/tournaments/42', lastSyncedAt: '2026-10-14T12:00:00.000Z',
  duplicateResultsAsA: [{ id: 'duplicate-result' }], duplicateResultsAsB: [],
  tournament: { name: 'Torneio de teste internacional', source: 'limitless-main', externalId: '42', country: 'KR', dateLabel: '24th May 2026', format: 'standard-jp', division: null,
    resultsCoverage: 'PUBLISHED_RESULTS', fullySynchronized: false, sourceUrl: 'https://limitlesstcg.com/tournaments/42', duplicateEventsAsA: [{ id: 'duplicate-event' }], duplicateEventsAsB: [] },
  deck,
};
export const history: PlayerHistoryResponse = { player: candidate, entries: [entry], total: 11, limit: 10, offset: 0, truncated: true, totalMeaning: 'published-source-results', confirmedParticipationCount: null };
