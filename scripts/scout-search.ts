import { ScoutQueryService } from '../packages/application/src/index.js';
import { parseArgs, withDatabase, argumentError } from './cli-common.js';
try {
  const { values } = parseArgs({ options: { name: { type: 'string' } } });
  if (!values.name?.trim()) throw new Error('Use --name "<player name>".');
  void withDatabase(async db => {
    const result = await new ScoutQueryService(db).searchPlayers(values.name!);
    console.log(JSON.stringify(result, null, 2));
    if (!result.matches.length) console.log('No matching players found.');
  });
} catch (error) { argumentError(error); }
