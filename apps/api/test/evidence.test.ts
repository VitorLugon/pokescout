import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { QueryNotFoundError, type ScoutQueryService, type IdentityReviewService, type DuplicateQueryService } from '@tcg-scout/application';

test('summary comparison and duplicate details validate input and delegate without writes', async t => {
  const calls: unknown[][] = [], a = randomUUID(), b = randomUUID(), id = randomUUID();
  const app = buildApp({} as ScoutQueryService, {
    async compare() { return { legacy: true }; },
    async compareForDisplay(...args: unknown[]) { calls.push(['summary', ...args]); return { automaticallyMerged: false }; },
  } as unknown as IdentityReviewService, {
    async detail(...args: unknown[]) { calls.push(['detail', ...args]); return { status: 'POSSIBLE' }; },
  } as unknown as DuplicateQueryService);
  t.after(() => app.close());
  assert.equal((await app.inject(`/identity-reviews/compare?playerAId=${a}&playerBId=${b}&view=summary`)).statusCode, 200);
  assert.equal((await app.inject(`/duplicate-candidates/result/${id}`)).statusCode, 200);
  assert.deepEqual(calls, [['summary', a, b], ['detail', 'result', id]]);
  assert.deepEqual((await app.inject(`/identity-reviews/compare?playerAId=${a}&playerBId=${b}`)).json(), { legacy: true });
  for (const url of [`/identity-reviews/compare?playerAId=${a}&playerBId=${a}&view=summary`, `/identity-reviews/compare?playerAId=${a}&playerBId=${b}&view=raw`, `/duplicate-candidates/person/${id}`, '/duplicate-candidates/event/bad', `/duplicate-candidates/event/${id}?includeRaw=true`]) assert.equal((await app.inject(url)).statusCode, 400);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) assert.equal((await app.inject({ method, url: `/duplicate-candidates/event/${id}` })).statusCode, 404);
  assert.equal(calls.length, 2);
});

test('missing duplicate/identity evidence returns 404 and unexpected errors are sanitized', async t => {
  const app = buildApp({} as ScoutQueryService, {
    async compareForDisplay() { throw new QueryNotFoundError('Player not found'); },
  } as unknown as IdentityReviewService, { async detail(kind: string) {
    if (kind === 'event') throw new QueryNotFoundError('Duplicate candidate not found');
    throw new Error('Sensitive database error');
  } } as unknown as DuplicateQueryService);
  t.after(() => app.close());
  assert.equal((await app.inject(`/duplicate-candidates/event/${randomUUID()}`)).statusCode, 404);
  assert.equal((await app.inject(`/identity-reviews/compare?playerAId=${randomUUID()}&playerBId=${randomUUID()}&view=summary`)).statusCode, 404);
  assert.deepEqual((await app.inject(`/duplicate-candidates/result/${randomUUID()}`)).json(), { error: 'Internal server error' });
});
