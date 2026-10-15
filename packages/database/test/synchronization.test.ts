import { buildApp } from '../../../apps/api/src/app.js';
import { IdentityReviewService } from '../../application/src/identity-review.js';
import { DuplicateQueryService } from '../../application/src/duplicate-query.js';
import { ScoutingQueryService } from '../../application/src/scouting-query.js';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createDatabase, type PrismaClient } from '../src/index.js';
import { TournamentSyncService, ScoutQueryService } from '../../application/src/index.js';
import { CatalogImportService } from '../../application/src/catalog-import.js';
import type { CatalogEvent } from '../../data-sources/src/catalog.js';
import { saveDecklist, json } from '../../application/src/persistence.js';
import { repairTournamentDates } from '../../application/src/tournament-dates.js';
import { parseTournament, parseDecklist } from '../../data-sources/src/limitless-labs/parser.js';
import { mapTournament, mapDeckCards } from '../../data-sources/src/limitless-labs/mapper.js';
import {parseMainTournament} from '../../data-sources/src/limitless-main/parser.js';
import {mapMainTournament} from '../../data-sources/src/limitless-main/mapper.js';
import type { TournamentSnapshot, DecklistDataSource } from '../../shared/src/index.js';
const fixture = (name: string) => readFileSync(resolve('packages/data-sources/test/fixtures', name), 'utf8');
const manifest = JSON.parse(fixture('manifest.json')) as { sourceUrl: string; decklistUrl: string; retrievedAt: string };
const base = mapTournament(parseTournament(fixture('standings.html'), manifest.sourceUrl), manifest.sourceUrl, manifest.retrievedAt);
const cards = mapDeckCards(parseDecklist(fixture('decklist.html'), '0009', '0509'));
let admin: PrismaClient, db: PrismaClient;
const schema = `scout_test_${randomUUID().replaceAll('-', '')}`;
before(() => {
  admin = createDatabase(); // Loads ignored .env, never prints credentials.
  const url = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!);
  url.searchParams.set('schema', schema);
  try {
    execFileSync(process.execPath, [resolve('packages/database/node_modules/prisma/build/index.js'), 'migrate', 'deploy', '--config', resolve('packages/database/prisma.config.ts')], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe', timeout: 90000 });
  } catch { throw new Error('Test database/migrations unavailable. Run pnpm db:up and pnpm db:migrate.'); }
  db = createDatabase(url.toString());
});
after(async () => {
  await db?.$disconnect();
  if (admin) {
    // Identifier is generated exclusively from UUID hex; never from user input.
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  }
});
beforeEach(async () => {
  await db.identityReview.deleteMany(); await db.decklistReview.deleteMany();
  await db.deckCard.deleteMany(); await db.deck.deleteMany(); await db.tournamentEntry.deleteMany();
  await db.playerAlias.deleteMany(); await db.sourceIdentity.deleteMany(); await db.player.deleteMany();
  await db.syncRun.deleteMany(); await db.tournament.deleteMany();
});
function sample(): TournamentSnapshot {
  const snapshot = structuredClone(base);
  snapshot.entries = [snapshot.entries[0]];
  snapshot.tournament.reportedPlayerCount = 1;
  // A deliberately complete one-entry synthetic source, independent of the
  // representative HTML fixture's original participant counter.
  snapshot.tournament.resultsCoverage = 'COMPLETE_STANDINGS';
  snapshot.tournament.raw = {...snapshot.tournament.raw,players:1,publicResultsEmpty:false,sourceReportedCountMismatch:false};
  return snapshot;
}
function source(snapshot: TournamentSnapshot, fail = false): DecklistDataSource {
  return { async loadTournament() { return structuredClone(snapshot); }, async loadDecklist(url) {
    if (fail) throw new Error('Public decklist extraction failed');
    return { cards: structuredClone(cards), reference: { ...snapshot.entries[0].deck!.reference, sourceUrl: url } };
  } };
}
async function ingest(snapshot = sample(), fail = false) {
  return new TournamentSyncService(db, source(snapshot, fail)).sync({ url: snapshot.tournament.reference.sourceUrl, expectedDeckSize: 60 });
}

test('catalog import resumes from complete standings, preserves lists and stops on source failure', async () => {
  const snapshot=sample(); let calls=0;
  const adapter=source(snapshot); const original=adapter.loadTournament;
  adapter.loadTournament=async url=>{calls++;if(url!==snapshot.tournament.reference.sourceUrl)throw Error('HTTP 429; stop');return original(url);};
  const service=new CatalogImportService(db,{'limitless-labs':adapter});
  const event:CatalogEvent={source:'limitless-labs',externalId:'0009',division:'MA',name:snapshot.tournament.name,dateLabel:snapshot.tournament.dateLabel,country:'BR',season:2026,format:'STANDARD',sourceUrl:snapshot.tournament.reference.sourceUrl,catalogUrl:'https://labs.limitlesstcg.com/',discoveredAt:manifest.retrievedAt};
  assert.equal((await service.preview([event])).pending.length,1);assert.equal(calls,0);
  assert.equal((await service.apply([event],1,undefined,()=>true)).processed,0);assert.equal(calls,0);
  assert.equal((await service.apply([event],1)).stoppedOnError,false);
  assert.equal((await service.apply([event],1)).processed,0);assert.equal(calls,1);
  const before=await db.tournamentEntry.findMany();
  const more=[{...event,externalId:'0010',sourceUrl:'https://labs.limitlesstcg.com/0010/standings'},{...event,externalId:'0011',sourceUrl:'https://labs.limitlesstcg.com/0011/standings'}];
  assert.deepEqual(await service.apply(more,2),{processed:1,stoppedOnError:true});assert.equal(calls,2);
  assert.deepEqual(await db.tournamentEntry.findMany(),before);
  const catalog=await new ScoutQueryService(db).tournamentCatalog(1,0);assert.equal(catalog.total,1);assert.equal(catalog.events[0].entriesCount,1);
  assert.ok(!JSON.stringify(catalog).includes('"raw"'));assert.equal((await new ScoutQueryService(db).tournamentCatalog(1,1)).events.length,0);
});

test('bounded concurrent entry writes retain valid rows and make entry failures visible',async()=>{
  const snapshot=structuredClone(base);snapshot.entries=snapshot.entries.slice(0,4);snapshot.tournament.reportedPlayerCount=4;
  snapshot.entries[1].player.originalName='';
  const run=await new TournamentSyncService(db,source(snapshot)).sync({url:snapshot.tournament.reference.sourceUrl,maxDecklists:0,entryConcurrency:4});
  assert.equal(run.status,'PARTIAL');assert.equal(run.entriesReceived,4);assert.equal(run.entriesSaved,3);
  assert.equal(await db.tournamentEntry.count(),3);assert.ok((run.issues as {stage:string}[]).some(issue=>issue.stage==='entry'));
  await assert.rejects(new TournamentSyncService(db,source(snapshot)).sync({url:snapshot.tournament.reference.sourceUrl,entryConcurrency:5}),/concurrency/);
});

test('empty public division is persisted as unknown and resumes without repeated retrieval',async()=>{
  const snapshot=sample();snapshot.entries=[];snapshot.tournament.resultsCoverage='UNKNOWN';snapshot.tournament.reportedPlayerCount=null;
  let reads=0;const adapter=source(snapshot);const load=adapter.loadTournament;adapter.loadTournament=async url=>{reads++;return load(url);};
  const service=new CatalogImportService(db,{'limitless-labs':adapter});
  const event:CatalogEvent={source:'limitless-labs',externalId:'0009',division:'MA',name:snapshot.tournament.name,dateLabel:snapshot.tournament.dateLabel,country:null,season:2025,format:null,sourceUrl:snapshot.tournament.reference.sourceUrl,catalogUrl:'https://labs.limitlesstcg.com/',discoveredAt:manifest.retrievedAt};
  assert.equal((await service.apply([event],1)).stoppedOnError,false);assert.equal((await service.apply([event],1)).processed,0);
  assert.equal(reads,1);assert.equal(await db.tournamentEntry.count(),0);
  const saved=await db.tournament.findFirstOrThrow();assert.equal(saved.resultsCoverage,'UNKNOWN');assert.equal(saved.reportedPlayerCount,null);assert.equal(saved.fullySynchronized,false);
});

