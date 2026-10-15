import { z } from 'zod';
import type { PrismaClient } from '@tcg-scout/database';
import { json } from './persistence.js';
import { QueryNotFoundError } from './errors.js';
import type { IdentityComparison } from '@tcg-scout/shared';
import { resultEvidence } from './evidence.js';
const decisionSchema = z.object({
  playerAId: z.uuid(), playerBId: z.uuid(),
  decision: z.enum(['SAME_PERSON', 'DIFFERENT_PEOPLE', 'UNCERTAIN']),
  reviewer: z.string().trim().min(1).max(100), reason: z.string().trim().min(10).max(2000),
  evidenceUrls: z.array(z.url().refine(url => /^https?:\/\//.test(url))).min(1).max(10),
});
export class IdentityReviewService {
  constructor(private readonly db: PrismaClient) {}
  async compare(playerAId: string, playerBId: string) {
    z.uuid().parse(playerAId); z.uuid().parse(playerBId);
    if (playerAId === playerBId) throw new Error('Select two distinct players');
    const [a, b] = [playerAId, playerBId].sort();
    const players = await this.db.player.findMany({ where: { id: { in: [a, b] } },
      include: { aliases: true, identities: true, _count: { select: { entries: true } }, entries: { include: { deck: { select: { archetypeName: true } }, duplicateResultsAsA: true, duplicateResultsAsB: true, tournament: { include: { duplicateEventsAsA: true, duplicateEventsAsB: true } } }, orderBy: { id: 'asc' }, take: 100 } }, orderBy: { id: 'asc' } });
    if (players.length !== 2) throw new QueryNotFoundError('Player not found');
    const [left, right] = players;
    const sharedNameKeys = [...new Set(left.aliases.map(alias => alias.searchKey))].filter(key => right.aliases.some(alias => alias.searchKey === key));
    const countries = players.map(player => [...new Set(player.entries.flatMap(entry => entry.country ? [entry.country] : []))]);
    const overlappingTournamentIds = left.entries.filter(entry => right.entries.some(other => other.tournamentId === entry.tournamentId)).map(entry => entry.tournamentId);
    const reviews = await this.db.identityReview.findMany({ where: { playerAId: a, playerBId: b }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50 });
    const reviewsTotal = await this.db.identityReview.count({ where: { playerAId: a, playerBId: b } });
    const possibleOverlappingSourceEventPairs = [...new Map(players.flatMap(player => player.entries.flatMap(entry => [...entry.tournament.duplicateEventsAsA, ...entry.tournament.duplicateEventsAsB])).map(candidate => [candidate.id, candidate])).values()];
    return { players, sharedNameKeys, countries, overlappingTournamentIds, possibleOverlappingSourceEventPairs, countMeaning: 'published-source-results', reviews, reviewsLimit: 50, reviewsTotal,
      historyTruncated: players.some(player => player._count.entries > player.entries.length), automaticallyMerged: false };
  }
  async compareForDisplay(playerAId: string, playerBId: string): Promise<IdentityComparison> {
    const comparison = await this.compare(playerAId, playerBId);
    const [left, right] = comparison.players;
    // Only overlaps involving evidence from both selected identities belong in
    // this projection. Other candidates remain available in each history.
    const pairs = comparison.possibleOverlappingSourceEventPairs.filter(pair =>
      left.entries.some(entry => entry.tournamentId === pair.tournamentAId) && right.entries.some(entry => entry.tournamentId === pair.tournamentBId) ||
      left.entries.some(entry => entry.tournamentId === pair.tournamentBId) && right.entries.some(entry => entry.tournamentId === pair.tournamentAId));
    return {
      players: comparison.players.map((player, index) => ({ id: player.id, displayName: player.displayName,
        aliases: player.aliases.map(alias => alias.originalName), identities: player.identities.map(identity => ({ source: identity.source, externalId: identity.externalId,
          scope: identity.scope, sourceUrl: identity.sourceUrl, lastSyncedAt: identity.lastSyncedAt.toISOString() })),
        countries: comparison.countries[index], resultCount: player._count.entries, entries: player.entries.map(resultEvidence), historyTruncated: player._count.entries > player.entries.length })),
      sharedNameKeys: comparison.sharedNameKeys, overlappingTournamentIds: [...new Set(comparison.overlappingTournamentIds)],
      possibleOverlappingSourceEventPairs: pairs.map(pair => ({ id: pair.id, tournamentAId: pair.tournamentAId, tournamentBId: pair.tournamentBId })),
      reviews: comparison.reviews.map(review => ({ id: review.id, decision: review.decision, reviewer: review.reviewer, reason: review.reason,
        evidenceUrls: Array.isArray(review.evidenceUrls) ? review.evidenceUrls.filter((url): url is string => typeof url === 'string') : [], createdAt: review.createdAt.toISOString() })),
      reviewsLimit: comparison.reviewsLimit, reviewsTotal: comparison.reviewsTotal, reviewsTruncated: comparison.reviewsTotal > comparison.reviews.length,
      reviewDecisionsConflict: comparison.reviews.some(review => review.decision === 'SAME_PERSON') && comparison.reviews.some(review => review.decision === 'DIFFERENT_PEOPLE'),
      historyLimit: 100, historyTruncated: comparison.historyTruncated, countMeaning: 'published-source-results', automaticallyMerged: false,
    };
  }
  async record(input: z.input<typeof decisionSchema>) {
    const data = decisionSchema.parse(input);
    const evidence = await this.compare(data.playerAId, data.playerBId);
    const [playerAId, playerBId] = [data.playerAId, data.playerBId].sort();
    // Append-only assessment. Even SAME_PERSON never changes ownership or source IDs.
    return this.db.identityReview.create({ data: { ...data, playerAId, playerBId,
      evidenceUrls: json(data.evidenceUrls), evidence: json(evidence.players) } });
  }
}
