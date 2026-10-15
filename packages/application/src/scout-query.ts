import type { PrismaClient } from '@tcg-scout/database';
import { QueryNotFoundError } from './errors.js';
import { nameSearchKey } from '@tcg-scout/shared';
import { combinedHistory } from './combined-history.js';
import { tournamentCatalog } from './tournament-catalog.js';
import { preferredSearchResponse } from './preferred-search.js';
export class ScoutQueryService {
  constructor(private readonly db: PrismaClient) {}
  combinedHistory(playerId: string, limit = 100, offset = 0) { return combinedHistory(this.db, playerId, limit, offset); }
  async preferredSearch(name: string, limit=30) {
    if (!Number.isInteger(limit)||limit<1||limit>100) throw new Error('Search limit must be 1–100.');
    const response=await this.searchPlayers(name,100);
    const ids=response.matches.map(player=>player.id);
    const reviews=await this.db.identityReview.findMany({where:{decision:'DIFFERENT_PEOPLE',playerAId:{in:ids},playerBId:{in:ids}},select:{playerAId:true,playerBId:true}});
    return preferredSearchResponse(response,limit,new Set(reviews.map(review=>[review.playerAId,review.playerBId].sort().join(':'))));
  }
  preferredTournamentCatalog(limit=20,offset=0) { return tournamentCatalog(this.db,limit,offset,true); }
  async searchPlayers(name: string, limit = 30) {
    const key = nameSearchKey(name);
    if (key.length < 2) throw new Error('Player search requires at least two letters/numbers.');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Search limit must be 1–100.');
    const players = await this.db.player.findMany({
      where: { aliases: { some: { searchKey: { contains: key } } } },
      include: { aliases: true, identities: true, entries: { select: { country: true }, take: 10, orderBy: { lastSyncedAt: 'desc' } } },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }], take: limit + 1,
    });
    const visible = players.slice(0, limit);
    const matches = visible.map(player => ({
      id: player.id, displayName: player.displayName,
      aliases: player.aliases.map(alias => alias.originalName),
      identities: player.identities.map(identity => ({ source: identity.source, scope: identity.scope, externalId: identity.externalId })),
      countries: [...new Set(player.entries.flatMap(entry => entry.country ? [entry.country] : []))],
      // Candidates are returned independently. This is evidence for review, never a merge.
      possibleMatchIds: visible.filter(other => other.id !== player.id && other.aliases.some(a => player.aliases.some(b => a.searchKey === b.searchKey))).map(other => other.id),
    }));
    return { matches, truncated: players.length > limit };
  }
  async playerHistory(playerId: string, limit = 100, offset = 0) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 100000) throw new Error('Invalid history pagination');
    const player = await this.db.player.findUnique({ where: { id: playerId } });
    if (!player) throw new QueryNotFoundError(`Player not found: ${playerId}`);
    const entries = await this.db.tournamentEntry.findMany({ where: { playerId }, take: limit, skip: offset, include: { duplicateResultsAsA: true, duplicateResultsAsB: true, tournament: { include: { duplicateEventsAsA: true, duplicateEventsAsB: true } }, deck: { include: { cards: { orderBy: { position: 'asc' } } } } }, orderBy: [{ tournament: { eventDate: { sort: 'desc', nulls: 'last' } } }, { tournament: { season: { sort: 'desc', nulls: 'last' } } }, { tournament: { startsAt: { sort: 'desc', nulls: 'last' } } }, { tournament: { externalId: 'desc' } }, {id:'asc'}] });
    const total = await this.db.tournamentEntry.count({ where: { playerId } });
    return { player, entries, total, totalMeaning: 'published-source-results', confirmedParticipationCount: null, limit, offset, truncated: offset + entries.length < total };
  }
  async listTournaments(limit = 50) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Tournament limit must be 1–100.');
    const events = await this.db.tournament.findMany({ orderBy: [{ season: 'desc' }, { externalId: 'desc' }, { division: 'asc' }], take: limit, include: { duplicateEventsAsA: true, duplicateEventsAsB: true, _count: { select: { entries: true } }, syncRuns: { orderBy: { startedAt: 'desc' }, take: 1 } } });
    return events.map(event => ({ ...event, entriesCountMeaning: 'published-source-results' as const }));
  }
  async tournamentCatalog(limit = 20, offset = 0) {
    return tournamentCatalog(this.db,limit,offset);
  }
  async knownDecklist(entryId: string) {
    const entry = await this.db.tournamentEntry.findUnique({ where: { id: entryId }, include: { deck: { include: { cards: { orderBy: { position: 'asc' } } } } } });
    if (!entry) throw new QueryNotFoundError(`Tournament entry not found: ${entryId}`);
    // A previous valid import remains accessible even after a later failed refresh.
    if (!entry.deck?.listImportedAt) throw new QueryNotFoundError('No successfully imported decklist for this entry.');
    return entry.deck;
  }
}