test('source profile conflicts persist for review without extra player histories and reimport stays idempotent',async()=>{
  const url='https://limitlesstcg.com/tournaments/520';
  const snapshot=mapMainTournament(parseMainTournament(fixture('catalog/main-conflicting-profile.html'),url),url,manifest.retrievedAt);
  const sync=new TournamentSyncService(db,source(snapshot));
  const run=await sync.sync({url,maxDecklists:0});assert.equal(run.status,'PARTIAL');assert.equal(run.entriesSaved,2);
  assert.ok((run.issues as {stage:string}[]).some(issue=>issue.stage==='source-quality'));
  assert.equal(await db.sourceIdentity.count({where:{source:'limitless-main',externalId:'8549'}}),0);
  const raw=(await db.tournament.findFirstOrThrow()).raw as {quarantinedResults:{name:string;playerId:string}[]};
  assert.equal(raw.quarantinedResults.length,2);assert.equal(raw.quarantinedResults[0].name,'Manuel V Zuñiga');
  const ids=(await db.tournamentEntry.findMany({orderBy:{id:'asc'}})).map(row=>row.id);
  await sync.sync({url,maxDecklists:0});assert.deepEqual((await db.tournamentEntry.findMany({orderBy:{id:'asc'}})).map(row=>row.id),ids);
  assert.equal(await db.player.count(),2);assert.equal(await db.tournamentEntry.count(),2);
  const catalog=await new ScoutQueryService(db).tournamentCatalog();assert.equal(catalog.events[0].quarantinedResultCount,2);assert.ok(!JSON.stringify(catalog).includes('"raw"'));
});

test('history pagination uses published calendar dates instead of assuming Main IDs are chronological',async()=>{
  const url='https://limitlesstcg.com/tournaments/520';
  const base=mapMainTournament(parseMainTournament(fixture('catalog/main-conflicting-profile.html'),url),url,manifest.retrievedAt);
  for(const [id,date] of [['9999','2010-08-14'],['1000','2026-10-10']]){
    const snapshot=structuredClone(base);snapshot.entries=snapshot.entries.slice(0,1);
    snapshot.tournament.reference.externalId=id;snapshot.tournament.reference.sourceUrl=`https://limitlesstcg.com/tournaments/${id}`;
    snapshot.tournament.eventDate=date;snapshot.tournament.reportedPlayerCount=1;
    snapshot.entries[0].tournamentExternalId=id;snapshot.entries[0].reference.sourceUrl=snapshot.tournament.reference.sourceUrl;
    snapshot.entries[0].decklistAvailable=false;snapshot.entries[0].deck=null;
    await new TournamentSyncService(db,source(snapshot)).sync({url:snapshot.tournament.reference.sourceUrl,maxDecklists:0});
  }
  const player=await db.player.findFirstOrThrow();const service=new ScoutQueryService(db);
  assert.equal((await service.playerHistory(player.id,1,0)).entries[0].tournament.externalId,'1000');
  assert.equal((await service.playerHistory(player.id,1,1)).entries[0].tournament.externalId,'9999');
});

test('legacy date repair restores recent history and period evidence without changing source data', async () => {
  for (const [id, label] of [['0009', 'November 15–17, 2024'], ['0010', 'October 3–4, 2026'], ['0011', 'Date unavailable'], ['0012', 'December 31–January 2, 2026']]) {
    const snapshot = sample();
    snapshot.tournament.reference.externalId = id;
    snapshot.tournament.reference.sourceUrl = `https://labs.limitlesstcg.com/${id}/standings`;
    snapshot.tournament.dateLabel = label;
    snapshot.tournament.eventDate = null;
    snapshot.entries[0].tournamentExternalId = id;
    await new TournamentSyncService(db, source(snapshot)).sync({ url: snapshot.tournament.reference.sourceUrl, maxDecklists: 0 });
  }
  // The sync fallback also handles older adapters that omit the calendar field.
  assert.equal((await db.tournament.findFirstOrThrow({where:{externalId:'0010'}})).eventDate, '2026-10-03');
  // Simulate rows imported before calendar dates were introduced.
  await db.tournament.updateMany({where:{externalId:'0010'},data:{eventDate:null}});
  const before = await db.tournament.findMany({orderBy:{id:'asc'}});
  const entriesBefore = await db.tournamentEntry.findMany({orderBy:{id:'asc'}});
  const decksBefore = await db.deck.findMany({orderBy:{id:'asc'}});
  const preview = await repairTournamentDates(db);
  assert.equal(preview.candidates.length, 1); assert.equal(preview.updated, 0); assert.equal(preview.unresolved, 2);
  assert.deepEqual(await db.tournament.findMany({orderBy:{id:'asc'}}), before);
  assert.equal((await repairTournamentDates(db, true)).updated, 1);
  assert.equal((await repairTournamentDates(db, true)).updated, 0);
  const after = await db.tournament.findMany({orderBy:{id:'asc'}});
  assert.deepEqual(after.map(({eventDate,...row})=>row), before.map(({eventDate,...row})=>row));
  assert.deepEqual(await db.tournamentEntry.findMany({orderBy:{id:'asc'}}), entriesBefore);
  assert.deepEqual(await db.deck.findMany({orderBy:{id:'asc'}}), decksBefore);
  const player = await db.player.findFirstOrThrow();
  assert.equal((await new ScoutQueryService(db).playerHistory(player.id,1)).entries[0].tournament.externalId,'0010');
  const evidence = await new ScoutingQueryService(db).evidence(player.id,{from:'2026-10-01',to:'2026-10-31',scope:'matched'});
  assert.equal(evidence.total,1); assert.equal(evidence.entries[0].tournament.eventDate,'2026-10-03');
});

