import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { QueryNotFoundError, type ScoutQueryService, type IdentityReviewService } from '@tcg-scout/application';
function fixture() {
  const calls: unknown[][] = [];
  const queries = {
    async searchPlayers(...args: unknown[]) { calls.push(['search', ...args]); return { matches: [], truncated: false }; },
    async playerHistory(...args: unknown[]) { calls.push(['history', ...args]); return { entries: [], total: 0 }; },
    async listTournaments(...args: unknown[]) { calls.push(['tournaments', ...args]); return []; },
    async knownDecklist(...args: unknown[]) { calls.push(['decklist', ...args]); return { cards: [] }; },
  };
  const reviews = { async compare(...args: unknown[]) { calls.push(['compare', ...args]); return { automaticallyMerged: false }; } };
  const app = buildApp(queries as unknown as ScoutQueryService, reviews as unknown as IdentityReviewService);
  return { app, queries, calls };
}
test('read routes delegate to services and serialize responses', async t => {
  const { app, calls } = fixture(); t.after(() => app.close()); const id = randomUUID(), other = randomUUID();
  for (const url of ['/health', '/players?name=Jo%C3%A3o&limit=12', `/players/${id}/history?limit=3&offset=2`,
    '/tournaments?limit=7', `/entries/${id}/decklist`, `/identity-reviews/compare?playerAId=${id}&playerBId=${other}`]) {
    assert.equal((await app.inject(url)).statusCode, 200);
  }
  assert.deepEqual(calls, [['search', 'João', 12], ['history', id, 3, 2], ['tournaments', 7], ['decklist', id], ['compare', id, other]]);
});
test('invalid queries and UUIDs are rejected before calling services', async t => {
  const { app, calls } = fixture(); t.after(() => app.close()); const id = randomUUID();
  for (const url of ['/players', '/players?name=..', '/players?name=abc&limit=101', '/players?name=abc&limit=1.5',
    '/players?name=abc&surprise=yes', '/players/not-a-uuid/history', `/players/${id}/history?offset=-1`,
    '/tournaments?limit=0', '/entries/bad/decklist', `/identity-reviews/compare?playerAId=${id}&playerBId=${id}`]) {
    assert.equal((await app.inject(url)).statusCode, 400, url);
  }
  assert.equal(calls.length, 0);
});
test('unknown records return 404; database errors return sanitized 500', async t => {
  const { app, queries } = fixture(); t.after(() => app.close());
  queries.knownDecklist = async () => { throw new QueryNotFoundError('No successfully imported decklist for this entry.'); };
  assert.equal((await app.inject(`/entries/${randomUUID()}/decklist`)).statusCode, 404);
  queries.listTournaments = async () => { throw new Error('postgresql://secret:password@localhost/private'); };
  const result = await app.inject('/tournaments');
  assert.equal(result.statusCode, 500); assert.deepEqual(result.json(), { error: 'Internal server error' });
});
test('write methods and unknown routes cannot mutate application state', async t => {
  const { app, calls } = fixture(); t.after(() => app.close());
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
    assert.equal((await app.inject({ method, url: '/players', payload: { name: 'abc' } })).statusCode, 404);
  }
  assert.equal((await app.inject('/sync')).statusCode, 404); assert.equal(calls.length, 0);
});
test('history and search defaults are bounded', async t => {
  const { app, calls } = fixture(); t.after(() => app.close()); const id = randomUUID();
  await app.inject('/players?name=abc'); await app.inject(`/players/${id}/history`); await app.inject('/tournaments');
  assert.deepEqual(calls, [['search', 'abc', 30], ['history', id, 50, 0], ['tournaments', 50]]);
});

test('combined history is an explicit validated read view and preserves the original default',async t=>{
  const {app,queries,calls}=fixture();t.after(()=>app.close());const id=randomUUID();
  (queries as unknown as ScoutQueryService).combinedHistory=async(playerId,take=100,offset=0)=>{calls.push(['combined',playerId,take,offset]);return {entries:[],total:0} as never;};
  assert.equal((await app.inject(`/players/${id}/history?view=same-name&limit=3&offset=2`)).statusCode,200);
  assert.equal((await app.inject(`/players/${id}/history?view=merge`)).statusCode,400);
  assert.equal((await app.inject(`/players/${id}/history?view=same-name&limit=101`)).statusCode,400);
  assert.deepEqual(calls,[['combined',id,3,2]]);
});

test('Labs-first search and catalog views validate and delegate without changing original endpoints',async t=>{
  const {app,queries,calls}=fixture();t.after(()=>app.close());
  (queries as unknown as ScoutQueryService).preferredSearch=async(name,take=30)=>{calls.push(['preferred-search',name,take]);return {matches:[],truncated:false,presentation:{policy:'labs-first',inspectedMatches:0,inspectedMatchesLimited:false}};};
  (queries as unknown as ScoutQueryService).preferredTournamentCatalog=async(take=20,offset=0)=>{calls.push(['preferred-catalog',take,offset]);return {events:[],total:0,limit:take,offset,truncated:false};};
  assert.equal((await app.inject('/players?name=Joao&view=labs-first&limit=5')).statusCode,200);
  assert.equal((await app.inject('/tournament-catalog?view=labs-first&limit=2&offset=1')).statusCode,200);
  for(const url of ['/players?name=Joao&view=delete','/tournament-catalog?view=delete'])assert.equal((await app.inject(url)).statusCode,400);
  assert.deepEqual(calls,[['preferred-search','Joao',5],['preferred-catalog',2,1]]);
});

test('paginated catalog validates bounds and delegates without source HTTP', async t => {
  const {app,queries,calls}=fixture(); t.after(()=>app.close());
  (queries as unknown as ScoutQueryService).tournamentCatalog=async(limit=20,offset=0)=>{calls.push(['catalog',limit,offset]);return {events:[],total:0,limit,offset,truncated:false};};
  assert.equal((await app.inject('/tournament-catalog?limit=20&offset=100')).statusCode,200);
  for(const query of ['offset=-1','limit=101','offset=1.5','unexpected=yes']) assert.equal((await app.inject('/tournament-catalog?'+query)).statusCode,400);
  assert.deepEqual(calls,[['catalog',20,100]]);
});
