import { ScoutQueryService } from '../packages/application/src/index.js';
import { parseArgs, withDatabase, argumentError } from './cli-common.js';
try {
  const { values } = parseArgs({ options: { player: { type: 'string' } } });
  if (!values.player || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(values.player)) throw new Error('Use --player <internal UUID returned by scout:search>.');
  void withDatabase(async db => { console.log(JSON.stringify(await new ScoutQueryService(db).playerHistory(values.player!), null, 2)); });
} catch (error) { argumentError(error); }