test('combined name history paginates groups, preserves source rows and obeys different-person reviews',async()=>{
  const labs=sample();labs.entries[0].player.originalName='João 山田';
  labs.tournament.name='Regional Recife';labs.tournament.country='BR';labs.tournament.eventDate='2026-10-03';
  labs.tournament.dateLabel='October 3–4, 2026';
  await new TournamentSyncService(db,source(labs)).sync({url:labs.tournament.reference.sourceUrl,maxDecklists:0});
  const main=mapMainTournament(parseMainTournament(fixture('catalog/main-conflicting-profile.html'),'https://limitlesstcg.com/tournaments/520'),'https://limitlesstcg.com/tournaments/520',manifest.retrievedAt);
  main.entries=main.entries.slice(0,2);main.entries[0].player.originalName='JOÃO 山田';
  main.entries[0].placement=labs.entries[0].placement;main.tournament.name='Regional Recife';
  main.tournament.country='BR';main.tournament.eventDate='2026-10-03';main.tournament.dateLabel='3rd October 2026';
  await new TournamentSyncService(db,source(main)).sync({url:main.tournament.reference.sourceUrl,maxDecklists:0});
  const labPlayer=await db.sourceIdentity.findFirstOrThrow({where:{source:'limitless-labs'}});
  const mainPlayer=await db.sourceIdentity.findFirstOrThrow({where:{source:'limitless-main',externalId:main.entries[0].player.reference.externalId}});
  assert.equal(await db.resultDuplicateCandidate.count(),1);
  const older=structuredClone(labs);older.tournament.reference.externalId='0010';older.tournament.reference.sourceUrl='https://labs.limitlesstcg.com/0010/standings';
  older.tournament.eventDate='2025-03-08';older.tournament.dateLabel='March 8–9, 2025';older.entries[0].tournamentExternalId='0010';
  await new TournamentSyncService(db,source(older)).sync({url:older.tournament.reference.sourceUrl,maxDecklists:0});
  // Same broad search key, but accent-stripped names must not enter automatically.
  await db.player.create({data:{displayName:'Joao 山田',aliases:{create:{originalName:'Joao 山田',normalizedName:'joao 山田',searchKey:'joao 山田',source:'limitless-main',sourceUrl:main.tournament.reference.sourceUrl,lastSyncedAt:new Date(manifest.retrievedAt)}},identities:{create:{source:'limitless-main',scope:'global',externalId:'accent-candidate',sourceUrl:main.tournament.reference.sourceUrl,lastSyncedAt:new Date(manifest.retrievedAt)}}}});
  const before=await db.tournamentEntry.findMany({orderBy:{id:'asc'}});const identities=await db.sourceIdentity.findMany({orderBy:{id:'asc'}});
  const service=new ScoutQueryService(db);const first=await service.combinedHistory(labPlayer.playerId,1,0);
  assert.equal(first.total,2);assert.equal(first.combination?.sourceResultCount,3);assert.equal(first.combination?.members.length,2);
  assert.equal(first.combination?.confirmedSamePerson,false);assert.equal(first.confirmedParticipationCount,null);
  assert.equal(first.entries[0].tournament.source,'limitless-labs');assert.equal(first.entries[0].otherSources?.[0].tournament.source,'limitless-main');
  assert.equal(first.entries[0].originalName,'João 山田');assert.equal(first.entries[0].otherSources?.[0].originalName,'JOÃO 山田');
  assert.equal(first.truncated,true);assert.equal((await service.combinedHistory(labPlayer.playerId,1,1)).truncated,false);
  assert.equal((await service.combinedHistory(mainPlayer.playerId)).combination?.sourceResultCount,3);
  assert.equal((await service.playerHistory(labPlayer.playerId)).total,2);
  const preferred=await service.preferredSearch('joao 山田');
  assert.equal(preferred.matches.length,2); // accented pair + independent unaccented candidate
  assert.equal(preferred.matches.find(player=>player.id===labPlayer.playerId)?.alternativeMatches[0].id,mainPlayer.playerId);
  const catalog=await service.preferredTournamentCatalog(1,0);
  assert.equal(catalog.total,2);assert.equal(catalog.presentation?.sourceRecordCount,3);
  assert.ok(!JSON.stringify(catalog).includes('"raw"'));assert.ok(!JSON.stringify(catalog).includes('"tournament":'));
  assert.equal(catalog.events[0].source,'limitless-labs');assert.equal(catalog.events[0].otherSources?.[0].source,'limitless-main');
  assert.equal(catalog.events[0].otherSources?.[0].entriesCount,2); // includes Main-only player result
  assert.equal((await service.preferredTournamentCatalog(1,1)).truncated,false);
  assert.equal((await service.tournamentCatalog()).total,3);
  assert.deepEqual(await db.tournamentEntry.findMany({orderBy:{id:'asc'}}),before);
  assert.deepEqual(await db.sourceIdentity.findMany({orderBy:{id:'asc'}}),identities);
  const [playerAId,playerBId]=[labPlayer.playerId,mainPlayer.playerId].sort();
  await db.identityReview.create({data:{playerAId,playerBId,decision:'DIFFERENT_PEOPLE',reviewer:'fixture',reason:'Synthetic contrary evidence',evidenceUrls:[],evidence:{}}});
  assert.equal((await service.combinedHistory(labPlayer.playerId)).combination?.members.length,1);
  assert.equal((await service.preferredSearch('joao 山田')).matches.length,3);
  await assert.rejects(service.combinedHistory(randomUUID()),/Player not found/);
});

test('unchanged ingestion is idempotent, including cards and imported timestamps', async () => {
  assert.equal((await ingest()).status, 'SUCCESS');
  const first = await db.deck.findFirstOrThrow();
  const cardIds = (await db.deckCard.findMany({ orderBy: { position: 'asc' } })).map(card => card.id);
  assert.equal((await ingest()).status, 'SUCCESS');
  assert.equal(await db.tournament.count(), 1); assert.equal(await db.player.count(), 1);
  assert.equal(await db.sourceIdentity.count(), 1); assert.equal(await db.tournamentEntry.count(), 1);
  assert.equal(await db.deck.count(), 1); assert.equal(await db.deckCard.count(), 26);
  assert.deepEqual((await db.deckCard.findMany({ orderBy: { position: 'asc' } })).map(card => card.id), cardIds);
  assert.equal((await db.deck.findFirstOrThrow()).listImportedAt?.toISOString(), first.listImportedAt?.toISOString());
  assert.equal(await db.syncRun.count(), 2);
  assert.equal((await db.tournament.findFirstOrThrow()).fullySynchronized, true);
});

test('repeated source identity across events keeps one player and preserves name aliases/history', async () => {
  const a = sample(); await ingest(a);
  const b = sample();
  b.tournament.reference.externalId = '9998'; b.tournament.reference.sourceUrl = 'https://labs.limitlesstcg.com/9998/standings';
  b.entries[0].tournamentExternalId = '9998'; b.entries[0].tournamentPlayerId = '88';
  b.entries[0].player.originalName = 'Miloslav Posledni';
  b.entries[0].decklistAvailable = false; b.entries[0].deck = null;
  assert.equal((await ingest(b)).status, 'SUCCESS');
  assert.equal(await db.player.count(), 1); assert.equal(await db.playerAlias.count(), 2);
  const player = await db.player.findFirstOrThrow();
  const history = await new ScoutQueryService(db).playerHistory(player.id);
  assert.equal(history.entries.length, 2);
});

test('same normalized name with different source IDs stays separate and exposes review candidates', async () => {
  const snapshot = sample(); const duplicate = structuredClone(snapshot.entries[0]);
  snapshot.entries[0].player.originalName = 'João Pedro'; duplicate.player.originalName = 'JOAO PEDRO';
  duplicate.player.reference.externalId = '987654'; duplicate.tournamentPlayerId = '999';
  duplicate.decklistAvailable = false; duplicate.deck = null;
  snapshot.entries.push(duplicate); snapshot.tournament.reportedPlayerCount = 2;
  await ingest(snapshot);
  const result = await new ScoutQueryService(db).searchPlayers('joao pedro');
  assert.equal(result.matches.length, 2);
  assert.ok(result.matches.every(match => match.possibleMatchIds.length === 1));
  assert.equal(await db.player.count(), 2);
});

test('missing source fields preserve previously valid country, placement, archetype and list', async () => {
  await ingest(); const changed = sample();
  changed.entries[0].country = null; changed.entries[0].placement = null;
  changed.entries[0].decklistAvailable = false; changed.entries[0].deck = null;
  await ingest(changed);
  const entry = await db.tournamentEntry.findFirstOrThrow({ include: { deck: { include: { cards: true } } } });
  assert.equal(entry.country, 'CZ'); assert.equal(entry.placement, 1);
  assert.equal(entry.deck?.archetypeName, 'Regidrago'); assert.equal(entry.deck?.cards.length, 26);
  assert.equal(entry.deck?.availableAtSource, false); assert.equal(entry.deck?.listStatus, 'IMPORTED');
});

test('unavailable decklist is distinct from known archetype and extraction failure', async () => {
  const snapshot = sample(); snapshot.entries[0].decklistAvailable = false; snapshot.entries[0].deck!.decklistUrl = null;
  assert.equal((await ingest(snapshot)).status, 'SUCCESS');
  const deck = await db.deck.findFirstOrThrow();
  assert.equal(deck.archetypeName, 'Regidrago'); assert.equal(deck.listStatus, 'UNAVAILABLE');
  assert.equal(await db.deckCard.count(), 0);
});

test('decklist failure yields partial run; valid entries remain and a later retry succeeds', async () => {
  const run = await ingest(sample(), true);
  assert.equal(run.status, 'PARTIAL'); assert.equal(run.entriesSaved, 1);
  assert.equal((await db.deck.findFirstOrThrow()).listStatus, 'FAILED');
  assert.equal((await db.tournament.findFirstOrThrow()).fullySynchronized, false);
  assert.equal((await ingest()).status, 'SUCCESS');
  assert.equal((await db.deck.findFirstOrThrow()).lastListError, null);
});

