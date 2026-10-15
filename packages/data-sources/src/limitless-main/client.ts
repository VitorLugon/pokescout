import { createPublicHtmlClient } from '../public-http.js';
export type { PageReader } from '../public-http.js';
export const createMainClient = (fetcher: typeof fetch = fetch) => createPublicHtmlClient({
  origin: 'https://limitlesstcg.com', spacingMs: 1300,
  paths: /^\/(?:tournaments(?:\/[1-9]\d*)?|decks\/list\/[1-9]\d*|players\/[1-9]\d*(?:\/results)?)$/,
  label: 'Limitless Main', invalidMessage: 'Only documented public Main page patterns are supported',
}, fetcher);
