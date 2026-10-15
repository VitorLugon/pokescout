import { createPublicHtmlClient } from '../public-http.js';
export type { RetrievedPage, PageReader } from '../public-http.js';
export function createPublicClient(fetcher: typeof fetch = fetch) {
  return createPublicHtmlClient({ origin: 'https://labs.limitlesstcg.com',
    paths: /^\/\d+(?:\/(SR|JR))?\/(standings|player\/\d+\/decklist)$/,
    label: 'Labs', invalidMessage: 'Only public Labs standings and decklist pages are supported',
  }, fetcher);
}