test('bounded imports and incomplete standings are partial, never falsely complete', async () => {
  const snapshot = sample(); snapshot.tournament.reportedPlayerCount = 2;
  const run = await new TournamentSyncService(db, source(snapshot)).sync({ url: manifest.sourceUrl, maxDecklists: 0 });
  assert.equal(run.status, 'PARTIAL'); assert.equal(run.pendingLists, 1);
  assert.equal(run.entriesSaved, 1); assert.equal((await db.tournament.findFirstOrThrow()).fullySynchronized, false);
});

test('invalid entry does not roll back other valid entries', async () => {
  const snapshot = sample(); const invalid = structuredClone(snapshot.entries[0]);
  invalid.tournamentPlayerId = '999'; invalid.record.wins = -1;
  snapshot.entries.push(invalid); snapshot.tournament.reportedPlayerCount = 2;
  const run = await ingest(snapshot);
  assert.equal(run.status, 'PARTIAL'); assert.equal(run.entriesSaved, 1);
  assert.equal(await db.tournamentEntry.count(), 1);
});

test('retrieval failure is recorded without changing existing valid data', async () => {
  await ingest();
  const adapter = source(sample()); adapter.loadTournament = async () => { throw new Error('Labs HTTP 503'); };
  const run = await new TournamentSyncService(db, adapter).sync({ url: manifest.sourceUrl });
  assert.equal(run.status, 'FAILED'); assert.equal(await db.deckCard.count(), 26);
  assert.ok(run.tournamentId);
  assert.equal((await db.tournament.findFirstOrThrow()).fullySynchronized, false);
  assert.equal((await new ScoutQueryService(db).listTournaments())[0].syncRuns[0].status, 'FAILED');
});

test('constraints enforce foreign keys, unique identities/entries/cards, and positive quantities', async () => {
  await ingest();
  const identity = await db.sourceIdentity.findFirstOrThrow();
  await assert.rejects(db.sourceIdentity.create({ data: { ...identity, id: randomUUID() } }));
  const entry = await db.tournamentEntry.findFirstOrThrow();
  await assert.rejects(db.tournamentEntry.create({ data: { ...entry, id: randomUUID(), raw: json(entry.raw) } }));
  const card = await db.deckCard.findFirstOrThrow();
  await assert.rejects(db.deckCard.create({ data: { ...card, id: randomUUID() } }));
  await assert.rejects(db.deckCard.update({ where: { id: card.id }, data: { quantity: 0 } }));
  await assert.rejects(db.sourceIdentity.create({ data: { ...identity, id: randomUUID(), externalId: 'unknown', playerId: randomUUID() } }));
});

test('atomic list replacement rolls back deletes when new cards violate constraints', async () => {
  await ingest(); const deck = await db.deck.findFirstOrThrow();
  await assert.rejects(saveDecklist(db, deck.id, [{ ...cards[0], count: 0 }], {}, new Date()));
  assert.equal(await db.deckCard.count(), 26);
});

test('one RUNNING run per event/division prevents overlapping imports', async () => {
  await db.syncRun.create({ data: { source: 'limitless-labs', externalId: '0009', division: 'MA', sourceUrl: manifest.sourceUrl, issues: [] } });
  await assert.rejects(ingest(), /already RUNNING/);
});

test('query services list tournaments, retrieve known lists, and report missing records', async () => {
  await ingest(); const service = new ScoutQueryService(db);
  assert.equal((await service.listTournaments()).length, 1);
  const entry = await db.tournamentEntry.findFirstOrThrow();
  assert.equal((await service.knownDecklist(entry.id)).cards.length, 26);
  await assert.rejects(service.playerHistory(randomUUID()), /Player not found/);
  await assert.rejects(service.knownDecklist(randomUUID()), /entry not found/);
});

test('wrong-size constructed list is an extraction failure, not a successful import', async () => {
  const snapshot = sample(); const adapter = source(snapshot);
  const loadList = adapter.loadDecklist;
  adapter.loadDecklist = async (...args) => { const result = await loadList(...args); result.cards[0].count--; return result; };
  const run = await new TournamentSyncService(db, adapter).sync({ url: manifest.sourceUrl, format: 'STANDARD' });
  assert.equal(run.status, 'PARTIAL'); assert.equal(run.listsImported, 0);
  assert.equal((await db.deck.findFirstOrThrow()).listStatus, 'FAILED');
  assert.equal(await db.deckCard.count(), 0);
});

test('changed identity on existing entry requires review and rolls back newly created identity', async () => {
  await ingest(); const changed = sample(); changed.entries[0].player.reference.externalId = '987654';
  const run = await ingest(changed);
  assert.equal(run.status, 'PARTIAL'); assert.equal(run.entriesSaved, 0);
  assert.equal(await db.player.count(), 1); assert.equal(await db.sourceIdentity.count(), 1);
  assert.equal(await db.deckCard.count(), 26);
});

test('previously imported entries omitted by a later snapshot are retained and flagged', async () => {
  await ingest(); const changed = sample(); changed.entries = []; changed.tournament.reportedPlayerCount = 0;
  const run = await ingest(changed);
  assert.equal(run.status, 'PARTIAL'); assert.equal(await db.tournamentEntry.count(), 1);
  assert.equal((await db.tournament.findFirstOrThrow()).fullySynchronized, false);
});

test('insufficient global identity evidence creates separate event-scoped players', async () => {
  const a = sample();
  a.entries[0].player.identityScope = 'entry:0009:MA';
  a.entries[0].player.reference.externalId = a.entries[0].tournamentPlayerId;
  await ingest(a);
  const b = structuredClone(a);
  b.tournament.reference.externalId = '9998';
  b.tournament.reference.sourceUrl = 'https://labs.limitlesstcg.com/9998/standings';
  b.entries[0].tournamentExternalId = '9998';
  b.entries[0].reference.sourceUrl = 'https://labs.limitlesstcg.com/9998/player/0509';
  b.entries[0].player.identityScope = 'entry:9998:MA';
  b.entries[0].player.reference.sourceUrl = b.entries[0].reference.sourceUrl;
  b.entries[0].decklistAvailable = false; b.entries[0].deck = null;
  assert.equal((await ingest(b)).status, 'SUCCESS');
  assert.equal(await db.player.count(), 2);
  assert.equal(await db.sourceIdentity.count(), 2);
  const matches = await new ScoutQueryService(db).searchPlayers('miloslav posledni');
  assert.equal(matches.matches.length, 2);
});

