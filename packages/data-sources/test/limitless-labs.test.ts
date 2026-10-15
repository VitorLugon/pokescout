import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { parseTournament, parseDecklist } from '../src/limitless-labs/parser.js';
import { mapTournament, mapDeckCards } from '../src/limitless-labs/mapper.js';
import { createPublicClient } from '../src/limitless-labs/client.js';
import { LimitlessLabsSource } from '../src/limitless-labs/index.js';
const fixture = (file: string) => readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
const manifest = JSON.parse(fixture('manifest.json')) as { sourceUrl: string; decklistUrl: string; retrievedAt: string };
const html = fixture('standings.html');
const parsed = () => parseTournament(html, manifest.sourceUrl);
function mutateStanding(change: (rows: Record<string, unknown>[]) => void) {
  const $ = load(html);
  const script = $('script[data-url*="/standings?"]');
  const envelope = JSON.parse(script.text());
  const data = JSON.parse(envelope.body);
  change(data.message);
  envelope.body = JSON.stringify(data);
  script.text(JSON.stringify(envelope));
  return $.html();
}

test('public capture parses metadata and selected standings, without conflating sample/count', () => {
  const result = parsed();
  assert.equal(result.title, 'International Championship São Paulo');
  assert.equal(result.externalId, '0009');
  assert.equal(result.division, 'MA');
  assert.equal(result.metadata.players, 1810);
  assert.equal(result.standings.length, 5);
  assert.equal(result.metadata.rk9_id, 'LA01mwu6ugCwMEJxWT2H');
  assert.equal(result.metadata.playlatam_id, null);
});

test('mapping preserves identity scopes, source URLs, country and historical results', () => {
  const snapshot = mapTournament(parsed(), manifest.sourceUrl, manifest.retrievedAt);
  const entry = snapshot.entries[0];
  assert.equal(entry.tournamentPlayerId, '509');
  assert.equal(entry.player.reference.externalId, '1837');
  assert.equal(entry.reference.externalId, '0009:MA:509');
  assert.equal(entry.player.originalName, 'miloslav posledni');
  assert.equal(entry.country, 'CZ');
  assert.equal(entry.placement, 1);
  assert.deepEqual(entry.record, { wins: 14, losses: 2, ties: 0 });
  assert.equal(entry.deck?.archetype?.externalId, 'regidrago-vstar');
  assert.equal(entry.deck?.decklistUrl, manifest.decklistUrl);
  assert.equal(entry.deck?.cards, null);
  assert.equal(snapshot.entries[3].country, 'BR');
  assert.equal(snapshot.entries[3].placement, 10);
  assert.equal(snapshot.tournament.reference.lastSyncedAt, manifest.retrievedAt);
  assert.equal(entry.deck?.reference.source, 'limitless-labs');
});

test('missing archetype/list and null placement survive mapping', () => {
  const entry = mapTournament(parsed(), manifest.sourceUrl, manifest.retrievedAt).entries.at(-1)!;
  assert.equal(entry.placement, null);
  assert.equal(entry.disqualified, true);
  assert.equal(entry.decklistAvailable, false);
  assert.equal(entry.deck, null);
});

test('decklist parses categories and exact source card identifiers', () => {
  const cards = mapDeckCards(parseDecklist(fixture('decklist.html'), '0009', '0509'));
  assert.equal(cards.reduce((n, row) => n + row.count, 0), 60);
  assert.equal(cards.length, 26);
  assert.deepEqual(cards[0], { count: 4, name: 'Teal Mask Ogerpon ex', set: 'TWM', number: '25', category: 'pokemon' });
  assert.equal(cards.filter(row => row.category === 'energy').reduce((n, row) => n + row.count, 0), 10);
  assert.throws(() => parseDecklist(fixture('decklist.html'), '0009', '9999'), /Expected one/);
});

test('missing/duplicate payloads, wrong event and malformed data fail visibly', () => {
  assert.throws(() => parseTournament('<html>unavailable</html>', manifest.sourceUrl), /Expected one/);
  assert.throws(() => parseTournament(html, manifest.sourceUrl.replace('0009', '9999')), /Expected one/);
  assert.throws(() => parseTournament(html, manifest.sourceUrl + '?c=BR'), /unfiltered/);
  assert.throws(() => parseTournament(mutateStanding(rows => { rows[0].wins = -1; }), manifest.sourceUrl));
  assert.throws(() => parseTournament(mutateStanding(rows => { rows[1].tp_id = rows[0].tp_id; }), manifest.sourceUrl), /Duplicate/);
  assert.throws(() => parseTournament(mutateStanding(rows => { delete rows[0].player_id; }), manifest.sourceUrl));
  const $ = load(html);
  $('body').append($('script[data-url*="/standings?"]').clone());
  assert.throws(() => parseTournament($.html(), manifest.sourceUrl), /found 2/);
});

test('sanitized fixtures have no executable or user scripts', () => {
  for (const file of ['standings.html', 'decklist.html']) {
    const $ = load(fixture(file));
    assert.equal($('script:not([type="application/json"])').length, 0);
    assert.equal($('script[data-url$="/user"]').length, 0);
  }
});

test('HTTP retrieval caches successful responses and keeps original timestamp', async () => {
  let calls = 0;
  const client = createPublicClient(async (_url, options) => {
    calls++;
    assert.equal(options?.redirect, 'error');
    assert.equal(options?.credentials, undefined);
    return new Response(html, { headers: { 'content-type': 'text/html' } });
  });
  const a = await client(manifest.sourceUrl);
  const b = await client(manifest.sourceUrl);
  assert.equal(calls, 1);
  assert.equal(a, b);
});

test('HTTP errors stop without retry; invalid origins never reach fetch', async () => {
  let calls = 0;
  const client = createPublicClient(async () => { calls++; return new Response('slow down', { status: 429, headers: { 'retry-after': '60' } }); });
  await assert.rejects(client(manifest.sourceUrl), /HTTP 429.*60/);
  assert.equal(calls, 1);
  await assert.rejects(client('https://example.com/0009/standings'), /Only public Labs/);
  assert.equal(calls, 1);
});

test('source interface composes retrieval, parser, mapping and a separate list snapshot offline', async () => {
  const source = new LimitlessLabsSource(async url => ({ html: url === manifest.sourceUrl ? html : fixture('decklist.html'), sourceUrl: url, lastSyncedAt: manifest.retrievedAt }));
  const snapshot = await source.loadTournament(manifest.sourceUrl);
  const entry = snapshot.entries[0];
  const list = await source.loadDecklist(entry.deck!.decklistUrl!, snapshot.tournament.reference.externalId, '0509');
  assert.equal(list.cards.reduce((n, row) => n + row.count, 0), 60);
  assert.equal(list.reference.sourceUrl, manifest.decklistUrl);
  assert.equal(list.reference.externalId, entry.deck!.reference.externalId);
  await assert.rejects(source.loadDecklist(manifest.decklistUrl, '9999', '0509'), /does not match/);
});
