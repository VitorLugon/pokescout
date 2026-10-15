import { repairTournamentDates } from '../packages/application/src/tournament-dates.js';
import { parseArgs, argumentError, withDatabase } from './cli-common.js';

try {
  const { values } = parseArgs({ options: { apply: { type: 'boolean', default: false } } });
  void withDatabase(async db => { console.log(JSON.stringify(await repairTournamentDates(db, values.apply), null, 2)); });
} catch (error) { argumentError(error); }