// Milestone 3: exercised in the same isolated migrated schema; all original 17 tests remain above.
test('identity assessments retain evidence and never merge players, even SAME_PERSON', async () => {
  const { IdentityReviewService } = await import('../../application/src/index.js');
  const snapshot = sample(), other = structuredClone(snapshot.entries[0]);
  other.tournamentPlayerId = '999'; other.player.reference.externalId = '987654'; other.decklistAvailable = false; other.deck = null;
  snapshot.entries.push(other); snapshot.tournament.reportedPlayerCount = 2; await ingest(snapshot);
  const players = await db.player.findMany({ orderBy: { id: 'asc' } });
  const service = new IdentityReviewService(db);
  const compared = await service.compare(players[1].id, players[0].id);
  assert.equal(compared.sharedNameKeys.length, 1); assert.equal(compared.overlappingTournamentIds.length, 1);
  for (const decision of ['SAME_PERSON', 'DIFFERENT_PEOPLE', 'UNCERTAIN'] as const) {
    await service.record({ playerAId: players[1].id, playerBId: players[0].id, decision, reviewer: 'local reviewer',
      reason: 'Public evidence is insufficient for an automatic merge.', evidenceUrls: [manifest.sourceUrl] });
  }
  assert.equal(await db.identityReview.count(), 3); assert.equal(await db.player.count(), 2);
  assert.equal(await db.sourceIdentity.count(), 2); assert.equal(await db.tournamentEntry.count(), 2);
  assert.equal((await service.compare(players[0].id, players[1].id)).reviews.length, 3);
  await assert.rejects(service.compare(players[0].id, players[0].id), /distinct/);
  await assert.rejects(service.compare(players[0].id, randomUUID()), /not found/);
  await assert.rejects(service.record({ playerAId: players[0].id, playerBId: players[1].id, decision: 'UNCERTAIN', reviewer: '', reason: 'short', evidenceUrls: [] }));
});
test('reconciliation plan is read-only; pending imports are capped and idempotent', async () => {
  const { DecklistReconciliationService } = await import('../../application/src/index.js');
  const snapshot = sample(), other = structuredClone(snapshot.entries[0]);
  other.tournamentPlayerId = '999'; other.player.reference.externalId = '987654';
  other.deck!.reference.externalId = '0009:MA:999'; other.deck!.decklistUrl = 'https://labs.limitlesstcg.com/0009/player/999/decklist';
  snapshot.entries.push(other); snapshot.tournament.reportedPlayerCount = 2;
  await new TournamentSyncService(db, source(snapshot)).sync({ url: manifest.sourceUrl, maxDecklists: 0, expectedDeckSize: 60 });
  const adapter = source(snapshot); let requests = 0;
  adapter.loadTournament = async () => { throw new Error('Reconciliation must not fetch standings'); };
  adapter.loadDecklist = async url => { requests++; const entry = snapshot.entries.find(entry => entry.deck!.decklistUrl === url)!;
    return { cards, reference: { ...entry.deck!.reference, sourceUrl: url } }; };
  const service = new DecklistReconciliationService(db, adapter), tournament = await db.tournament.findFirstOrThrow();
  const runs = await db.syncRun.count();
  assert.equal((await service.plan(tournament.id, 'pending', 1)).eligible, 2);
  assert.equal(requests, 0); assert.equal(await db.syncRun.count(), runs);
  assert.equal((await service.reconcile(tournament.id, 'pending', 1)).status, 'PARTIAL'); assert.equal(requests, 1);
  assert.equal((await service.reconcile(tournament.id, 'pending', 1)).status, 'SUCCESS'); assert.equal(requests, 2);
  await service.reconcile(tournament.id, 'pending', 1); assert.equal(requests, 2);
  assert.equal(await db.decklistReview.count(), 2);
  assert.equal((await db.tournament.findFirstOrThrow()).fullySynchronized, false);
  await assert.rejects(service.plan(tournament.id, 'pending', 21), /1–20/);
  await assert.rejects(service.plan(randomUUID()), /not found/);
});
test('unchanged explicit refresh keeps card IDs and imported timestamp, recording its check', async () => {
  const { DecklistReconciliationService } = await import('../../application/src/index.js');
  await ingest(); const deck = await db.deck.findFirstOrThrow(), tournament = await db.tournament.findFirstOrThrow();
  const before = await db.deckCard.findMany({ orderBy: { position: 'asc' } });
  const adapter = source(sample()); const load = adapter.loadDecklist;
  adapter.loadDecklist = async (...args) => { const result = await load(...args); result.cards.reverse(); return result; };
  assert.equal((await new DecklistReconciliationService(db, adapter).reconcile(tournament.id, 'refresh', 1)).status, 'SUCCESS');
  assert.deepEqual(await db.deckCard.findMany({ orderBy: { position: 'asc' } }), before);
  assert.equal((await db.deck.findFirstOrThrow()).listImportedAt?.toISOString(), deck.listImportedAt?.toISOString());
  assert.equal((await db.decklistReview.findFirstOrThrow()).outcome, 'UNCHANGED');
});
test('changed source list is replaced atomically and previous source printings remain in audit', async () => {
  const { DecklistReconciliationService } = await import('../../application/src/index.js');
  await ingest(); const tournament = await db.tournament.findFirstOrThrow();
  const adapter = source(sample()); const load = adapter.loadDecklist;
  adapter.loadDecklist = async (...args) => { const result = await load(...args); result.cards[0].set = 'CORRECTED'; return result; };
  const run = await new DecklistReconciliationService(db, adapter).reconcile(tournament.id, 'refresh', 1);
  assert.equal(run.listsImported, 1); const review = await db.decklistReview.findFirstOrThrow();
  assert.equal(review.outcome, 'CHANGED'); assert.ok(Array.isArray(review.beforeCards));
  assert.equal((await db.deckCard.findFirstOrThrow({ orderBy: { position: 'asc' } })).setCode, 'CORRECTED');
  assert.equal(await db.player.count(), 1); assert.equal(await db.tournamentEntry.count(), 1);
});
test('failed refresh retains known list and permits explicit retry', async () => {
  const { DecklistReconciliationService } = await import('../../application/src/index.js');
  await ingest(); const tournament = await db.tournament.findFirstOrThrow(), entry = await db.tournamentEntry.findFirstOrThrow();
  const before = await new ScoutQueryService(db).knownDecklist(entry.id);
  const run = await new DecklistReconciliationService(db, source(sample(), true)).reconcile(tournament.id, 'refresh', 1);
  assert.equal(run.status, 'PARTIAL'); const known = await new ScoutQueryService(db).knownDecklist(entry.id);
  assert.deepEqual(known.cards, before.cards); assert.equal(known.listStatus, 'FAILED');
  assert.equal((await db.decklistReview.findFirstOrThrow()).outcome, 'FAILED');
  assert.equal((await new DecklistReconciliationService(db, source(sample())).reconcile(tournament.id, 'refresh', 1)).status, 'SUCCESS');
  assert.equal((await db.deck.findFirstOrThrow()).lastListError, null);
});
test('wrong size and wrong provenance refreshes cannot overwrite valid cards', async () => {
  const { DecklistReconciliationService } = await import('../../application/src/index.js');
  await ingest(); const tournament = await db.tournament.findFirstOrThrow();
  const before = await db.deckCard.findMany({ orderBy: { position: 'asc' } });
  for (const wrong of ['size', 'source', 'timestamp']) {
    const adapter = source(sample()), load = adapter.loadDecklist;
    adapter.loadDecklist = async (...args) => { const result = await load(...args);
      if (wrong === 'size') result.cards[0].count--;
      if (wrong === 'source') result.reference.externalId = 'wrong-entry';
      if (wrong === 'timestamp') result.reference.lastSyncedAt = 'invalid';
      return result;
    };
    assert.equal((await new DecklistReconciliationService(db, adapter).reconcile(tournament.id, 'refresh', 1)).status, 'PARTIAL');
    assert.deepEqual(await db.deckCard.findMany({ orderBy: { position: 'asc' } }), before);
  }
});
test('reconciliation shares RUNNING exclusion with standings imports', async () => {
  const { DecklistReconciliationService } = await import('../../application/src/index.js');
  await ingest(); const tournament = await db.tournament.findFirstOrThrow();
  await db.syncRun.create({ data: { tournamentId: tournament.id, source: tournament.source, externalId: tournament.externalId,
    division: tournament.division, sourceUrl: tournament.sourceUrl, issues: [] } });
  await assert.rejects(new DecklistReconciliationService(db, source(sample())).reconcile(tournament.id, 'refresh', 1), /already RUNNING/);
  assert.equal(await db.decklistReview.count(), 0);
});
test('database-backed API returns bounded history and preserved lists without mutation', async () => {
  const { buildApp } = await import('../../../apps/api/src/app.js');
  const { IdentityReviewService } = await import('../../application/src/index.js');
  await ingest(); const player = await db.player.findFirstOrThrow(), entry = await db.tournamentEntry.findFirstOrThrow();
  const app = buildApp(new ScoutQueryService(db), new IdentityReviewService(db));
  try {
    assert.equal((await app.inject(`/players/${player.id}/history?limit=1`)).json().total, 1);
    assert.equal((await app.inject(`/entries/${entry.id}/decklist`)).json().cards.length, 26);
    assert.equal((await app.inject(`/players/${randomUUID()}/history`)).statusCode, 404);
    assert.equal((await app.inject('/players?name=miloslav')).json().matches.length, 1);
    assert.equal((await app.inject('/tournaments')).json().length, 1);
    assert.equal(await db.syncRun.count(), 1); assert.equal(await db.decklistReview.count(), 0);
  } finally { await app.close(); }
});

