import { DecklistReconciliationService } from '../packages/application/src/index.js';
import { LimitlessLabsSource } from '../packages/data-sources/src/index.js';
import { parseArgs, withDatabase, argumentError } from './cli-common.js';
try {
  const { values } = parseArgs({ options: { tournament: { type: 'string' }, mode: { type: 'string', default: 'pending' },
    'max-decklists': { type: 'string', default: '5' }, apply: { type: 'boolean', default: false } } });
  if (!values.tournament) throw new Error('Use --tournament <internal tournament UUID>');
  if (!['pending', 'refresh'].includes(values.mode)) throw new Error('--mode must be pending or refresh');
  const mode = values.mode as 'pending' | 'refresh';
  void withDatabase(async db => {
    const service = new DecklistReconciliationService(db, new LimitlessLabsSource());
    if (!values.apply) {
      const plan = await service.plan(values.tournament!, mode, Number(values['max-decklists']));
      console.log(JSON.stringify({ dryRun: true, tournamentId: plan.tournament.id, mode, cap: plan.maxDecklists, eligible: plan.eligible,
        selected: plan.decks.map(deck => ({ deckId: deck.id, entryId: deck.entryId, sourceUrl: deck.decklistUrl })) }, null, 2)); return;
    }
    const run = await service.reconcile(values.tournament!, mode, Number(values['max-decklists']));
    console.log(JSON.stringify(run, null, 2));
    if (run.status !== 'SUCCESS') process.exitCode = run.status === 'PARTIAL' ? 2 : 1;
  });
} catch (error) { argumentError(error); }
