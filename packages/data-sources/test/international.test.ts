import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { parseMainTournament, parseMainDecklist, parseMainPlayerHistory } from '../src/limitless-main/parser.js';
import { mapMainTournament } from '../src/limitless-main/mapper.js';
import { LimitlessMainSource } from '../src/limitless-main/index.js';
import { createMainClient } from '../src/limitless-main/client.js';
import { parseTournament } from '../src/limitless-labs/parser.js';
import { mapTournament } from '../src/limitless-labs/mapper.js';
import { eventDuplicateSignals } from '../../application/src/source-duplicates.js';
import { publicEventDate, sameSourceIdentity } from '../../shared/src/index.js';
const read = (name: string) => readFileSync(new URL(`./fixtures/international/${name}.html`, import.meta.url), 'utf8');
const timestamp = '2026-10-14T00:00:00Z';
for (const [id, country, count] of [['569', 'JP', 5000], ['567', 'KR', 645]] as const) {
  test(`Main ${id} preserves selected results, regional format and unknown record/division`, () => {
    const parsed = parseMainTournament(read(`main-${id}`), `https://limitlesstcg.com/tournaments/${id}`, read('main-index'));
    const snapshot = mapMainTournament(parsed, `https://limitlesstcg.com/tournaments/${id}`, timestamp);
    assert.equal(snapshot.entries.length, 32);
    assert.equal(snapshot.tournament.country, country);
    assert.equal(snapshot.tournament.reportedPlayerCount, count);
    assert.equal(snapshot.tournament.resultsCoverage, 'PUBLISHED_RESULTS');
    assert.equal(snapshot.tournament.format, 'standard-jp');
    assert.equal(snapshot.tournament.division, null); assert.equal(snapshot.tournament.season, null);
    assert.equal(snapshot.tournament.completed, null);
    assert.equal(snapshot.entries[0].points, null); assert.equal(snapshot.entries[0].disqualified, null);
    assert.deepEqual(snapshot.entries[0].record, { wins: null, losses: null, ties: null });
    assert.equal(snapshot.tournament.reportedPlayerCountApproximate, id === '569');
    assert.equal(snapshot.entries[0].player.reference.source, 'limitless-main');
    if (id === '567') assert.equal(snapshot.entries[12].country, 'JP');
  });
  test(`Main ${id} list parses 60 cards with original set, number and language`, () => {
    const cards = parseMainDecklist(read(`main-${id}-list`));
    assert.equal(cards.reduce((n, card) => n + card.count, 0), 60);
    assert.ok(cards.every(card => card.set && card.number && card.language));
  });
}
test('Main international Unicode names survive unchanged; missing country never uses host country', () => {
  const $ = load(read('main-569'));
  const row = $('tr[data-rank]').first(); row.attr('data-name', '渡辺 圭陽'); row.find('a[href^="/players/"]').first().text('渡辺 圭陽');
  row.removeAttr('data-country'); row.find('td').eq(2).empty();
  const data = parseMainTournament($.html(), 'https://limitlesstcg.com/tournaments/569');
  assert.equal(data.results[0].name, '渡辺 圭陽'); assert.equal(data.results[0].country, null);
  assert.equal(data.country, 'JP'); assert.equal(data.format, null);
});
test('Main archetype variants and unavailable lists remain distinct', () => {
  const $ = load(read('main-567')); $('tr[data-rank]').first().find('a[href^="/decks/list/"]').remove();
  const data = mapMainTournament(parseMainTournament($.html(), 'https://limitlesstcg.com/tournaments/567'), 'https://limitlesstcg.com/tournaments/567', timestamp);
  assert.equal(data.entries[0].decklistAvailable, false); assert.equal(data.entries[0].deck?.archetype?.externalId, '284');
  assert.equal(data.entries[1].deck?.archetype?.externalId, '284:variant=3');
});
test('profiles and explicit results page expose bounded public finishes without claiming complete careers', () => {
  for (const key of ['profile-15369', 'profile-7427', 'profile-7427-results']) {
    const id = key.includes('15369') ? '15369' : '7427';
    const history = parseMainPlayerHistory(read(key), `https://limitlesstcg.com/players/${id}${key.endsWith('-results') ? '/results' : ''}`);
    assert.ok(history.finishes.length >= 1); assert.equal(history.completeHistoryClaimed, false);
    assert.ok(history.finishes.some(finish => finish.tournamentExternalId === (id === '15369' ? '569' : '567')));
    assert.ok(history.finishes[0].decklistUrl);
  }
});
test('calendar dates preserve start days without invented timezones', () => {
  assert.equal(publicEventDate('August 28–30, 2026'), '2026-08-28');
  assert.equal(publicEventDate('20th September 2026'), '2026-09-20');
  assert.equal(publicEventDate('February 30, 2026'), null);
  assert.equal(publicEventDate('December 31–January 2, 2026'), null);
});
test('actual Worlds source representations produce only a duplicate candidate, never shared identity', () => {
  const main = mapMainTournament(parseMainTournament(read('main-world-observation'), 'https://limitlesstcg.com/tournaments/515', read('main-index')), 'https://limitlesstcg.com/tournaments/515', timestamp);
  const labs = mapTournament(parseTournament(read('labs-0071'), 'https://labs.limitlesstcg.com/0071/standings'), 'https://labs.limitlesstcg.com/0071/standings', timestamp);
  assert.ok(eventDuplicateSignals({ ...main.tournament, ...main.tournament.reference }, { ...labs.tournament, ...labs.tournament.reference }).length);
  assert.equal(main.entries[0].player.normalizedName, labs.entries[0].player.normalizedName);
  assert.equal(sameSourceIdentity(main.entries[0].player, labs.entries[0].player), false);
  assert.deepEqual(eventDuplicateSignals({ ...main.tournament, ...main.tournament.reference }, { ...labs.tournament, ...labs.tournament.reference, country: 'JP' }), []);
});
test('Main adapter binds lists to explicitly retrieved tournament entries and retains capture timestamps', async () => {
  const urls: string[] = [];
  const adapter = new LimitlessMainSource(async url => {
    urls.push(url);
    return { html: read(url === 'https://limitlesstcg.com/tournaments' ? 'main-index' : url.includes('/decks/list/') ? 'main-569-list' : 'main-569'), sourceUrl: url, lastSyncedAt: timestamp };
  });
  await assert.rejects(adapter.loadDecklist('https://limitlesstcg.com/decks/list/29453', '569', '15369'), /explicit Main tournament/);
  const snapshot = await adapter.loadTournament('https://limitlesstcg.com/tournaments/569');
  const list = await adapter.loadDecklist(snapshot.entries[0].deck!.decklistUrl!, '569', '15369');
  assert.equal(list.reference.externalId, '29453'); assert.equal(list.reference.lastSyncedAt, timestamp);
  assert.equal(urls.length, 3);
});
test('public Main client caches and rejects account/auth paths before fetch', async () => {
  let requests = 0;
  const client = createMainClient(async () => { requests++; return new Response(read('main-569'), { headers: { 'content-type': 'text/html' } }); });
  await client('https://limitlesstcg.com/tournaments/569'); await client('https://limitlesstcg.com/tournaments/569');
  await assert.rejects(client('https://account.limitlesstcg.com/login'), /public Main/);
  await assert.rejects(client('https://limitlesstcg.com/tournaments/569?private=yes'), /public Main/);
  assert.equal(requests, 1);
});
test('malformed source HTML and invalid quantities fail visibly', () => {
  assert.throws(() => parseMainTournament('<html></html>', 'https://limitlesstcg.com/tournaments/569'), /header/);
  assert.throws(() => parseMainTournament(read('main-569'), 'https://play.limitlesstcg.com/tournaments/569'));
  const $ = load(read('main-569-list')); $('.card-count').first().text('0');
  assert.throws(() => parseMainDecklist($.html()));
});
