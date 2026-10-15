import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseArgs, argumentError } from './cli-common.js';
import { createLabsCatalogClient, createMainCatalogClient, parseLabsCatalog, parseMainCatalog, publicLabsDivisions, diskCachedReader, type CatalogEvent } from '../packages/data-sources/src/index.js';
import { sourceLocation } from '../packages/data-sources/src/index.js';
import { createPublicClient } from '../packages/data-sources/src/limitless-labs/client.js';
try {
  const { values } = parseArgs({ options: { source: { type: 'string', default: 'labs' }, output: { type: 'string' }, 'max-pages': { type: 'string', default: '25' } } });
  const max = Number(values['max-pages']);
  if (!['labs','labs-divisions','main'].includes(values.source) || !Number.isInteger(max) || max < 1 || max > 100) throw new Error('source must be labs/labs-divisions/main; max-pages 1–100');
  void (async () => {
    await mkdir('config', { recursive: true });
    const events = [];
    if (values.source === 'labs-divisions') {
      // Reuse Masters snapshots; obtain only missing explicit public pages (e.g. prior imports).
      const manifest=JSON.parse(await readFile('config/labs-catalog.json','utf8')) as {events:CatalogEvent[]};
      const read=diskCachedReader(createPublicClient(),'.cache/tournament-html');
      for(const event of manifest.events) {
        const page=await read(event.sourceUrl);
        if(page.sourceUrl!==event.sourceUrl)throw Error('Cached standings URL mismatch');
        for(const url of publicLabsDivisions(page)) events.push({...event,...sourceLocation(url),sourceUrl:url,catalogUrl:event.sourceUrl,discoveredAt:page.lastSyncedAt});
      }
      if(!events.length)throw Error('No explicit public division links found');
    }
    else if (values.source === 'labs') events.push(...parseLabsCatalog(await diskCachedReader(createLabsCatalogClient(), '.cache/catalog-html')('https://labs.limitlesstcg.com/')));
    else {
      const read = diskCachedReader(createMainCatalogClient(), '.cache/catalog-html');
      let pages = 1;
      for (let page = 1; page <= pages; page++) {
        const result = parseMainCatalog(await read(`https://limitlesstcg.com/tournaments${page === 1 ? '' : `?page=${page}`}`));
        if (result.currentPage !== page || result.maxPage > max) throw new Error('Catalog page mismatch or max-pages exceeded; no unbounded traversal');
        pages = result.maxPage; events.push(...result.events);
      }
    }
    if (new Set(events.map(event => event.sourceUrl)).size !== events.length) throw new Error('Duplicate events across catalog pages');
    const path = values.output ?? `config/${values.source}-catalog.json`;
    await writeFile(path, JSON.stringify({ capturedAt: new Date().toISOString(), events }, null, 2) + '\n');
    console.log(JSON.stringify({ path, events: events.length, seasons: [...new Set(events.map(event => event.season))] }));
  })().catch(argumentError);
} catch (error) { argumentError(error); }
