import { load } from 'cheerio';
import { tournamentLocation } from './limitless-labs/parser.js';
import { createPublicHtmlClient, type RetrievedPage } from './public-http.js';

export interface CatalogEvent {
  source: 'limitless-labs' | 'limitless-main'; externalId: string; division: string | null;
  name: string; dateLabel: string; country: string | null; season: number | null;
  format: string | null; sourceUrl: string; catalogUrl: string; discoveredAt: string;
  locationLabel?: string | null;
}
export function parseLabsCatalog(page: RetrievedPage): CatalogEvent[] {
  const $ = load(page.html), rows: CatalogEvent[] = [];
  $('h2').each((_i, heading) => {
    const season = /^(\d{4}) season$/.exec($(heading).text().trim());
    if (!season) return;
    $(heading).next('ul').find('a[href]').each((_index, element) => {
      const link = $(element), href = link.attr('href')!;
      if (!/^\/\d+\/standings$/.test(href)) return;
      const sourceUrl = `https://labs.limitlesstcg.com${href}`;
      const content = link.children('div').first().children('div');
      rows.push({ source: 'limitless-labs', ...tournamentLocation(sourceUrl),
        name: content.first().text().trim(), dateLabel: content.eq(1).text().trim(), country: link.find('img[title]').attr('title') ?? null,
        season: Number(season[1]), format: null, sourceUrl, catalogUrl: page.sourceUrl, discoveredAt: page.lastSyncedAt });
    });
  });
  if (!rows.length || rows.some(row => !row.name || !row.dateLabel) || new Set(rows.map(row => row.sourceUrl)).size !== rows.length) throw new Error('Unrecognized or duplicate Labs catalog');
  return rows;
}
export function parseMainCatalog(page: RetrievedPage) {
  const $ = load(page.html);
  const events = $('main table.data-table tr').toArray().flatMap(element => {
    const row = $(element), anchor = row.find('a[href]').filter((_i, link) => /^\/tournaments\/\d+$/.test($(link).attr('href') ?? '')).first();
    const match = /^\/tournaments\/(\d+)$/.exec(anchor.attr('href') ?? '');
    if (!match) return [];
    const locationLabel = row.find('td').eq(1).find('img').attr('alt') ?? null;
    return [{ source: 'limitless-main' as const, externalId: match[1], division: null, locationLabel,
      name: anchor.text().trim(), dateLabel: row.find('td').first().text().trim(),
      country: locationLabel && /^[a-z]{2}$/i.test(locationLabel) ? locationLabel : null,
      season: null, format: row.find('img.format').attr('alt') ?? null,
      sourceUrl: `https://limitlesstcg.com/tournaments/${match[1]}`, catalogUrl: page.sourceUrl, discoveredAt: page.lastSyncedAt }];
  });
  if (!events.length || new Set(events.map(event => event.sourceUrl)).size !== events.length) throw new Error('Unrecognized Main catalog');
  const pagination = $('.pagination').first();
  const currentPage = Number(pagination.attr('data-current') ?? 1), maxPage = Number(pagination.attr('data-max') ?? 1);
  if (!Number.isInteger(maxPage) || maxPage < 1 || maxPage > 100 || !Number.isInteger(currentPage) || currentPage < 1 || currentPage > maxPage) throw new Error('Invalid bounded catalog pagination');
  return { events, currentPage, maxPage };
}
export function publicLabsDivisions(page: RetrievedPage): string[] {
  const { externalId } = tournamentLocation(page.sourceUrl), $ = load(page.html);
  return [...new Set($('a[href]').toArray().flatMap(element => {
    const href = $(element).attr('href') ?? '';
    return new RegExp(`^/${externalId}/(?:SR|JR)/standings$`).test(href) ? [`https://labs.limitlesstcg.com${href}`] : [];
  }))];
}
export const createLabsCatalogClient = () => createPublicHtmlClient({ origin: 'https://labs.limitlesstcg.com', paths: /^\/$/, spacingMs: 1500, label: 'Labs catalog', invalidMessage: 'Expected public Labs catalog' });
export const createMainCatalogClient = () => createPublicHtmlClient({ origin: 'https://limitlesstcg.com', paths: /^\/tournaments$/, spacingMs: 1500,
  label: 'Main catalog', invalidMessage: 'Expected bounded public Main catalog page',
  allowSearch: params => [...params.keys()].length === 1 && params.getAll('page').length === 1 && /^[1-9]\d?$|^100$/.test(params.get('page') ?? ''),
});
