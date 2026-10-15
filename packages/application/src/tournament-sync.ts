import { detectSourceDuplicates } from './source-duplicates.js';
import { type PrismaClient, type SyncStatus } from '@tcg-scout/database';
import { publicEventDate, type DecklistDataSource } from '@tcg-scout/shared';
import { sourceLocation } from '@tcg-scout/data-sources';
import { headerSchema, validateCards, validateEntry, errorSummary } from './validation.js';
import { json, saveEntry, saveDecklist } from './persistence.js';
export interface SyncOptions { url: string; maxDecklists?: number; maxTotalDecklists?: number; format?: string; expectedDeckSize?: number; entryConcurrency?: number }
export class TournamentSyncService {
  constructor(private readonly db: PrismaClient, private readonly source: DecklistDataSource) {}
  async sync(options: SyncOptions) {
    const location = sourceLocation(options.url);
    const maxDecklists = options.maxDecklists ?? 5;
    const concurrency = options.entryConcurrency ?? 1;
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('Entry concurrency must be 1–4');
    if (options.maxTotalDecklists !== undefined && (!Number.isInteger(options.maxTotalDecklists) || options.maxTotalDecklists < 0 || options.maxTotalDecklists > 20)) throw new Error('Invalid cumulative list budget');
    if (!Number.isInteger(maxDecklists) || maxDecklists < 0 || maxDecklists > 20) throw new Error('maxDecklists must be an integer between 0 and 20');
    if (options.expectedDeckSize !== undefined && (!Number.isInteger(options.expectedDeckSize) || options.expectedDeckSize <= 0)) throw new Error('Expected deck size must be a positive integer');
    let run;
    try { run = await this.db.syncRun.create({ data: { source: location.source, externalId: location.externalId, division: location.division, sourceUrl: options.url, issues: [] } }); }
    catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new Error('A sync for this tournament/division is already RUNNING; resolve it before retrying.');
      throw error;
    }
    const issues: { stage: string; entryId?: string; message: string }[] = [];
    let entriesReceived = 0, entriesSaved = 0, listsImported = 0, pendingLists = 0;
    let tournamentId: string | undefined;
    try {
      const existing = await this.db.tournament.findFirst({ where: { source: location.source, externalId: location.externalId, division: location.division } });
      if (existing) {
        tournamentId = existing.id;
        await this.db.syncRun.update({ where: { id: run.id }, data: { tournamentId } });
      }
      const snapshot = await this.source.loadTournament(options.url);
      const tournament = headerSchema.parse(snapshot.tournament);
      const quarantined = tournament.raw?.quarantinedResultCount;
      if (typeof quarantined === 'number' && quarantined > 0) issues.push({ stage: 'source-quality', message: `${quarantined} conflicting published rows retained in source metadata for review; excluded from player histories` });
      if (tournament.reference.source !== location.source || tournament.reference.externalId !== location.externalId || tournament.division !== location.division || tournament.reference.sourceUrl !== options.url) throw new Error('Tournament source/URL/division mismatch');
      if (!Array.isArray(snapshot.entries)) throw new Error('Missing standings array');
      entriesReceived = snapshot.entries.length;
      const keys = snapshot.entries.map(entry => entry.tournamentPlayerId);
      if (new Set(keys).size !== keys.length) throw new Error('Duplicate incoming entry identifiers');
      const key = { source: tournament.reference.source, externalId: tournament.reference.externalId, division: tournament.division };
      const previous = existing;
      if (key.source === 'limitless-main' && tournament.resultsCoverage !== 'PUBLISHED_RESULTS') throw new Error('Main publishes selected results, not complete standings');
      const format = options.format ?? tournament.format ?? previous?.format ?? null;
      const constructedSize = format && ['STANDARD', 'EXPANDED', 'UNLIMITED'].includes(format.trim().toUpperCase()) ? 60 : null;
      if (constructedSize && options.expectedDeckSize !== undefined && options.expectedDeckSize !== 60) throw new Error('Constructed formats require exactly 60 cards');
      const data = {
        name: tournament.name, dateLabel: tournament.dateLabel,
        eventDate: tournament.eventDate ?? previous?.eventDate ?? publicEventDate(tournament.dateLabel),
        resultsCoverage: tournament.resultsCoverage, reportedPlayerCountApproximate: tournament.reportedPlayerCountApproximate,
        startsAt: tournament.startsAt ? new Date(tournament.startsAt) : previous?.startsAt ?? null,
        format,
        expectedDeckSize: options.expectedDeckSize ?? constructedSize ?? previous?.expectedDeckSize ?? null,
        country: tournament.country ?? previous?.country ?? null, season: tournament.season ?? previous?.season ?? null,
        reportedPlayerCount: tournament.reportedPlayerCount ?? previous?.reportedPlayerCount ?? null, sourceCompleted: tournament.completed ?? previous?.sourceCompleted ?? null,
        fullySynchronized: false, sourceUrl: tournament.reference.sourceUrl,
        lastSyncedAt: new Date(tournament.reference.lastSyncedAt), raw: json(tournament.raw ?? tournament),
        upstreamIds: json({ rk9: tournament.upstreamIds.rk9 ?? (previous?.upstreamIds as { rk9?: string })?.rk9 ?? null, playlatam: tournament.upstreamIds.playlatam ?? (previous?.upstreamIds as { playlatam?: string })?.playlatam ?? null }),
      };
      // RUNNING exclusion (including unknown division) serializes lookup/create/update.
      const saved = previous
        ? await this.db.tournament.update({ where: { id: previous.id }, data })
        : await this.db.tournament.create({ data: { ...data, ...key } });
      tournamentId = saved.id;
      await this.db.syncRun.update({ where: { id: run.id }, data: { tournamentId } });
      const persist = async (rawEntry: typeof snapshot.entries[number]) => {
        try {
          const entry = validateEntry(rawEntry, tournament);
          await this.db.$transaction(tx => saveEntry(tx, saved.id, entry), { timeout: 15000 });
          entriesSaved++;
        } catch (error) {
          const code = (error as { code?: string }).code ?? '';
          if (/^P1|^ECONN/.test(code)) throw error;
          issues.push({ stage: 'entry', entryId: rawEntry?.tournamentPlayerId, message: errorSummary(error) });
        }
      };
      // Only database writes run concurrently. Source HTTP remains sequential and paced.
      for (let offset = 0; offset < snapshot.entries.length; offset += concurrency) {
        const results = await Promise.allSettled(snapshot.entries.slice(offset, offset + concurrency).map(persist));
        const failure = results.find(result => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
      }
      const persistedCount = await this.db.tournamentEntry.count({ where: { tournamentId } });
      if (persistedCount > entriesReceived) issues.push({ stage: 'standings', message: 'Previously imported entries absent from this snapshot were retained for review' });
      if (saved.resultsCoverage !== 'COMPLETE_STANDINGS') issues.push({ stage: 'coverage', message: `${saved.resultsCoverage}: published results must not be treated as full standings` });
      if (saved.reportedPlayerCount === null || entriesReceived !== saved.reportedPlayerCount) issues.push({ stage: 'standings', message: `Received ${entriesReceived} source results; source reports ${saved.reportedPlayerCountApproximate ? 'approximately ' : ''}${saved.reportedPlayerCount ?? 'an unknown count'}` });
      if (!saved.sourceCompleted) issues.push({ stage: 'tournament', message: saved.sourceCompleted === null ? 'Source tournament completion is unknown' : 'Source tournament is not completed' });
      // Load only rows present in this snapshot. Never crawl undiscovered entrants.
      const alreadyImported = options.maxTotalDecklists === undefined ? 0 : await this.db.deck.count({ where: { entry: { tournamentId }, listImportedAt: { not: null } } });
      const listBudget = options.maxTotalDecklists === undefined ? maxDecklists : Math.min(maxDecklists, Math.max(0, options.maxTotalDecklists - alreadyImported));
      const candidates = await this.db.deck.findMany({ where: { entry: { tournamentId, externalId: { in: keys } }, availableAtSource: true, listStatus: { not: 'IMPORTED' } }, include: { entry: true }, orderBy: [{ entry: { placement: { sort: 'asc', nulls: 'last' } } }, { id: 'asc' }], take: listBudget });
      for (const deck of candidates) {
        try {
          if (!deck.decklistUrl) throw new Error('Source indicates availability but supplies no public decklist URL');
          const result = await this.source.loadDecklist(deck.decklistUrl, key.externalId, deck.entry.externalId);
          if (result.reference.source !== key.source || result.reference.sourceUrl !== deck.decklistUrl || result.reference.externalId !== deck.externalId) throw new Error('Decklist source reference mismatch');
          const cards = validateCards(result.cards, saved.expectedDeckSize);
          const importedAt = new Date(result.reference.lastSyncedAt);
          if (!Number.isFinite(importedAt.getTime())) throw new Error('Invalid decklist timestamp');
          await saveDecklist(this.db, deck.id, cards, result, importedAt);
          listsImported++;
        } catch (error) {
          const message = errorSummary(error);
          issues.push({ stage: 'decklist', entryId: deck.entry.externalId, message });
          await this.db.deck.update({ where: { id: deck.id }, data: { listStatus: 'FAILED', lastListAttemptAt: new Date(), lastListError: message } });
          break; // Stop the source batch after an HTTP/extraction error.
        }
      }
      pendingLists = await this.db.deck.count({ where: { entry: { tournamentId }, availableAtSource: true, listStatus: { not: 'IMPORTED' } } });
      if (pendingLists) issues.push({ stage: 'decklist', message: `${pendingLists} available lists remain pending/failed; per-run cap ${maxDecklists}` });
      await detectSourceDuplicates(this.db, saved.id);
      const status: SyncStatus = issues.length ? 'PARTIAL' : 'SUCCESS';
      return await this.db.$transaction(async tx => {
        await tx.tournament.update({ where: { id: tournamentId }, data: { fullySynchronized: status === 'SUCCESS' } });
        return tx.syncRun.update({ where: { id: run.id }, data: { status, finishedAt: new Date(), entriesReceived, entriesSaved, listsImported, pendingLists, issues: json(issues) } });
      });
    } catch (error) {
      issues.push({ stage: 'sync', message: errorSummary(error) });
      // If the database itself is lost, RUNNING remains visible for manual recovery.
      if (tournamentId) await this.db.tournament.update({ where: { id: tournamentId }, data: { fullySynchronized: false } });
      return this.db.syncRun.update({ where: { id: run.id }, data: { status: 'FAILED', finishedAt: new Date(), entriesReceived, entriesSaved, listsImported, pendingLists, issues: json(issues) } });
    }
  }
}
