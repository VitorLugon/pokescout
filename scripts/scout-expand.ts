import { readFile } from 'node:fs/promises';
import { LimitlessLabsSource, LimitlessMainSource } from '../packages/data-sources/src/index.js';
import { HistoricalExpansionService } from '../packages/application/src/index.js';
import { parseArgs, withDatabase, argumentError } from './cli-common.js';
try {
  const { values } = parseArgs({ options: { manifest: { type: 'string', default: 'config/international-sample.json' }, apply: { type: 'boolean', default: false } } });
  void withDatabase(async db => {
    const input: unknown = JSON.parse(await readFile(values.manifest, 'utf8'));
    const service = new HistoricalExpansionService(db, { 'limitless-labs': new LimitlessLabsSource(), 'limitless-main': new LimitlessMainSource() });
    const result = values.apply ? await service.apply(input) : await service.preview(input);
    console.log(JSON.stringify(result, null, 2));
    if ('runs' in result && (result.stoppedEarly || result.runs.some(run => run.status !== 'SUCCESS'))) process.exitCode = 2;
  });
} catch (error) { argumentError(error); }
