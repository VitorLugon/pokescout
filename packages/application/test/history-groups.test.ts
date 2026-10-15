import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyNameKey, groupSourceResults } from '../src/history-groups.js';

test('history names preserve accents, punctuation and scripts while accepting case and spacing',()=>{
  assert.equal(historyNameKey('  JOÃO  山田 '),historyNameKey('João 山田'));
  assert.equal(historyNameKey('Joa\u0303o'),historyNameKey('João'));
  assert.notEqual(historyNameKey('João'),historyNameKey('Joao'));
  assert.notEqual(historyNameKey('山田'),historyNameKey('Yamada'));
  assert.notEqual(historyNameKey("D'Ávila"),historyNameKey('D Ávila'));
});
const rows=[{id:'main',tournament:{source:'limitless-main'}},{id:'labs',tournament:{source:'limitless-labs'}},{id:'old',tournament:{source:'limitless-labs'}}];
test('one-to-one candidate pair is a single consultable group retaining both original rows',()=>{
  const groups=groupSourceResults(rows,[{entryAId:'main',entryBId:'labs'},{entryAId:'labs',entryBId:'main'}]);
  assert.equal(groups.length,2);assert.equal(groups[0].primary.id,'labs');assert.equal(groups[0].otherSources[0].id,'main');
  assert.equal(groups[1].primary.id,'old');
  assert.equal(groups.flatMap(group=>[group.primary,...group.otherSources]).length,rows.length);
});
test('ambiguous, same-source and missing-member candidate pairs never hide results',()=>{
  for(const pairs of [[{entryAId:'main',entryBId:'labs'},{entryAId:'main',entryBId:'old'}],[{entryAId:'labs',entryBId:'old'}],[{entryAId:'main',entryBId:'absent'}]]) {
    assert.equal(groupSourceResults(rows,pairs).length,3);
  }
});