// Milestone 3.5: existing 25 PostgreSQL cases above remain intact.
import { LimitlessMainSource } from '../../data-sources/src/limitless-main/index.js';
import { LimitlessLabsSource } from '../../data-sources/src/limitless-labs/index.js';
import { HistoricalExpansionService } from '../../application/src/historical-expansion.js';
const internationalFixture = (key: string) => fixture(`international/${key}.html`);
function mainFixtureSource(id = '569', requested: string[] = []) {
  return new LimitlessMainSource(async url => {
    requested.push(url);
    const key = url === 'https://limitlesstcg.com/tournaments' ? 'main-index' : url.includes('/decks/list/') ? `main-${id}-list` : id === '515' ? 'main-world-observation' : `main-${id}`;
    return { html: internationalFixture(key), sourceUrl: url, lastSyncedAt: manifest.retrievedAt };
  });
}
test('partial Asian results persist unknown fields, original print language and country distinction', async () => {
  const source = mainFixtureSource('567');
  const run = await new TournamentSyncService(db, source).sync({ url: 'https://limitlesstcg.com/tournaments/567', maxDecklists: 1, expectedDeckSize: 60 });
  assert.equal(run.status, 'PARTIAL'); assert.equal(run.entriesSaved, 32); assert.equal(run.listsImported, 1);
  const tournament = await db.tournament.findFirstOrThrow();
  assert.equal(tournament.division, null); assert.equal(tournament.season, null);
  assert.equal(tournament.resultsCoverage, 'PUBLISHED_RESULTS'); assert.equal(tournament.reportedPlayerCount, 645);
  assert.equal(tournament.format, 'standard-jp'); assert.equal(tournament.fullySynchronized, false);
  const visitor = await db.tournamentEntry.findFirstOrThrow({ where: { placement: 13 } });
  assert.equal(visitor.country, 'JP'); assert.equal(tournament.country, 'KR');
  assert.equal(visitor.points, null); assert.equal(visitor.wins, null); assert.equal(visitor.losses, null); assert.equal(visitor.ties, null); assert.equal(visitor.disqualified, null);
  assert.ok((await db.deckCard.findMany()).every(card => card.language === 'en'));
});
test('preview does no source retrieval and cumulative one-list budget makes reimport idempotent', async () => {
  const requests: string[] = [];
  const source = mainFixtureSource('569', requests);
  const expansion = new HistoricalExpansionService(db, { 'limitless-main': source });
  const selection = { events: [{ label: 'JP', url: 'https://limitlesstcg.com/tournaments/569', maxDecklists: 1, expectedDeckSize: 60 }] };
  await expansion.preview(selection); assert.equal(requests.length, 0); assert.equal(await db.syncRun.count(), 0);
  await expansion.apply(selection);
  const cardIds = (await db.deckCard.findMany({ orderBy: { id: 'asc' } })).map(card => card.id);
  await expansion.apply(selection);
  assert.equal(await db.tournament.count(), 1); assert.equal(await db.player.count(), 32); assert.equal(await db.tournamentEntry.count(), 32);
  assert.deepEqual((await db.deckCard.findMany({ orderBy: { id: 'asc' } })).map(card => card.id), cardIds);
  assert.equal(requests.filter(url => url.includes('/decks/list/')).length, 1);
  assert.equal((await expansion.preview(selection)).events[0].listBudget, 0);
  const event = await db.tournament.findFirstOrThrow();
  await assert.rejects(db.tournament.create({ data: { ...event, id: randomUUID(), raw: json(event.raw), upstreamIds: json(event.upstreamIds) } }));
});
test('cross-source duplicate candidates preserve both provenances and never confirm extra appearances', async t => {
  const labsUrl = 'https://labs.limitlesstcg.com/0071/standings';
  const labs = new LimitlessLabsSource(async url => ({ html: internationalFixture('labs-0071'), sourceUrl: url, lastSyncedAt: manifest.retrievedAt }));
  await new TournamentSyncService(db, labs).sync({ url: labsUrl, maxDecklists: 0 });
  const main = mainFixtureSource('515'); const mainUrl = 'https://limitlesstcg.com/tournaments/515';
  await new TournamentSyncService(db, main).sync({ url: mainUrl, maxDecklists: 0 });
  assert.equal(await db.tournamentDuplicateCandidate.count(), 1); assert.ok(await db.resultDuplicateCandidate.count() >= 1);
  const identities = await db.sourceIdentity.findMany({ where: { player: { aliases: { some: { searchKey: 'andrew hedrick' } } } } });
  assert.equal(identities.length, 2); assert.notEqual(identities[0].playerId, identities[1].playerId);
  const queries = new ScoutQueryService(db);
  const history = await queries.playerHistory(identities[0].playerId);
  assert.equal(history.totalMeaning, 'published-source-results'); assert.equal(history.confirmedParticipationCount, null);
  const entry = history.entries[0];
  assert.equal(entry.duplicateResultsAsA.length + entry.duplicateResultsAsB.length, 1);
  await new TournamentSyncService(db, main).sync({ url: mainUrl, maxDecklists: 0 });
  assert.equal(await db.tournamentDuplicateCandidate.count(), 1);
  const app = buildApp(queries, new IdentityReviewService(db)); t.after(() => app.close());
  const response = await app.inject(`/players/${identities[0].playerId}/history`);
  assert.equal(response.statusCode, 200); assert.equal(response.json().confirmedParticipationCount, null);
  assert.equal(response.json().entries[0].duplicateResultsAsA.length + response.json().entries[0].duplicateResultsAsB.length, 1);
});
test('expansion stops after a failed source instead of proceeding to the remaining events', async () => {
  let calls = 0;
  const failed: DecklistDataSource = { async loadTournament() { calls++; throw new Error('Labs HTTP 429; stopped without retry'); }, async loadDecklist() { throw new Error('Unexpected list retrieval'); } };
  const expansion = new HistoricalExpansionService(db, { 'limitless-labs': failed, 'limitless-main': mainFixtureSource() });
  const result = await expansion.apply({ events: [{ label: 'Unavailable', url: 'https://labs.limitlesstcg.com/0054/standings', maxDecklists: 1 }, { label: 'JP', url: 'https://limitlesstcg.com/tournaments/569', maxDecklists: 1 }] });
  assert.equal(calls, 1); assert.equal(result.processedEvents, 1); assert.equal(result.stoppedEarly, true);
  assert.equal(result.runs[0].status, 'FAILED'); assert.equal(await db.tournament.count(), 0);
});
test('API serves Asian partial history and known lists without filling unknown divisions or match records', async t => {
  await new TournamentSyncService(db, mainFixtureSource()).sync({ url: 'https://limitlesstcg.com/tournaments/569', maxDecklists: 1, expectedDeckSize: 60 });
  const identity = await db.sourceIdentity.findUniqueOrThrow({ where: { source_scope_externalId: { source: 'limitless-main', scope: 'global', externalId: '15369' } } });
  const app = buildApp(new ScoutQueryService(db), new IdentityReviewService(db)); t.after(() => app.close());
  const history = (await app.inject(`/players/${identity.playerId}/history`)).json();
  assert.equal(history.entries[0].wins, null); assert.equal(history.entries[0].tournament.division, null);
  assert.equal(history.entries[0].tournament.resultsCoverage, 'PUBLISHED_RESULTS');
  const list = await app.inject(`/entries/${history.entries[0].id}/decklist`);
  assert.equal(list.statusCode, 200); assert.equal(list.json().cards.reduce((n: number, card: { quantity: number }) => n + card.quantity, 0), 60);
  const results = (await app.inject('/players?name=Keiyo')).json();
  assert.equal(results.matches[0].identities[0].source, 'limitless-main');
});

