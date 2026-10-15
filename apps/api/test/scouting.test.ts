import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { QueryNotFoundError, type ScoutQueryService, type IdentityReviewService, type ScoutingQueryService } from '@tcg-scout/application';

test('scouting GET routes validate filters/pagination before delegating and remain read-only', async t => {
  const calls: unknown[][] = [], id = randomUUID();
  const app = buildApp({} as ScoutQueryService, {} as IdentityReviewService, undefined, {
    async summary(...args: unknown[]) { calls.push(['summary', ...args]); return {}; },
    async evidence(...args: unknown[]) { calls.push(['evidence', ...args]); return {}; },
  } as unknown as ScoutingQueryService); t.after(() => app.close());
  assert.equal((await app.inject(`/players/${id}/scouting?from=2026-05-24&formatMode=known&format=standard-jp`)).statusCode, 200);
  assert.equal((await app.inject(`/players/${id}/scouting/evidence?limit=2&offset=2&group=unknown`)).statusCode, 200);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], ['summary', id, { from: '2026-05-24', dateState: 'all', formatMode: 'known', format: 'standard-jp', divisionMode: 'all' }]);
  for (const url of ['/players/bad/scouting', `/players/${id}/scouting?from=2026-02-30`, `/players/${id}/scouting?format=standard`, `/players/${id}/scouting?surprise=yes`, `/players/${id}/scouting/evidence?limit=101`, `/players/${id}/scouting/evidence?offset=-1`, `/players/${id}/scouting/evidence?scope=duplicates&group=unknown`]) assert.equal((await app.inject(url)).statusCode, 400);
  for (const method of ['POST','PUT','PATCH','DELETE'] as const) assert.equal((await app.inject({ method, url: `/players/${id}/scouting` })).statusCode, 404);
  assert.equal(calls.length, 2);
});

test('scouting unknown identities return 404 and failures do not disclose database details', async t => {
  const app = buildApp({} as ScoutQueryService, {} as IdentityReviewService, undefined, {
    async summary() { throw new QueryNotFoundError('Player not found'); },
    async evidence() { throw new Error('postgresql://private'); },
  } as unknown as ScoutingQueryService); t.after(() => app.close());
  assert.equal((await app.inject(`/players/${randomUUID()}/scouting`)).statusCode, 404);
  assert.deepEqual((await app.inject(`/players/${randomUUID()}/scouting/evidence`)).json(), { error: 'Internal server error' });
});
