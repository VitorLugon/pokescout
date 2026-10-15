import type { PrismaClient } from '@tcg-scout/database';
import type { DecklistDataSource } from '@tcg-scout/shared';
import { sourceLocation, type CatalogEvent } from '@tcg-scout/data-sources';
import { TournamentSyncService } from './tournament-sync.js';

export function validateCatalog(events: CatalogEvent[]) {
  if (!Array.isArray(events) || events.length < 1 || events.length > 2000) throw new Error('Catalog must contain 1–2000 explicit source events/divisions');
  for (const event of events) {
    const actual = sourceLocation(event.sourceUrl);
    if (actual.source !== event.source || actual.externalId !== event.externalId || actual.division !== event.division) throw new Error('Catalog source identifiers do not match its public URL');
    if (!event.name || !Number.isFinite(Date.parse(event.discoveredAt))) throw new Error('Missing catalog name or capture time');
  }
  if (new Set(events.map(event => event.sourceUrl)).size !== events.length) throw new Error('Duplicate catalog URLs');
  return [...events].sort((a,b) => (b.season ?? 0) - (a.season ?? 0)); // Stable source ordering within a season.
}
export class CatalogImportService {
  constructor(private readonly db: PrismaClient, private readonly sources: Partial<Record<CatalogEvent['source'], DecklistDataSource>>) {}
  async preview(events: CatalogEvent[]) {
    const sorted = validateCatalog(events);
    const existing = await this.db.tournament.findMany({ select: { source: true, externalId: true, division: true,
      syncRuns: { where: { status: { in: ['SUCCESS','PARTIAL'] } }, orderBy: { startedAt: 'desc' }, take: 1, select: { entriesReceived: true, entriesSaved: true } },
    } });
    const complete = new Set(existing.filter(event => event.syncRuns.some(run => run.entriesSaved === run.entriesReceived)).map(event => JSON.stringify([event.source,event.externalId,event.division])));
    return { requested: sorted.length, alreadyImported: sorted.filter(event => complete.has(JSON.stringify([event.source,event.externalId,event.division]))).length,
      pending: sorted.filter(event => !complete.has(JSON.stringify([event.source,event.externalId,event.division]))) };
  }
  async apply(events: CatalogEvent[], maxEvents: number, progress: (report: { event: CatalogEvent; run: Awaited<ReturnType<TournamentSyncService['sync']>> }) => Promise<void> = async () => {}, shouldStop: () => boolean = () => false) {
    if (!Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 250) throw new Error('max-events must be 1–250');
    const plan = await this.preview(events); let processed = 0;
    for (const event of plan.pending.slice(0,maxEvents)) {
      if (shouldStop()) return { processed, stoppedOnError: false, stoppedByOperator: true };
      const source = this.sources[event.source]; if (!source) throw new Error('Missing catalog source adapter');
      const tracedSource: DecklistDataSource = {
        loadTournament: async url => {
          const snapshot = await source.loadTournament(url);
          snapshot.tournament.raw = { ...snapshot.tournament.raw, catalogSelectionReference: { sourceUrl: event.catalogUrl, lastSyncedAt: event.discoveredAt, format: event.format, season: event.season } };
          return snapshot;
        },
        loadDecklist: (...args) => source.loadDecklist(...args),
      };
      const run = await new TournamentSyncService(this.db, tracedSource).sync({ url: event.sourceUrl, maxDecklists: 0, format: event.format ?? undefined, entryConcurrency: 4 });
      processed++;
      await progress({ event, run });
      if (run.status === 'FAILED' || (run.issues as { stage?: string; entryId?: string }[]).some(issue => issue.stage === 'entry' || issue.stage === 'decklist' && issue.entryId)) return { processed, stoppedOnError: true };
    }
    return { processed, stoppedOnError: false };
  }
}
