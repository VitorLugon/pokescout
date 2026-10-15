import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '@tcg-scout/database';
import type { ScoutingEntry, ScoutingSummary, ScoutingEvidence } from '@tcg-scout/shared';
import { QueryNotFoundError } from './errors.js';
import { eventEvidenceSelect } from './evidence.js';
import { calendarDate, scoutingFiltersSchema, scoutingEvidenceSchema } from './scouting-filters.js';
import { analyzeScouting, archetypeKey } from './scouting-analysis.js';

const candidateIds = { select: { id: true }, orderBy: { id: 'asc' as const } };
const entrySelect = {
  id: true, originalName: true, country: true, placement: true, wins: true, losses: true, ties: true,
  disqualified: true, sourceUrl: true, lastSyncedAt: true,
  duplicateResultsAsA: candidateIds, duplicateResultsAsB: candidateIds,
  tournament: { select: { ...eventEvidenceSelect, eventDate: true, duplicateEventsAsA: candidateIds, duplicateEventsAsB: candidateIds } },
  deck: { select: { id: true, source: true, sourceUrl: true, lastSyncedAt: true, archetypeId: true,
    archetypeName: true, availableAtSource: true, listStatus: true, listImportedAt: true } },
} satisfies Prisma.TournamentEntrySelect;
type EntryRow = Prisma.TournamentEntryGetPayload<{ select: typeof entrySelect }>;
function project(entry: EntryRow): ScoutingEntry {
  return { ...entry, lastSyncedAt: entry.lastSyncedAt.toISOString(),
    tournament: { ...entry.tournament, lastSyncedAt: entry.tournament.lastSyncedAt.toISOString() },
    deck: entry.deck ? { ...entry.deck, lastSyncedAt: entry.deck.lastSyncedAt.toISOString(), listImportedAt: entry.deck.listImportedAt?.toISOString() ?? null } : null };
}
export class ScoutingQueryService {
  constructor(private readonly db: PrismaClient) {}
  private async snapshot(playerId: string) {
    z.uuid().parse(playerId);
    return this.db.$transaction(async tx => {
      const player = await tx.player.findUnique({ where: { id: playerId }, select: { id: true, displayName: true } });
      if (!player) throw new QueryNotFoundError('Player not found');
      // Entire identity history, explicitly projected. No page limit can bias
      // the denominator, and no source/raw/card snapshot is loaded here.
      const entries = await tx.tournamentEntry.findMany({ where: { playerId }, select: entrySelect, orderBy: { id: 'asc' } });
      const rows = entries.map(project).sort((a, b) => (calendarDate(b.tournament.eventDate) ?? '').localeCompare(calendarDate(a.tournament.eventDate) ?? '') || a.id.localeCompare(b.id));
      const revision = createHash('sha256').update(JSON.stringify({ player, rows })).digest('hex');
      return { player, rows, revision };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async summary(playerId: string, input: unknown = {}): Promise<ScoutingSummary> {
    const filters = scoutingFiltersSchema.parse(input);
    const { player, rows, revision } = await this.snapshot(playerId);
    const { counts, groups } = analyzeScouting(rows, filters);
    const options = {
      formats: [...new Set(rows.map(entry => entry.tournament.format))],
      divisions: [...new Set(rows.map(entry => entry.tournament.division))],
    };
    return { player, filters, options, counts, groups, revision, computedAt: new Date().toISOString(),
      unit: 'published-source-results', percentageDenominator: 'eligible-known-archetype-results' };
  }
  async evidence(playerId: string, input: unknown = {}): Promise<ScoutingEvidence> {
    const { scope, group, limit, offset, ...filters } = scoutingEvidenceSchema.parse(input);
    const { player, rows, revision } = await this.snapshot(playerId);
    const analysis = analyzeScouting(rows, filters);
    let selected = scope === 'duplicates' ? analysis.duplicates : scope === 'matched' ? analysis.matched : analysis.eligible;
    if (group !== undefined) selected = selected.filter(entry => archetypeKey(entry) === group);
    return { player, filters, scope, ...(group !== undefined ? { group } : {}),
      entries: selected.slice(offset, offset + limit), total: selected.length, offset, limit,
      truncated: offset + limit < selected.length, unit: 'published-source-results', revision };
  }
}
