import { load } from 'cheerio';
import { sameSourceIdentity } from '../../shared/src/index.js';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTournament, parseDecklist } from '../src/limitless-labs/parser.js';
import { mapTournament, mapDeckCards } from '../src/limitless-labs/mapper.js';
const read = (name: string) => readFileSync(new URL(`./fixtures/milestone2/${name}`, import.meta.url), 'utf8');
for (const [key, id, division, count, provider] of [
  ['0075-standings', '0075', 'MA', 1074, 'rk9'],
  ['0075-SR-standings', '0075', 'SR', 96, 'rk9'],
  ['0012-standings', '0012', 'MA', 215, 'playlatam'],
] as const) {
  test(`captured ${key} preserves provider, division, missing fields and raw metadata`, () => {
    const url = `https://labs.limitlesstcg.com/${id}${division === 'MA' ? '' : `/${division}`}/standings`;
    const parsed = parseTournament(read(`${key}.html`), url);
    const snapshot = mapTournament(parsed, url, '2026-10-14T00:00:00Z');
    assert.equal(snapshot.tournament.division, division);
    assert.equal(snapshot.tournament.reportedPlayerCount, count);
    assert.ok(snapshot.tournament.upstreamIds[provider]);
    assert.equal(snapshot.tournament.format, null);
    assert.equal(snapshot.tournament.raw?.type, provider === 'rk9' ? 'regional' : 'special');
    if (key === '0075-standings') assert.equal(snapshot.entries[0].country, null);
    if (division === 'SR') assert.match(snapshot.entries[0].deck!.decklistUrl!, /\/SR\/player\//);
  });
}
for (const [key, id, playerId] of [['0075-standings', '0075', '0475'], ['0012-standings', '0012', '0086']] as const) {
  test(`captured ${key} decklist totals 60 with source print identifiers`, () => {
    const cards = mapDeckCards(parseDecklist(read(`${key}-decklist.html`), id, playerId));
    assert.equal(cards.reduce((n, card) => n + card.count, 0), 60);
    assert.ok(cards.every(card => card.set && card.number));
  });
}

for (const missingId of [null, 0]) {
  test(`unverified global player ID ${String(missingId)} falls back to separate event identities`, () => {
    const $ = load(read('0012-standings.html'));
    const script = $('script[data-url*="/standings?"]');
    const envelope = JSON.parse(script.text());
    const payload = JSON.parse(envelope.body);
    payload.message[0].player_id = missingId;
    envelope.body = JSON.stringify(payload);
    script.text(JSON.stringify(envelope));
    const url = 'https://labs.limitlesstcg.com/0012/standings';
    const parsed = parseTournament($.html(), url);
    const a = mapTournament(parsed, url, '2026-10-14T00:00:00Z').entries[0].player;
    const b = mapTournament({ ...parsed, externalId: '9998' }, url.replace('0012', '9998'), '2026-10-14T00:00:00Z').entries[0].player;
    assert.equal(a.identityScope, 'entry:0012:MA');
    assert.equal(a.reference.externalId, '86');
    assert.equal(sameSourceIdentity(a, b), false);
    assert.match(a.reference.sourceUrl, /\/0012\/player\/0086$/);
  });
}
