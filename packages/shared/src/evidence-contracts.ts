export interface EvidenceTournament {
  id: string; source: string; externalId: string; name: string; dateLabel: string;
  country: string | null; division: string | null; format: string | null;
  resultsCoverage: string; fullySynchronized: boolean; sourceUrl: string; lastSyncedAt: string;
}
export interface EvidenceResult {
  id: string; externalId: string; playerId: string; originalName: string;
  country: string | null; placement: number | null; archetypeName: string | null;
  sourceUrl: string; lastSyncedAt: string; tournament: EvidenceTournament;
}
export interface ComparisonPlayer {
  id: string; displayName: string; aliases: string[];
  identities: { source: string; externalId: string; scope: string; sourceUrl: string; lastSyncedAt: string }[];
  countries: string[]; resultCount: number; entries: EvidenceResult[]; historyTruncated: boolean;
}
export interface IdentityComparison {
  players: ComparisonPlayer[];
  sharedNameKeys: string[]; overlappingTournamentIds: string[];
  possibleOverlappingSourceEventPairs: { id: string; tournamentAId: string; tournamentBId: string }[];
  reviews: { id: string; decision: string; reviewer: string; reason: string; evidenceUrls: string[]; createdAt: string }[];
  reviewsLimit: number; reviewsTotal: number; reviewsTruncated: boolean;
  reviewDecisionsConflict: boolean;
  historyLimit: number; historyTruncated: boolean;
  countMeaning: 'published-source-results'; automaticallyMerged: false;
}
export interface DuplicateEvidence {
  id: string; kind: 'event' | 'result'; status: 'POSSIBLE'; detectedAt: string;
  signals: string[]; limitations: string[];
  tournaments: EvidenceTournament[]; results: EvidenceResult[];
  tournamentCandidateId: string | null;
  confirmedSamePerson: false; confirmedAdditionalParticipation: false;
}
