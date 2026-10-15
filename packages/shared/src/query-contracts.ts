// Public JSON projections used by the mobile client. API responses may include
// additional inspection fields; dates below are serialized ISO timestamps.
export interface PlayerCandidate {
  alternativeMatches?: PlayerCandidate[];
  id: string;
  displayName: string;
  aliases: string[];
  identities: { source: string; scope: string; externalId: string }[];
  countries: string[];
  possibleMatchIds: string[];
}
export interface PlayerSearchResponse { matches: PlayerCandidate[]; truncated: boolean; presentation?: { policy: 'labs-first'; inspectedMatches: number; inspectedMatchesLimited: boolean } }
export interface TournamentCatalogResponse {
  presentation?: { policy: 'labs-first'; sourceRecordCount: number; groupedPairs: number };
  total: number; limit: number; offset: number; truncated: boolean;
  events: { otherSources?: TournamentCatalogResponse['events']; id: string; name: string; source: string; externalId: string; division: string | null; country: string | null; locationLabel: string | null; dateLabel: string; format: string | null; resultsCoverage: string; sourceUrl: string; lastSyncedAt: string; entriesCount: number; reportedPlayerCount: number | null; reportedPlayerCountApproximate: boolean; quarantinedResultCount: number; fullySynchronized: boolean; possibleDuplicate: boolean }[];
}
export interface DuplicateReference { id: string }
export interface HistoricalDeck {
  id: string;
  source: string;
  sourceUrl: string;
  archetypeName: string | null;
  availableAtSource: boolean;
  listStatus: 'UNAVAILABLE' | 'AVAILABLE' | 'IMPORTED' | 'FAILED';
  listImportedAt: string | null;
  lastSyncedAt: string;
  cards: { id: string; category: string; quantity: number; name: string; setCode: string; collectorNumber: string; language: string | null }[];
}
export interface HistoricalEntry {
  otherSources?: HistoricalEntry[];
  id: string;
  originalName: string;
  country: string | null;
  placement: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  disqualified: boolean | null;
  sourceUrl: string;
  lastSyncedAt: string;
  duplicateResultsAsA: DuplicateReference[];
  duplicateResultsAsB: DuplicateReference[];
  tournament: {
    eventDate?: string | null;
    lastSyncedAt?: string;
    name: string;
    source: string;
    externalId: string;
    country: string | null;
    dateLabel: string;
    format: string | null;
    division: string | null;
    resultsCoverage: string;
    fullySynchronized: boolean;
    sourceUrl: string;
    duplicateEventsAsA: DuplicateReference[];
    duplicateEventsAsB: DuplicateReference[];
  };
  deck: HistoricalDeck | null;
}
export interface PlayerHistoryResponse {
  combination?: {
    basis: 'same-name'; confirmedSamePerson: false;
    members: { playerId: string; displayName: string; identities: { source: string; scope: string; externalId: string }[] }[];
    sourceResultCount: number; groupedPairs: number; candidatesLimited: boolean; resultsLimited: boolean;
    excludedByReview: number;
  };
  player: { id: string; displayName: string };
  entries: HistoricalEntry[];
  total: number;
  totalMeaning: string;
  confirmedParticipationCount: null;
  limit: number;
  offset: number;
  truncated: boolean;
}
