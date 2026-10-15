import { createHash } from 'node:crypto';
import type { PrismaClient } from '@tcg-scout/database';
import type { DeckCard, DecklistDataSource } from '@tcg-scout/shared';
import { json } from './persistence.js';
import { validateCards, errorSummary } from './validation.js';
export function cardFingerprint(cards: DeckCard[]) {
  // Ignore upstream row ordering; aggregate identical source printings without claiming cross-print equivalence.
  const quantities = new Map<string, number>();
  for (const card of cards) {
    const key = JSON.stringify([card.category, card.name, card.set, card.number, card.language ?? null]);
    quantities.set(key, (quantities.get(key) ?? 0) + card.count);
  }
  return createHash('sha256').update(JSON.stringify([...quantities].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))).digest('hex');
}
export class DecklistReconciliationService {
  constructor(private readonly db: PrismaClient, private readonly source: DecklistDataSource) {}
  async plan(tournamentId: string, mode: 'pending' | 'refresh' = 'pending', maxDecklists = 5) {
    if (!['pending', 'refresh'].includes(mode)) throw new Error('mode must be pending or refresh');
    if (!Number.isInteger(maxDecklists) || maxDecklists < 1 || maxDecklists > 20) throw new Error('maxDecklists must be 1–20');
    const tournament = await this.db.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new Error('Tournament not found');
    if (tournament.source !== 'limitless-labs') throw new Error('Unsupported reconciliation source');
    const where = { entry: { tournamentId }, availableAtSource: true,
      listImportedAt: mode === 'refresh' ? { not: null } : null };
    const [eligible, decks] = await Promise.all([
      this.db.deck.count({ where }),
      this.db.deck.findMany({ where, include: { entry: true, cards: { orderBy: { position: 'asc' } } },
        orderBy: [{ lastListAttemptAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }], take: maxDecklists }),
    ]);
    return { tournament, mode, maxDecklists, eligible, decks };
  }
  async reconcile(tournamentId: string, mode: 'pending' | 'refresh' = 'pending', maxDecklists = 5) {
    // Validate before claiming the same event lock used by standings sync.
    const initial = await this.plan(tournamentId, mode, maxDecklists);
    const tournament = initial.tournament;
    let run;
    try { run = await this.db.syncRun.create({ data: { tournamentId, source: tournament.source,
      externalId: tournament.externalId, division: tournament.division, sourceUrl: tournament.sourceUrl,
      issues: [{ stage: 'reconciliation', message: `Explicit ${mode} reconciliation; cap ${maxDecklists}` }] } }); }
    catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new Error('A sync for this tournament/division is already RUNNING');
      throw error;
    }
    let listsImported = 0;
    const outcomes: { deckId: string; outcome: string; message?: string }[] = [];
    try {
      // Re-read under the event lock, so an import that completed before lock acquisition cannot stale the plan.
      const plan = await this.plan(tournamentId, mode, maxDecklists);
      for (const deck of plan.decks) {
        const oldCards: DeckCard[] = deck.cards.map(card => ({ category: card.category as DeckCard['category'], count: card.quantity,
          name: card.name, set: card.setCode, number: card.collectorNumber, language: card.language }));
        try {
          if (!deck.decklistUrl) throw new Error('No public decklist URL');
          const result = await this.source.loadDecklist(deck.decklistUrl, tournament.externalId, deck.entry.externalId);
          if (result.reference.source !== deck.source || result.reference.sourceUrl !== deck.decklistUrl || result.reference.externalId !== deck.externalId) throw new Error('Decklist source reference mismatch');
          const importedAt = new Date(result.reference.lastSyncedAt);
          if (!Number.isFinite(importedAt.getTime())) throw new Error('Invalid decklist timestamp');
          const cards = validateCards(result.cards, plan.tournament.expectedDeckSize);
          const unchanged = !!deck.listImportedAt && cardFingerprint(oldCards) === cardFingerprint(cards);
          const outcome = unchanged ? 'UNCHANGED' : deck.listImportedAt ? 'CHANGED' : 'IMPORTED';
          await this.db.$transaction(async tx => {
            if (!unchanged) {
              await tx.deckCard.deleteMany({ where: { deckId: deck.id } });
              await tx.deckCard.createMany({ data: cards.map((card, position) => ({ deckId: deck.id, position,
                quantity: card.count, name: card.name, category: card.category, setCode: card.set, collectorNumber: card.number, language: card.language ?? null })) });
            }
            await tx.deck.update({ where: { id: deck.id }, data: { listStatus: 'IMPORTED',
              listImportedAt: unchanged ? deck.listImportedAt : importedAt, lastListAttemptAt: new Date(), lastListError: null,
              rawList: unchanged ? undefined : json(result) } });
            await tx.decklistReview.create({ data: { deckId: deck.id, runId: run.id, outcome, sourceUrl: deck.decklistUrl!,
              beforeCards: json(oldCards), afterCards: json(cards), previousImportedAt: deck.listImportedAt, retrievedAt: importedAt } });
          });
          if (!unchanged) listsImported++;
          outcomes.push({ deckId: deck.id, outcome });
        } catch (error) {
          const message = errorSummary(error);
          await this.db.$transaction(async tx => {
            await tx.deck.update({ where: { id: deck.id }, data: { listStatus: 'FAILED', lastListAttemptAt: new Date(), lastListError: message } });
            await tx.decklistReview.create({ data: { deckId: deck.id, runId: run.id, outcome: 'FAILED', sourceUrl: deck.decklistUrl,
              beforeCards: json(oldCards), previousImportedAt: deck.listImportedAt, error: message } });
          });
          outcomes.push({ deckId: deck.id, outcome: 'FAILED', message });
          // Stop after any source/validation failure; do not amplify HTTP restrictions or malformed responses.
          break;
        }
      }
      const pendingLists = await this.db.deck.count({ where: { entry: { tournamentId }, availableAtSource: true, listStatus: { not: 'IMPORTED' } } });
      const partial = outcomes.some(item => item.outcome === 'FAILED') || plan.eligible > outcomes.length || pendingLists > 0;
      return await this.db.$transaction(async tx => {
        // A list-only job cannot certify standings completeness. Preserve false until a full sync proves it.
        if (partial) await tx.tournament.update({ where: { id: tournamentId }, data: { fullySynchronized: false } });
        return tx.syncRun.update({ where: { id: run.id }, data: { status: partial ? 'PARTIAL' : 'SUCCESS', finishedAt: new Date(),
          listsImported, pendingLists, issues: json([{ stage: 'reconciliation', mode, eligible: plan.eligible, cap: maxDecklists, outcomes }]) } });
      });
    } catch (error) {
      await this.db.tournament.update({ where: { id: tournamentId }, data: { fullySynchronized: false } });
      return this.db.syncRun.update({ where: { id: run.id }, data: { status: 'FAILED', finishedAt: new Date(), listsImported,
        issues: json([{ stage: 'reconciliation', message: errorSummary(error), outcomes }]) } });
    }
  }
}
