import { z } from 'zod';
import type { PrismaClient } from '@tcg-scout/database';
import type { DecklistDataSource } from '@tcg-scout/shared';
import { sourceLocation } from '@tcg-scout/data-sources';
import { TournamentSyncService } from './tournament-sync.js';
const manifestSchema = z.object({ events: z.array(z.object({
  label: z.string().min(1), url: z.url(), maxDecklists: z.number().int().min(0).max(1).default(1),
  expectedDeckSize: z.number().int().positive().optional(),
}).strict()).min(1).max(6) }).strict();
export function validateExpansionManifest(input: unknown) {
  const manifest = manifestSchema.parse(input);
  const events = manifest.events.map(event => ({ ...event, ...sourceLocation(event.url) }));
  if (new Set(events.map(event => `${event.source}:${event.externalId}:${event.division}`)).size !== events.length) throw new Error('Selection contains duplicate source events');
  return events;
}
type SupportedSource = ReturnType<typeof sourceLocation>['source'];
export class HistoricalExpansionService {
  constructor(private readonly db: PrismaClient, private readonly sources: Partial<Record<SupportedSource, DecklistDataSource>>) {}
  async preview(input: unknown) {
    const events = validateExpansionManifest(input);
    const plan = [];
    for (const event of events) {
      const existing = await this.db.tournament.findFirst({ where: { source: event.source, externalId: event.externalId, division: event.division } });
      const importedLists = existing ? await this.db.deck.count({ where: { entry: { tournamentId: existing.id }, listImportedAt: { not: null } } }) : 0;
      plan.push({ ...event, existingTournamentId: existing?.id ?? null, importedLists, listBudget: Math.max(0, event.maxDecklists - importedLists) });
    }
    return { mode: 'PREVIEW_NO_SOURCE_REQUESTS' as const, maxEvents: 6, maxListsPerEvent: 1, events: plan };
  }
  async apply(input: unknown) {
    const plan = await this.preview(input);
    const runs = [];
    for (const event of plan.events) {
      const source = this.sources[event.source];
      if (!source) throw new Error(`No adapter configured for ${event.source}`);
      // Re-evaluate the cumulative list budget after any prior work in this process.
      const current = (await this.preview({ events: [{ label: event.label, url: event.url, maxDecklists: event.maxDecklists, expectedDeckSize: event.expectedDeckSize }] })).events[0];
      const run = await new TournamentSyncService(this.db, source).sync({ url: event.url, maxDecklists: current.listBudget, maxTotalDecklists: event.maxDecklists, expectedDeckSize: event.expectedDeckSize });
      runs.push(run);
      const issues = run.issues as { stage?: string; entryId?: string }[];
      if (run.status === 'FAILED' || issues.some(issue => issue.stage === 'entry' || (issue.stage === 'decklist' && issue.entryId))) break;
    }
    return { runs, requestedEvents: plan.events.length, processedEvents: runs.length, stoppedEarly: runs.length < plan.events.length };
  }
}
