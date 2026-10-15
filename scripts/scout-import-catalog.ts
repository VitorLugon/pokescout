import { readFile, mkdir, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseArgs, argumentError, withDatabase } from './cli-common.js';
import { CatalogImportService } from '../packages/application/src/index.js';
import { LimitlessLabsSource, LimitlessMainSource, diskCachedReader, type CatalogEvent } from '../packages/data-sources/src/index.js';
import { createPublicClient } from '../packages/data-sources/src/limitless-labs/client.js';
import { createMainClient } from '../packages/data-sources/src/limitless-main/client.js';
try {
  const { values } = parseArgs({ options: { manifest: { type: 'string', default: 'config/labs-catalog.json' }, apply: { type: 'boolean', default: false }, 'max-events': { type: 'string', default: '5' }, 'stop-file': { type: 'string', default: '.cache/catalog-import.stop' } } });
  void withDatabase(async db => {
    let stopRequested = false;
    const stop = () => { stopRequested = true; console.error('Stop requested: finishing the current event before exit.'); };
    const manifest = JSON.parse(await readFile(values.manifest,'utf8')) as { events: CatalogEvent[] };
    const service = new CatalogImportService(db, {
      'limitless-labs': new LimitlessLabsSource(diskCachedReader(createPublicClient(), '.cache/tournament-html')),
      'limitless-main': new LimitlessMainSource(diskCachedReader(createMainClient(), '.cache/tournament-html')),
    });
    const plan = await service.preview(manifest.events);
    if (!values.apply) { console.log(JSON.stringify({ mode: 'PREVIEW_NO_HTTP', ...plan }, null, 2)); return; }
    process.once('SIGINT', stop);
    await mkdir('.cache', { recursive: true });
    const report = await service.apply(manifest.events, Number(values['max-events']), async ({ event, run }) => {
      const line = { at: new Date().toISOString(), source: event.source, id: event.externalId, division: event.division, name: event.name, runId: run.id, status: run.status, entriesSaved: run.entriesSaved, issues: run.issues };
      await appendFile('.cache/catalog-import.jsonl', JSON.stringify(line) + '\n');
      console.log(JSON.stringify(line));
    }, () => stopRequested || existsSync(values['stop-file']));
    process.removeListener('SIGINT', stop);
    console.log(JSON.stringify({ ...report, remaining: (await service.preview(manifest.events)).pending.length }));
    if (report.stoppedOnError) process.exitCode = 1;
    if (report.stoppedByOperator) process.exitCode = 130;
  });
} catch (error) { argumentError(error); }
