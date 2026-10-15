export interface MainResult {
  entryId: string;
  playerId: string | null;
  name: string;
  country: string | null;
  placement: number | null;
  archetypeId: string | null;
  archetypeName: string | null;
  decklistUrl: string | null;
}
export interface MainTournament {
  externalId: string;
  name: string;
  country: string | null;
  dateLabel: string;
  locationLabel: string | null;
  format: string | null;
  formatLabel: string | null;
  reportedPlayerCount: number | null;
  approximate: boolean;
  notes: string | null;
  relatedSourceUrls: string[];
  results: MainResult[];
  publishedResultCount: number;
  quarantinedResults: MainResult[];
}
