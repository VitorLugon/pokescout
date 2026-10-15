import type { DuplicateEvidence, EvidenceResult, EvidenceTournament, IdentityComparison } from '@tcg-scout/shared';
import { candidate, other } from './fixtures';
// Synthetic evidence, never persisted to the application database.
export const eventId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const resultId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const event: EvidenceTournament = { id: 'event-main', source: 'limitless-main', externalId: '42', name: 'Evento sintético 国際', dateLabel: '24th May 2026', country: 'KR', division: null, format: 'standard-jp', resultsCoverage: 'PUBLISHED_RESULTS', fullySynchronized: false, sourceUrl: 'https://limitlesstcg.com/tournaments/42', lastSyncedAt: '2026-10-14T12:00:00Z' };
export const labsEvent: EvidenceTournament = { ...event, id: 'event-labs', source: 'limitless-labs', externalId: '0042', format: null, division: 'MA', sourceUrl: 'https://labs.limitlesstcg.com/0042/standings' };
const result: EvidenceResult = { id: 'result-main', externalId: 'entry-42', playerId: candidate.id, originalName: candidate.displayName, country: null, placement: null, archetypeName: 'Dragapult ex', sourceUrl: event.sourceUrl, lastSyncedAt: event.lastSyncedAt, tournament: event };
const labsResult: EvidenceResult = { ...result, id: 'result-labs', externalId: '0042', playerId: other.id, originalName: 'JOAO 山田', country: 'JP', placement: 1, tournament: labsEvent, sourceUrl: labsEvent.sourceUrl };
export const comparison: IdentityComparison = {
  players: [candidate, other].map((player, index) => ({ id: player.id, displayName: player.displayName, aliases: player.aliases,
    identities: player.identities.map(identity => ({ ...identity, sourceUrl: index ? labsEvent.sourceUrl : event.sourceUrl, lastSyncedAt: event.lastSyncedAt })),
    countries: index ? ['JP'] : [], resultCount: index ? 1 : 101, entries: [index ? labsResult : result], historyTruncated: index === 0 })),
  sharedNameKeys: ['joao 山田'], overlappingTournamentIds: [], possibleOverlappingSourceEventPairs: [{ id: eventId, tournamentAId: event.id, tournamentBId: labsEvent.id }],
  reviews: ['SAME_PERSON', 'DIFFERENT_PEOPLE', 'UNCERTAIN'].map((decision, index) => ({ id: `review-${index}`, decision, reviewer: '<img src=x onerror=alert(1)>', reason: '<script>window.bad = true</script> Avaliação sintética.', evidenceUrls: ['https://example.org/public-evidence', 'javascript:alert(1)'], createdAt: event.lastSyncedAt })),
  reviewsLimit: 50, reviewsTotal: 51, reviewsTruncated: true, reviewDecisionsConflict: true, historyLimit: 100, historyTruncated: true,
  countMeaning: 'published-source-results', automaticallyMerged: false,
};
export const resultDuplicate: DuplicateEvidence = { id: resultId, kind: 'result', status: 'POSSIBLE', detectedAt: event.lastSyncedAt,
  signals: ['candidate-event-pair', 'normalized-name-candidate'], limitations: ['Sinais para revisão; não confirmam identidade.', 'Dados atuais podem diferir do momento de detecção.'],
  tournaments: [event, labsEvent], results: [result, labsResult], tournamentCandidateId: eventId, confirmedSamePerson: false, confirmedAdditionalParticipation: false };
export const eventDuplicate: DuplicateEvidence = { ...resultDuplicate, id: eventId, kind: 'event', results: [], signals: ['same-calendar-start', 'same-event-country'], tournamentCandidateId: null };
