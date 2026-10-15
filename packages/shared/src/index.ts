// Source-neutral ingestion contracts; persistence lives in packages/database.
export interface SourceReference {
  source: 'limitless-labs' | 'limitless-main' | 'limitless-api' | 'rk9' | 'playlatam';
  externalId: string;
  sourceUrl: string;
  lastSyncedAt: string;
}
export interface Tournament {
  reference: SourceReference;
  division: string | null;
  format?: string | null;
  startsAt?: string | null;
  raw?: Record<string, unknown>;
  name: string;
  dateLabel: string;
  eventDate?: string | null; // Calendar date, never an invented UTC instant.
  resultsCoverage?: 'COMPLETE_STANDINGS' | 'PUBLISHED_RESULTS' | 'UNKNOWN';
  reportedPlayerCountApproximate?: boolean;
  country: string | null;
  season: number | null;
  reportedPlayerCount: number | null;
  completed: boolean | null;
  upstreamIds: { rk9: string | null; playlatam: string | null };
}
export interface Player {
  reference: SourceReference;
  originalName: string;
  identityScope?: string;
  normalizedName: string;
  // Identity is source-local; no cross-source/name-only merging.
}
export interface TournamentEntry {
  reference: SourceReference;
  tournamentExternalId: string;
  division: string | null;
  tournamentPlayerId: string;
  raw?: Record<string, unknown>;
  player: Player;
  country: string | null;
  placement: number | null;
  points: number | null;
  record: { wins: number | null; losses: number | null; ties: number | null };
  disqualified: boolean | null;
  decklistAvailable: boolean;
  deck: Deck | null;
}
export interface Deck {
  reference: SourceReference;
  archetype: { externalId: string; name: string } | null;
  decklistUrl: string | null;
  // null = not retrieved/unavailable, never an inferred list.
  cards: DeckCard[] | null;
}
export interface DeckCard {
  category: 'pokemon' | 'trainer' | 'energy';
  language?: string | null;
  count: number;
  name: string;
  set: string;
  number: string;
}
export interface TournamentSnapshot { tournament: Tournament; entries: TournamentEntry[] }
export interface TournamentDataSource { loadTournament(url: string): Promise<TournamentSnapshot> }

export function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[’‘]/g, "'").replace(/[‐‑–—]/g, '-').trim().replace(/\s+/g, ' ');
}
export function sameSourceIdentity(a: Player, b: Player): boolean {
  return a.reference.source === b.reference.source &&
    (a.identityScope ?? 'global') === (b.identityScope ?? 'global') &&
    a.reference.externalId === b.reference.externalId;
}

export interface ImportedDecklist { cards: DeckCard[]; reference: SourceReference }
export interface DecklistDataSource extends TournamentDataSource {
  loadDecklist(url: string, tournamentId: string, tournamentPlayerId: string): Promise<ImportedDecklist>;
}
export function nameSearchKey(name: string): string {
  return normalizeName(name).replace(/['.]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().replace(/\s+/g, ' ');
}
export { publicEventDate } from './dates.js';
export type { PlayerCandidate, PlayerSearchResponse, HistoricalDeck, HistoricalEntry, PlayerHistoryResponse, TournamentCatalogResponse } from './query-contracts.js';
export type { EvidenceTournament, EvidenceResult, ComparisonPlayer, IdentityComparison, DuplicateEvidence } from './evidence-contracts.js';
export type { ScoutingFilters, ScoutingScope, ScoutingEntry, ScoutingCounts, ArchetypeGroup, ScoutingSummary, ScoutingEvidence } from './scouting-contracts.js';
