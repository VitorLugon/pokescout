import type { DecklistDataSource, TournamentSnapshot } from '@tcg-scout/shared';
import { createMainClient, type PageReader } from './client.js';
import { parseMainTournament, parseMainDecklist, parseMainPlayerHistory } from './parser.js';
import { mapMainTournament } from './mapper.js';
export class LimitlessMainSource implements DecklistDataSource {
  private readonly entries = new Map<string, TournamentSnapshot['entries'][number]>();
  constructor(private readonly read: PageReader = createMainClient()) {}
  async loadTournament(url: string) {
    const page = await this.read(url);
    const catalog = await this.read('https://limitlesstcg.com/tournaments');
    const snapshot = mapMainTournament(parseMainTournament(page.html, url, catalog.html), url, page.lastSyncedAt);
    snapshot.tournament.raw!.catalogReference = { sourceUrl: catalog.sourceUrl, lastSyncedAt: catalog.lastSyncedAt };
    for (const entry of snapshot.entries) this.entries.set(`${snapshot.tournament.reference.externalId}:${entry.tournamentPlayerId}`, entry);
    return snapshot;
  }
  async loadDecklist(url: string, tournamentId: string, tournamentPlayerId: string) {
    const entry = this.entries.get(`${tournamentId}:${tournamentPlayerId}`);
    if (!entry?.deck || entry.deck.decklistUrl !== url) throw new Error('Load the explicit Main tournament first; list URL must match its published entry');
    const page = await this.read(url);
    return { cards: parseMainDecklist(page.html), reference: { ...entry.deck.reference, sourceUrl: url, lastSyncedAt: page.lastSyncedAt } };
  }
  async loadPlayerHistory(url: string) {
    const page = await this.read(url);
    const history = parseMainPlayerHistory(page.html, url);
    return { ...history, reference: { source: 'limitless-main' as const, externalId: history.playerExternalId, sourceUrl: url, lastSyncedAt: page.lastSyncedAt } };
  }
}
