import type { Prisma } from '@tcg-scout/database';
import type { EvidenceResult, EvidenceTournament } from '@tcg-scout/shared';

export const eventEvidenceSelect = {
  id: true, source: true, externalId: true, name: true, dateLabel: true, country: true,
  division: true, format: true, resultsCoverage: true, fullySynchronized: true,
  sourceUrl: true, lastSyncedAt: true,
} satisfies Prisma.TournamentSelect;
export const resultEvidenceSelect = {
  id: true, externalId: true, playerId: true, originalName: true, country: true, placement: true,
  sourceUrl: true, lastSyncedAt: true, deck: { select: { archetypeName: true } },
  tournament: { select: eventEvidenceSelect },
} satisfies Prisma.TournamentEntrySelect;
type EventRow = Prisma.TournamentGetPayload<{ select: typeof eventEvidenceSelect }>;
type ResultRow = Prisma.TournamentEntryGetPayload<{ select: typeof resultEvidenceSelect }>;
export function eventEvidence(event: EventRow): EvidenceTournament {
  return { id: event.id, source: event.source, externalId: event.externalId, name: event.name,
    dateLabel: event.dateLabel, country: event.country, division: event.division, format: event.format,
    resultsCoverage: event.resultsCoverage, fullySynchronized: event.fullySynchronized,
    sourceUrl: event.sourceUrl, lastSyncedAt: event.lastSyncedAt.toISOString() };
}
export function resultEvidence(entry: ResultRow): EvidenceResult {
  return { id: entry.id, externalId: entry.externalId, playerId: entry.playerId,
    originalName: entry.originalName, country: entry.country, placement: entry.placement,
    archetypeName: entry.deck?.archetypeName ?? null, sourceUrl: entry.sourceUrl,
    lastSyncedAt: entry.lastSyncedAt.toISOString(), tournament: eventEvidence(entry.tournament) };
}
export function evidenceSignals(evidence: unknown): string[] {
  if (!evidence || typeof evidence !== 'object' || !('signals' in evidence)) return [];
  const signals = evidence.signals;
  return Array.isArray(signals) ? signals.filter((value): value is string => typeof value === 'string').slice(0, 20).map(value => value.slice(0, 200)) : [];
}
