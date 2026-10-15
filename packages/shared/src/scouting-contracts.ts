import type { HistoricalDeck, HistoricalEntry } from './query-contracts.js';

export interface ScoutingFilters {
  from?: string; to?: string;
  dateState: 'all' | 'known' | 'unknown';
  formatMode: 'all' | 'known' | 'unknown'; format?: string;
  divisionMode: 'all' | 'known' | 'unknown'; division?: string;
}
export type ScoutingScope = 'eligible' | 'duplicates' | 'matched';
export type ScoutingEntry = Omit<HistoricalEntry, 'deck' | 'tournament'> & {
  deck: (Omit<HistoricalDeck, 'cards'> & { archetypeId: string | null }) | null;
  tournament: HistoricalEntry['tournament'] & { id: string; eventDate: string | null; lastSyncedAt: string };
};
export interface ScoutingCounts {
  availableResults: number;
  matchingResults: number;
  excludedUnknownDateByPeriod: number;
  excludedPossibleDuplicates: number;
  eligibleResults: number;
  knownArchetypeResults: number;
  unknownArchetypeResults: number;
}
export interface ArchetypeGroup {
  key: string; source: string; externalId: string | null; name: string | null; labels: string[];
  resultCount: number; denominator: number; percentage: number;
  eventCount: number;
  events: { id: string; name: string; dateLabel: string; eventDate: string | null; country: string | null; sourceUrl: string }[];
  eventsTruncated: boolean;
}
export interface ScoutingSummary {
  player: { id: string; displayName: string };
  filters: ScoutingFilters;
  options: { formats: (string | null)[]; divisions: (string | null)[] };
  counts: ScoutingCounts; groups: ArchetypeGroup[];
  unit: 'published-source-results'; percentageDenominator: 'eligible-known-archetype-results';
  revision: string; computedAt: string;
}
export interface ScoutingEvidence {
  player: { id: string; displayName: string }; filters: ScoutingFilters;
  scope: ScoutingScope; group?: string;
  entries: ScoutingEntry[]; total: number; offset: number; limit: number; truncated: boolean;
  unit: 'published-source-results'; revision: string;
}
