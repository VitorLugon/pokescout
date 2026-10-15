import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseLabsCatalog, parseMainCatalog, publicLabsDivisions } from '../src/catalog.js';
import { validateCatalog } from '../../application/src/catalog-import.js';
import {parseTournament} from '../src/limitless-labs/parser.js';
import {mapTournament} from '../src/limitless-labs/mapper.js';
import {parseMainTournament} from '../src/limitless-main/parser.js';
import {mapMainTournament} from '../src/limitless-main/mapper.js';
import {eventDuplicateSignals} from '../../application/src/source-duplicates.js';
const page = async (name: string, url: string) => ({ html: await readFile(new URL(`./fixtures/catalog/${name}.html`, import.meta.url),'utf8'), sourceUrl: url, lastSyncedAt: '2026-10-14T22:00:00Z' });
test('public catalog fixtures preserve explicit links, source IDs, seasons and regional formats', async () => {
  const labs = parseLabsCatalog(await page('labs','https://labs.limitlesstcg.com/'));
  assert.equal(labs.length,76); assert.equal(labs[0].externalId,'0076'); assert.equal(labs[0].season,2027); assert.equal(labs[0].country,'US');
  assert.deepEqual([...new Set(labs.map(row=>row.season))],[2027,2026,2025]);
  const main = parseMainCatalog(await page('main','https://limitlesstcg.com/tournaments'));
  assert.equal(main.currentPage,1); assert.equal(main.maxPage,22); assert.equal(main.events.length,25);
  assert.equal(main.events.find(event=>event.externalId==='569')?.format,'standard-jp');
  assert.equal(validateCatalog(labs).length,76);
  assert.throws(()=>validateCatalog([...labs,labs[0]]),/Duplicate/);
  assert.throws(()=>validateCatalog([{...labs[0],sourceUrl:'https://example.org/0076/standings'}]));
});
test('catalog parsing fails closed and division discovery follows only explicit same-event links', () => {
  assert.throws(()=>parseLabsCatalog({html:'<main>changed</main>',sourceUrl:'https://labs.limitlesstcg.com/',lastSyncedAt:'now'}));
  assert.deepEqual(publicLabsDivisions({html:'<a href="/0076/SR/standings">SR</a><a href="/0076/JR/standings">JR</a><a href="/other/JR/standings">Other</a>',sourceUrl:'https://labs.limitlesstcg.com/0076/standings',lastSyncedAt:'2026-10-14T22:00:00Z'}),['https://labs.limitlesstcg.com/0076/SR/standings','https://labs.limitlesstcg.com/0076/JR/standings']);
});

test('advertised but empty public division keeps unknown coverage and participant count',async()=>{
  const url='https://labs.limitlesstcg.com/0067/SR/standings';
  const fixture=await page('labs-empty-division',url);
  const snapshot=mapTournament(parseTournament(fixture.html,url),url,fixture.lastSyncedAt);
  assert.equal(snapshot.tournament.division,'SR');assert.equal(snapshot.tournament.resultsCoverage,'UNKNOWN');
  assert.equal(snapshot.tournament.reportedPlayerCount,null);assert.equal(snapshot.entries.length,0);
  assert.equal(snapshot.tournament.raw?.publicResultsEmpty,true);
  assert.equal(snapshot.tournament.upstreamIds.playlatam,'LIM26-TCG-MA');
});

test('explicit Main→Labs link identifies a possible overlap despite different published start dates',async()=>{
  // The sanitized fixture intentionally retains only three representative public rows.
  const fixture=await page('main-overlap','https://limitlesstcg.com/tournaments/581');
  const main=mapMainTournament(parseMainTournament(fixture.html,fixture.sourceUrl),fixture.sourceUrl,fixture.lastSyncedAt);
  assert.equal(main.tournament.eventDate,'2026-10-10');assert.equal(main.tournament.reportedPlayerCount,2927);
  assert.equal(main.tournament.resultsCoverage,'PUBLISHED_RESULTS');assert.equal(main.entries.length,3);
  const labs=(await page('labs','https://labs.limitlesstcg.com/'));const event=parseLabsCatalog(labs).find(row=>row.externalId==='0076')!;
  assert.deepEqual(eventDuplicateSignals({...main.tournament,...main.tournament.reference},{...event,eventDate:'2026-10-09'}),['explicit-public-source-link']);
});

test('conflicting repetitions of a Main profile retain every source row in quarantine instead of inventing identities',async()=>{
  const fixture=await page('main-conflicting-profile','https://limitlesstcg.com/tournaments/520');
  const parsed=parseMainTournament(fixture.html,fixture.sourceUrl);
  assert.equal(parsed.publishedResultCount,4);assert.equal(parsed.results.length,2);assert.equal(parsed.quarantinedResults.length,2);
  assert.deepEqual(parsed.quarantinedResults.map(row=>row.playerId),['8549','8549']);
  assert.deepEqual(parsed.quarantinedResults.map(row=>row.placement),[101,259]);
  assert.ok(parsed.quarantinedResults.every(row=>row.name==='Manuel V Zuñiga'));
  const snapshot=mapMainTournament(parsed,fixture.sourceUrl,fixture.lastSyncedAt);
  assert.equal(snapshot.entries.length,2);assert.ok(snapshot.entries.every(row=>row.player.reference.externalId!=='8549'));
  assert.equal(snapshot.tournament.raw?.quarantinedResultCount,2);
  assert.deepEqual(snapshot.tournament.raw?.quarantinedResults,parsed.quarantinedResults);
});

test('a public platform flag remains source metadata rather than becoming an invented host country',async()=>{
  const fixture=await page('main-platform-label','https://limitlesstcg.com/tournaments/295');
  const parsed=parseMainTournament(fixture.html,fixture.sourceUrl);
  assert.equal(parsed.locationLabel,'ptcgo');assert.equal(parsed.country,null);
  const snapshot=mapMainTournament(parsed,fixture.sourceUrl,fixture.lastSyncedAt);
  assert.equal(snapshot.tournament.country,null);assert.equal(snapshot.tournament.raw?.eventLocationLabel,'ptcgo');
  assert.equal(snapshot.tournament.resultsCoverage,'PUBLISHED_RESULTS');assert.equal(snapshot.entries.length,2);
  assert.deepEqual(snapshot.entries.map(entry=>entry.country),parsed.results.map(row=>row.country));
});

test('Labs snapshot with a reported count gap never claims complete standings',async()=>{
  const url='https://labs.limitlesstcg.com/0052/JR/standings';const fixture=await page('labs-count-gap',url);
  const snapshot=mapTournament(parseTournament(fixture.html,url),url,fixture.lastSyncedAt);
  assert.equal(snapshot.tournament.reportedPlayerCount,63);assert.equal(snapshot.entries.length,62);
  assert.equal(snapshot.tournament.resultsCoverage,'UNKNOWN');assert.equal(snapshot.tournament.raw?.sourceReportedCountMismatch,true);
});
