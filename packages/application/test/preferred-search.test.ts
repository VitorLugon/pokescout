import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {PlayerCandidate} from '@tcg-scout/shared';
import {preferLabsPlayers,preferredSearchResponse} from '../src/preferred-search.js';
const player=(id:string,name:string,source:string):PlayerCandidate=>({id,displayName:name,aliases:[name],countries:[],identities:[{source,scope:'global',externalId:id}],possibleMatchIds:[]});
const labs=player('labs','João 山田','limitless-labs'),main=player('main','JOÃO 山田','limitless-main');
test('search gives Labs a primary card while retaining Main-only names and the original alternative',()=>{
  const exclusive=player('exclusive','Outro jogador','limitless-main');
  const input=[main,labs,exclusive];const before=structuredClone(input);const result=preferLabsPlayers(input);
  assert.deepEqual(result.map(row=>row.id),['labs','exclusive']);assert.equal(result[0].alternativeMatches[0].id,'main');
  assert.deepEqual(input,before);
});
test('ambiguous, accent-stripped and negatively reviewed identities stay independent',()=>{
  assert.equal(preferLabsPlayers([labs,main,player('labs2',labs.displayName,'limitless-labs')]).length,3);
  assert.equal(preferLabsPlayers([labs,player('unaccented','Joao 山田','limitless-main')]).length,2);
  assert.equal(preferLabsPlayers([labs,main],new Set(['labs:main'])).length,2);
});
test('search pagination applies after grouping and retains preselection-limit warnings',()=>{
  const response=preferredSearchResponse({matches:[main,labs,player('only','Outro','limitless-main')],truncated:true},1,new Set());
  assert.equal(response.matches[0].id,'labs');assert.equal(response.truncated,true);assert.equal(response.presentation.inspectedMatchesLimited,true);
});
