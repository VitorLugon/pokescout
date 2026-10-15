import type { TournamentDataSource } from '@tcg-scout/shared';
import { createPublicClient, type PageReader } from './client.js';
import { mapDeckCards, mapTournament } from './mapper.js';
import { parseDecklist, parseTournament, tournamentLocation } from './parser.js';

export class LimitlessLabsSource implements TournamentDataSource {
  constructor(private readonly read: PageReader = createPublicClient()) {}
  async loadTournament(url: string) {
    const page = await this.read(url);
    return mapTournament(parseTournament(page.html, url), url, page.lastSyncedAt);
  }
  async loadDecklist(url: string, tournamentId: string, tournamentPlayerId: string) {
    const match = /\/player\/(\d+)\/decklist$/.exec(new URL(url).pathname);
    const location = tournamentLocation(url.replace(/\/player\/\d+\/decklist$/, '/standings'));
    if (!match || location.externalId !== tournamentId || Number(match[1]) !== Number(tournamentPlayerId)) {
      throw new Error('Decklist URL does not match the requested tournament entry');
    }
    const page = await this.read(url);
    return { cards: mapDeckCards(parseDecklist(page.html, tournamentId, match[1])), reference: {
      source: 'limitless-labs' as const, externalId: `${tournamentId}:${location.division}:${Number(match[1])}`,
      sourceUrl: url, lastSyncedAt: page.lastSyncedAt,
    } };
  }
}
