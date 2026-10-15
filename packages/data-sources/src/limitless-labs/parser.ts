import { load } from 'cheerio';
import { z } from 'zod';
import { decklistSchema, standingSchema, tournamentSchema, type ParsedTournament } from './types.js';

export function tournamentLocation(url: string): { externalId: string; division: string } {
  const parsed = new URL(url);
  const match = /^\/(\d+)(?:\/(SR|JR))?\/standings$/.exec(parsed.pathname);
  if (parsed.origin !== 'https://labs.limitlesstcg.com' || !match || parsed.search || parsed.hash) {
    throw new Error('Expected an unfiltered public Labs standings URL');
  }
  return { externalId: match[1], division: match[2] ?? 'MA' };
}

// Read JSON only. Never evaluate script content or consume the /labs/user payload.
function embeddedPayload(html: string, endpoint: string, expected: Record<string, string>): unknown {
  const $ = load(html);
  const matches = $('script[type="application/json"][data-sveltekit-fetched]').toArray().filter(el => {
    const url = new URL($(el).attr('data-url') ?? '', 'https://labs.limitlesstcg.com');
    return url.origin === 'https://mew.limitlesstcg.com' && url.pathname === `/labs/data/tcg/${endpoint}` &&
      Object.entries(expected).every(([key, value]) => url.searchParams.get(key) === value);
  });
  if (matches.length !== 1) throw new Error(`Expected one embedded ${endpoint} payload; found ${matches.length}`);
  const envelope = z.object({ status: z.literal(200), body: z.string() }).parse(JSON.parse($(matches[0]).text()));
  return z.object({ ok: z.literal(true), message: z.unknown() }).parse(JSON.parse(envelope.body)).message;
}

export function parseTournament(html: string, sourceUrl: string): ParsedTournament {
  const location = tournamentLocation(sourceUrl);
  const metadata = tournamentSchema.parse(embeddedPayload(html, 'tournament', { id: location.externalId, division: location.division }));
  const standings = z.array(standingSchema).parse(embeddedPayload(html, 'standings', { tournamentId: location.externalId, division: location.division }));
  if (new Set(standings.map(row => row.tp_id)).size !== standings.length) throw new Error('Duplicate tournament player IDs');
  const title = load(html)('title').text().replace(/\s*– Limitless Labs$/, '').trim();
  if (!title) throw new Error('Missing tournament title');
  return { ...location, title, metadata, standings };
}

export function parseDecklist(html: string, tournamentId: string, playerId: string) {
  return decklistSchema.parse(embeddedPayload(html, 'decklist', { tournamentId, playerId }));
}