// Milestone 5: synthetic assessments stay exclusively in this isolated schema.
test('comparison summary preserves Unicode, unknown fields and contradictory assessments without merging', async t => {
  const snapshot = sample(), other = structuredClone(snapshot.entries[0]);
  snapshot.entries[0].player.originalName = 'João 山田'; snapshot.entries[0].country = null;
  other.player.originalName = 'JOAO 山田'; other.player.reference.externalId = '99999'; other.tournamentPlayerId = '999'; other.deck = null; other.decklistAvailable = false;
  snapshot.entries.push(other); snapshot.tournament.reportedPlayerCount = 2;
  await ingest(snapshot);
  const players = await db.player.findMany({ orderBy: { id: 'asc' } });
  const ownership = await db.sourceIdentity.findMany({ orderBy: { id: 'asc' } });
  const reviews = new IdentityReviewService(db);
  for (const decision of ['SAME_PERSON', 'DIFFERENT_PEOPLE', 'UNCERTAIN'] as const) await reviews.record({ playerAId: players[0].id, playerBId: players[1].id, decision,
    reviewer: '<script>not HTML</script>', reason: 'Synthetic evidence does not establish a shared identity.', evidenceUrls: [manifest.sourceUrl] });
  const app = buildApp(new ScoutQueryService(db), reviews, new DuplicateQueryService(db)); t.after(() => app.close());
  const result = await app.inject(`/identity-reviews/compare?playerAId=${players[1].id}&playerBId=${players[0].id}&view=summary`);
  assert.equal(result.statusCode, 200); const data = result.json();
  assert.equal(data.automaticallyMerged, false); assert.equal(data.reviewDecisionsConflict, true);
  assert.equal(data.reviews.length, 3); assert.equal(data.reviewsTotal, 3); assert.equal(data.reviewsTruncated, false);
  assert.equal(data.overlappingTournamentIds.length, 1); assert.equal(data.sharedNameKeys.length, 1);
  assert.ok(data.players.some((player: { displayName: string }) => player.displayName === 'João 山田'));
  assert.ok(data.players.some((player: { countries: string[] }) => player.countries.length === 0));
  assert.ok(data.players.some((player: { entries: { archetypeName: string | null }[] }) => player.entries[0].archetypeName === 'Regidrago'));
  assert.equal(data.countMeaning, 'published-source-results');
  assert.ok(data.players.every((player: { resultCount: number }) => player.resultCount === 1));
  assert.doesNotMatch(JSON.stringify(data), /"raw"|"evidence"|"rawList"|"searchKey"/);
  assert.deepEqual(await db.sourceIdentity.findMany({ orderBy: { id: 'asc' } }), ownership);
  assert.equal(await db.player.count(), 2); assert.equal(await db.tournamentEntry.count(), 2);
});

test('comparison summary reports exact review and history truncation limits', async () => {
  const snapshot = sample(), other = structuredClone(snapshot.entries[0]);
  other.player.reference.externalId = '99999'; other.tournamentPlayerId = '999'; other.deck = null; other.decklistAvailable = false;
  snapshot.entries.push(other); snapshot.tournament.reportedPlayerCount = 2; await ingest(snapshot);
  const players = await db.player.findMany({ orderBy: { id: 'asc' } });
  const first = await db.tournamentEntry.findFirstOrThrow({ where: { playerId: players[0].id } });
  // Synthetic repeated source rows exercise the service cap; not a career claim.
  await db.tournamentEntry.createMany({ data: Array.from({ length: 100 }, (_, index) => ({ ...first, id: randomUUID(), externalId: `synthetic-${index}`, raw: json({ synthetic: true }) })) });
  await db.identityReview.createMany({ data: Array.from({ length: 51 }, () => ({ playerAId: players[0].id, playerBId: players[1].id,
    decision: 'UNCERTAIN', reviewer: 'Synthetic reviewer', reason: 'Only tests truncation in an isolated schema.', evidenceUrls: json([manifest.sourceUrl]), evidence: json({ synthetic: true }) })) });
  const result = await new IdentityReviewService(db).compareForDisplay(players[0].id, players[1].id);
  assert.equal(result.historyLimit, 100); assert.equal(result.players[0].entries.length, 100);
  assert.equal(result.players[0].resultCount, 101); assert.equal(result.players[0].historyTruncated, true); assert.equal(result.historyTruncated, true);
  assert.equal(result.reviews.length, 50); assert.equal(result.reviewsLimit, 50); assert.equal(result.reviewsTotal, 51); assert.equal(result.reviewsTruncated, true);
});

test('duplicate detail API exposes both source projections and filters unrelated comparison overlaps', async t => {
  const labs = new LimitlessLabsSource(async url => ({ html: internationalFixture('labs-0071'), sourceUrl: url, lastSyncedAt: manifest.retrievedAt }));
  await new TournamentSyncService(db, labs).sync({ url: 'https://labs.limitlesstcg.com/0071/standings', maxDecklists: 0 });
  await new TournamentSyncService(db, mainFixtureSource('515')).sync({ url: 'https://limitlesstcg.com/tournaments/515', maxDecklists: 0 });
  const event = await db.tournamentDuplicateCandidate.findFirstOrThrow();
  const candidate = await db.resultDuplicateCandidate.findFirstOrThrow({ include: { entryA: true, entryB: true } });
  const reviews = new IdentityReviewService(db);
  const app = buildApp(new ScoutQueryService(db), reviews, new DuplicateQueryService(db)); t.after(() => app.close());
  for (const [kind, id] of [['event', event.id], ['result', candidate.id]]) {
    const response = await app.inject(`/duplicate-candidates/${kind}/${id}`);
    assert.equal(response.statusCode, 200); const detail = response.json();
    assert.equal(detail.status, 'POSSIBLE'); assert.equal(detail.confirmedSamePerson, false); assert.equal(detail.confirmedAdditionalParticipation, false);
    assert.deepEqual(new Set(detail.tournaments.map((row: { source: string }) => row.source)), new Set(['limitless-labs', 'limitless-main']));
    assert.equal(detail.tournaments.length, 2); assert.equal(detail.results.length, kind === 'result' ? 2 : 0);
    assert.ok(detail.tournaments.every((row: { sourceUrl: string; lastSyncedAt: string }) => row.sourceUrl.startsWith('https://') && row.lastSyncedAt));
    assert.doesNotMatch(JSON.stringify(detail), /"raw"|"upstreamIds"/);
    assert.ok(detail.signals.length > 0); assert.ok(detail.limitations.length > 0);
  }
  const summary = await reviews.compareForDisplay(candidate.entryA.playerId, candidate.entryB.playerId);
  assert.equal(summary.possibleOverlappingSourceEventPairs.length, 1);
  await ingest(sample()); // An unrelated synthetic event in the isolated schema.
  const unrelated = await db.sourceIdentity.findUniqueOrThrow({ where: { source_scope_externalId: { source: 'limitless-labs', scope: 'global', externalId: sample().entries[0].player.reference.externalId } } });
  const noOverlap = await reviews.compareForDisplay(candidate.entryA.playerId, unrelated.playerId);
  assert.equal(noOverlap.possibleOverlappingSourceEventPairs.length, 0);
  assert.equal((await app.inject(`/duplicate-candidates/event/${randomUUID()}`)).statusCode, 404);
  assert.equal((await app.inject(`/duplicate-candidates/result/${randomUUID()}`)).statusCode, 404);
});

