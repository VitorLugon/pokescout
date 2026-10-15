import { LimitlessLabsSource } from '../packages/data-sources/src/index.js';
import { TournamentSyncService } from '../packages/application/src/index.js';
import { parseArgs, withDatabase, argumentError } from './cli-common.js';
try {
  const { values } = parseArgs({ options: {
    tournament: { type: 'string' }, division: { type: 'string', default: 'MA' },
    'max-decklists': { type: 'string', default: '5' }, format: { type: 'string' }, 'deck-size': { type: 'string' },
  } });
  if (!values.tournament || !/^\d{4,8}$/.test(values.tournament)) throw new Error('Use --tournament <4–8 digit Labs ID>, preserving leading zeros.');
  if (!['MA', 'SR', 'JR'].includes(values.division)) throw new Error('--division must be MA, SR or JR.');
  const maxDecklists = Number(values['max-decklists']);
  if (!Number.isInteger(maxDecklists) || maxDecklists < 0 || maxDecklists > 20) throw new Error('--max-decklists must be 0–20.');
  const expectedDeckSize = values['deck-size'] === undefined ? undefined : Number(values['deck-size']);
  if (expectedDeckSize !== undefined && (!Number.isInteger(expectedDeckSize) || expectedDeckSize <= 0)) throw new Error('--deck-size must be a positive integer.');
  const url = `https://labs.limitlesstcg.com/${values.tournament}${values.division === 'MA' ? '' : `/${values.division}`}/standings`;
  void withDatabase(async db => {
    const run = await new TournamentSyncService(db, new LimitlessLabsSource()).sync({ url, maxDecklists, format: values.format, expectedDeckSize });
    console.log(JSON.stringify(run, null, 2));
    // PARTIAL is deliberately a nonzero result for scripts and future schedulers.
    if (run.status !== 'SUCCESS') process.exitCode = run.status === 'PARTIAL' ? 2 : 1;
  });
} catch (error) { argumentError(error); }
