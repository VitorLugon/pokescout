import { normalizeName, publicEventDate, type SourceReference, type TournamentSnapshot } from '@tcg-scout/shared';
import type { MainTournament } from './types.js';
export function mapMainTournament(parsed: MainTournament, sourceUrl: string, retrievedAt: string): TournamentSnapshot {
  const reference = (externalId: string, url: string): SourceReference => ({ source: 'limitless-main', externalId, sourceUrl: url, lastSyncedAt: retrievedAt });
  return {
    tournament: { reference: reference(parsed.externalId, sourceUrl), division: null,
      name: parsed.name, dateLabel: parsed.dateLabel, eventDate: publicEventDate(parsed.dateLabel),
      country: parsed.country, season: null, completed: null, format: parsed.format,
      reportedPlayerCount: parsed.reportedPlayerCount, reportedPlayerCountApproximate: parsed.approximate,
      resultsCoverage: 'PUBLISHED_RESULTS', upstreamIds: { rk9: null, playlatam: null },
      raw: { eventLocationLabel: parsed.locationLabel, formatLabel: parsed.formatLabel, notes: parsed.notes, relatedSourceUrls: parsed.relatedSourceUrls, publishedResults: parsed.publishedResultCount,
        quarantinedResultCount: parsed.quarantinedResults.length, quarantinedResults: parsed.quarantinedResults,
        quarantineReason: parsed.quarantinedResults.length ? 'Repeated source profile/result identifier in one published event; identity and result require review' : null,
        reportedPlayerCountApproximate: parsed.approximate },
    },
    entries: parsed.results.map(row => ({
      reference: reference(`${parsed.externalId}:published:${row.entryId}`, sourceUrl),
      tournamentExternalId: parsed.externalId, division: null, tournamentPlayerId: row.entryId,
      player: { reference: reference(row.playerId ?? row.entryId, row.playerId ? `https://limitlesstcg.com/players/${row.playerId}` : sourceUrl),
        identityScope: row.playerId ? 'global' : `event:${parsed.externalId}`, originalName: row.name, normalizedName: normalizeName(row.name) },
      country: row.country, placement: row.placement, points: null, record: { wins: null, losses: null, ties: null }, disqualified: null,
      decklistAvailable: row.decklistUrl !== null, raw: { ...row },
      deck: row.archetypeId || row.decklistUrl ? {
        reference: reference(row.decklistUrl?.split('/').at(-1) ?? `${parsed.externalId}:published:${row.entryId}`, row.decklistUrl ?? sourceUrl),
        archetype: row.archetypeId && row.archetypeName ? { externalId: row.archetypeId, name: row.archetypeName } : null,
        decklistUrl: row.decklistUrl, cards: null,
      } : null,
    })),
  };
}
