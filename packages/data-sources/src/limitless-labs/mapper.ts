import { publicEventDate, normalizeName, type DeckCard, type SourceReference, type TournamentSnapshot } from '@tcg-scout/shared';
import type { ParsedTournament } from './types.js';
import type { parseDecklist } from './parser.js';

export function mapTournament(parsed: ParsedTournament, sourceUrl: string, lastSyncedAt: string): TournamentSnapshot {
  const reference = (externalId: string, url: string): SourceReference => ({ source: 'limitless-labs', externalId, sourceUrl: url, lastSyncedAt });
  const base = sourceUrl.replace(/\/standings$/, '');
  const id = `${parsed.externalId}:${parsed.division}`;
  const completeStandings = parsed.standings.length > 0 && parsed.metadata.players === parsed.standings.length;
  return {
    tournament: {
      reference: reference(parsed.externalId, sourceUrl), division: parsed.division, name: parsed.title,
      format: parsed.metadata.format ?? null, raw: { ...parsed.metadata, publicResultsEmpty: parsed.standings.length === 0,
        sourceReportedCountMismatch: parsed.metadata.players !== null && parsed.metadata.players !== parsed.standings.length },
      resultsCoverage: completeStandings ? 'COMPLETE_STANDINGS' : 'UNKNOWN', eventDate: publicEventDate(parsed.metadata.date),
      dateLabel: parsed.metadata.date, country: parsed.metadata.country, season: parsed.metadata.season,
      reportedPlayerCount: parsed.metadata.players, completed: parsed.metadata.completed === 1,
      upstreamIds: { rk9: parsed.metadata.rk9_id, playlatam: parsed.metadata.playlatam_id },
    },
    entries: parsed.standings.map(row => {
      const tpId = String(row.tp_id).padStart(4, '0');
      const url = `${base}/player/${tpId}`;
      const decklistUrl = row.decklist ? `${url}/decklist` : null;
      const entryId = `${id}:${row.tp_id}`;
      const hasGlobalId = typeof row.player_id === 'number' && row.player_id > 0;
      return {
        reference: reference(entryId, url), tournamentExternalId: parsed.externalId, division: parsed.division,
        tournamentPlayerId: String(row.tp_id), raw: row,
        player: {
          reference: reference(hasGlobalId ? String(row.player_id) : String(row.tp_id), hasGlobalId ? `https://labs.limitlesstcg.com/players/${row.player_id}` : url),
          identityScope: hasGlobalId ? 'global' : `entry:${id}`,
          originalName: row.name, normalizedName: normalizeName(row.name),
        },
        country: row.country, placement: row.placement, points: row.points,
        record: { wins: row.wins, losses: row.losses, ties: row.ties }, disqualified: row.dqed === 1,
        decklistAvailable: row.decklist === 1,
        deck: row.deck_id || row.decklist ? {
          reference: reference(entryId, decklistUrl ?? url),
          archetype: row.deck_id && row.deck_name ? { externalId: row.deck_id, name: row.deck_name } : null,
          decklistUrl, cards: null,
        } : null,
      };
    }),
  };
}
export function mapDeckCards(raw: ReturnType<typeof parseDecklist>): DeckCard[] {
  return (['pokemon', 'trainer', 'energy'] as const).flatMap(category => raw[category].map(card => ({ ...card, category })));
}
