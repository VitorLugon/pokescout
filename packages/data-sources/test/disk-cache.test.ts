import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {diskCachedReader} from '../src/disk-cache.js';

test('disk cache survives reader restart, preserves capture times and never caches errors', async t => {
  const root=resolve(tmpdir());const directory=await mkdtemp(join(root,'pokescout-cache-'));
  assert.equal(dirname(resolve(directory)),root);assert.ok(basename(directory).startsWith('pokescout-cache-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const page={sourceUrl:'https://labs.limitlesstcg.com/0009/standings',html:'<main>public fixture</main>',lastSyncedAt:'2026-10-14T00:00:00Z'};
  let calls=0; const reader=diskCachedReader(async()=>{calls++;return page;},directory);
  assert.deepEqual(await reader(page.sourceUrl),page);
  assert.deepEqual(await diskCachedReader(async()=>{throw Error('must stay offline');},directory)(page.sourceUrl),page);
  assert.equal(calls,1);
  const missing='https://labs.limitlesstcg.com/0010/standings'; let failures=0;
  const fail=diskCachedReader(async()=>{failures++;throw Error('HTTP 429; stop');},directory);
  await assert.rejects(fail(missing),/429/); await assert.rejects(fail(missing),/429/); assert.equal(failures,2);
});
