import { LimitlessMainSource } from '../packages/data-sources/src/index.js';
import { parseArgs, argumentError } from './cli-common.js';
try {
  const { values } = parseArgs({ options: { player: { type: 'string' }, 'results-page': { type: 'boolean', default: false } } });
  if (!values.player || !/^[1-9]\d*$/.test(values.player)) throw new Error('Use --player <Main source profile ID>');
  const url = `https://limitlesstcg.com/players/${values.player}${values['results-page'] ? '/results' : ''}`;
  void new LimitlessMainSource().loadPlayerHistory(url).then(history => console.log(JSON.stringify(history, null, 2))).catch(argumentError);
} catch (error) { argumentError(error); }
