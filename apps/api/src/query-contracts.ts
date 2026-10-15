import type { ScoutQueryService } from '@tcg-scout/application';
import type { HistoricalDeck, PlayerHistoryResponse, PlayerSearchResponse } from '@tcg-scout/shared';

// Compile-time checks keep the browser's shared projections compatible with
// actual query-service responses after Fastify serializes database dates.
type Wire<T> = T extends Date ? string : T extends (infer Item)[] ? Wire<Item>[] : T extends object ? { [Key in keyof T]: Wire<T[Key]> } : T;
type Compatible<Projection, Actual extends Projection> = Actual;
export type SearchContract = Compatible<PlayerSearchResponse, Wire<Awaited<ReturnType<ScoutQueryService['searchPlayers']>>>>;
export type PreferredSearchContract = Compatible<PlayerSearchResponse, Wire<Awaited<ReturnType<ScoutQueryService['preferredSearch']>>>>;
export type HistoryContract = Compatible<PlayerHistoryResponse, Wire<Awaited<ReturnType<ScoutQueryService['playerHistory']>>>>;
export type CombinedHistoryContract = Compatible<PlayerHistoryResponse, Wire<Awaited<ReturnType<ScoutQueryService['combinedHistory']>>>>;
export type DecklistContract = Compatible<HistoricalDeck, Wire<Awaited<ReturnType<ScoutQueryService['knownDecklist']>>>>;