// Milestone 6: all synthetic expansion below stays in the isolated test schema.
async function extraScoutingResult(playerId: string, options: { date?: string | null; format?: string | null; division?: string | null; archetypeId?: string | null; archetypeName?: string | null } = {}) {
  const original = await db.tournamentEntry.findFirstOrThrow({ where: { playerId } });
  const event = await db.tournament.findUniqueOrThrow({ where: { id: original.tournamentId } });
  const created = await db.tournament.create({ data: { ...event, id: randomUUID(), externalId: `synthetic-${randomUUID()}`, raw: json({ synthetic: true }), upstreamIds: json({}),
    eventDate: options.date === undefined ? '2026-05-24' : options.date,
    format: options.format === undefined ? 'standard-jp' : options.format, division: options.division === undefined ? null : options.division,
    name: 'Evento sintético 国際', country: 'KR', dateLabel: options.date ?? 'Data não informada', resultsCoverage: 'PUBLISHED_RESULTS', fullySynchronized: false } });
  const entry = await db.tournamentEntry.create({ data: { ...original, id: randomUUID(), externalId: randomUUID(), tournamentId: created.id, country: null, raw: json({ synthetic: true }) } });
  await db.deck.create({ data: { entryId: entry.id, source: event.source, externalId: entry.id, sourceUrl: entry.sourceUrl, lastSyncedAt: entry.lastSyncedAt,
    archetypeId: options.archetypeId === undefined ? 'dragapult' : options.archetypeId, archetypeName: options.archetypeName === undefined ? 'ドラパルトex' : options.archetypeName } });
  return entry;
}

test('scouting aggregates the full identity beyond page one and SAME_PERSON never expands its denominator', async t => {
  const snapshot = sample(), other = structuredClone(snapshot.entries[0]);
  other.player.reference.externalId = '99999'; other.tournamentPlayerId = '999'; other.deck = null; other.decklistAvailable = false;
  snapshot.entries.push(other); snapshot.tournament.reportedPlayerCount = 2; await ingest(snapshot);
  const owned = await db.sourceIdentity.findUniqueOrThrow({ where: { source_scope_externalId: { source: 'limitless-labs', scope: 'global', externalId: sample().entries[0].player.reference.externalId } } });
  const separate = await db.player.findFirstOrThrow({ where: { id: { not: owned.playerId } } });
  for (let index = 0; index < 24; index++) await extraScoutingResult(owned.playerId, { archetypeId: index === 0 ? null : 'dragapult', archetypeName: index === 0 ? null : 'ドラパルトex' });
  await new IdentityReviewService(db).record({ playerAId: owned.playerId, playerBId: separate.id, decision: 'SAME_PERSON', reviewer: 'Synthetic reviewer', reason: 'Synthetic assessment does not merge identities.', evidenceUrls: [manifest.sourceUrl] });
  const service = new ScoutingQueryService(db);
  const summary = await service.summary(owned.playerId);
  assert.equal(summary.counts.matchingResults, 25); assert.equal(summary.counts.knownArchetypeResults, 24); assert.equal(summary.counts.unknownArchetypeResults, 1);
  const group = summary.groups.find(group => group.externalId === 'dragapult')!;
  assert.equal(group.resultCount, 23); assert.equal(group.denominator, 24); assert.equal(group.percentage, 95.8);
  assert.equal(group.eventsTruncated, true); assert.equal(group.events.length, 3);
  const first = await service.evidence(owned.playerId, { group: group.key, limit: 10 });
  const second = await service.evidence(owned.playerId, { group: group.key, limit: 10, offset: 10 });
  const third = await service.evidence(owned.playerId, { group: group.key, limit: 10, offset: 20 });
  assert.equal(first.total, group.resultCount); assert.equal(first.entries.length + second.entries.length + third.entries.length, group.resultCount);
  assert.equal(new Set([...first.entries, ...second.entries, ...third.entries].map(entry => entry.id)).size, 23);
  assert.equal(summary.revision, first.revision); assert.equal(summary.revision, third.revision);
  assert.equal((await service.evidence(owned.playerId, { group: 'unknown' })).total, 1);
  assert.equal((await service.summary(separate.id)).counts.availableResults, 1);
  assert.doesNotMatch(JSON.stringify(first), /"raw"|"cards"|"rawList"/);
  const app = buildApp(new ScoutQueryService(db), new IdentityReviewService(db), new DuplicateQueryService(db), service); t.after(() => app.close());
  assert.equal((await app.inject(`/players/${owned.playerId}/scouting`)).statusCode, 200);
  assert.equal((await app.inject(`/players/${randomUUID()}/scouting`)).statusCode, 404);
  assert.equal((await app.inject(`/players/${randomUUID()}/scouting/evidence`)).statusCode, 404);
  const changed = first.entries[0].id;
  await db.deck.update({ where: { entryId: changed }, data: { archetypeName: 'Changed source label' } });
  assert.notEqual((await service.summary(owned.playerId)).revision, summary.revision);
});

test('scouting calendar filters preserve unknown fields, regional formats and inclusive boundaries', async () => {
  await ingest(sample()); const player = await db.player.findFirstOrThrow();
  await extraScoutingResult(player.id, { date: '2026-05-24' }); await extraScoutingResult(player.id, { date: '2026-06-01' });
  await extraScoutingResult(player.id, { date: null }); await extraScoutingResult(player.id, { date: '2026-05-23' });
  await extraScoutingResult(player.id, { date: '2026-05-24', format: 'standard', division: 'MA' });
  const service = new ScoutingQueryService(db);
  const filters = { from: '2026-05-24', to: '2026-06-01', formatMode: 'known', format: 'standard-jp', divisionMode: 'unknown' };
  const summary = await service.summary(player.id, filters);
  assert.equal(summary.counts.matchingResults, 2); assert.equal(summary.counts.excludedUnknownDateByPeriod, 1);
  const evidence = await service.evidence(player.id, filters);
  assert.equal(evidence.total, 2); assert.equal(evidence.entries[0].tournament.country, 'KR'); assert.equal(evidence.entries[0].country, null);
  assert.ok(evidence.entries.every(entry => entry.tournament.format === 'standard-jp' && entry.tournament.division === null));
  assert.equal((await service.summary(player.id, { dateState: 'unknown', formatMode: 'known', format: 'standard-jp' })).counts.matchingResults, 1);
  assert.equal((await service.summary(player.id, { formatMode: 'known', format: 'standard' })).counts.matchingResults, 1);
  assert.equal((await service.summary(player.id, { formatMode: 'unknown' })).counts.matchingResults, 1);
  assert.equal((await service.summary(player.id, { from: '2099-01-01' })).groups.length, 0);
  await assert.rejects(service.summary(player.id, { from: '2026-02-30' }));
});

test('scouting conservatively excludes result and event candidates once, retaining provenance for inspection', async () => {
  const labs = new LimitlessLabsSource(async url => ({ html: internationalFixture('labs-0071'), sourceUrl: url, lastSyncedAt: manifest.retrievedAt }));
  await new TournamentSyncService(db, labs).sync({ url: 'https://labs.limitlesstcg.com/0071/standings', maxDecklists: 0 });
  await new TournamentSyncService(db, mainFixtureSource('515')).sync({ url: 'https://limitlesstcg.com/tournaments/515', maxDecklists: 0 });
  const candidate = await db.resultDuplicateCandidate.findFirstOrThrow({ include: { entryA: true } });
  const service = new ScoutingQueryService(db); const summary = await service.summary(candidate.entryA.playerId);
  assert.equal(summary.counts.excludedPossibleDuplicates, summary.counts.matchingResults); assert.equal(summary.counts.eligibleResults, 0); assert.deepEqual(summary.groups, []);
  const evidence = await service.evidence(candidate.entryA.playerId, { scope: 'duplicates' });
  assert.equal(evidence.total, summary.counts.excludedPossibleDuplicates);
  assert.equal((await service.evidence(candidate.entryA.playerId)).total, 0);
  assert.ok(evidence.entries.some(entry => entry.duplicateResultsAsA.length + entry.duplicateResultsAsB.length > 0));
  assert.ok(evidence.entries.every(entry => entry.tournament.duplicateEventsAsA.length + entry.tournament.duplicateEventsAsB.length > 0));
  assert.ok(await db.resultDuplicateCandidate.count() > 0); assert.ok(await db.tournamentEntry.count() > 0);
});
