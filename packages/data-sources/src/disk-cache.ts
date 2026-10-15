import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { PageReader, RetrievedPage } from './public-http.js';

// Successful public pages only. Cache preserves their original capture time.
export function diskCachedReader(read: PageReader, directory: string): PageReader {
  return async url => {
    const file = join(directory, `${createHash('sha256').update(url).digest('hex')}.json`);
    try {
      const page = JSON.parse(await readFile(file, 'utf8')) as RetrievedPage;
      if (page.sourceUrl !== url || typeof page.html !== 'string' || !Number.isFinite(Date.parse(page.lastSyncedAt))) throw new Error('Invalid cached public page');
      return page;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const page = await read(url);
    await mkdir(directory, { recursive: true });
    await writeFile(`${file}.tmp`, JSON.stringify(page)); await rename(`${file}.tmp`, file);
    return page;
  };
}
