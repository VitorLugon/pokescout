import { load } from 'cheerio';
import { z } from 'zod';
import { publicEventDate, type DeckCard } from '@tcg-scout/shared';
import type { MainTournament } from './types.js';
const base = 'https://limitlesstcg.com';
const nullableText = (value?: string | null) => value?.trim() || null;
export function mainTournamentLocation(url: string) {
  const value = new URL(url);
  const match = /^\/tournaments\/([1-9]\d*)$/.exec(value.pathname);
  if (value.origin !== base || value.username || value.password || value.search || value.hash || !match) throw new Error('Expected a public Main tournament URL');
  return { source: 'limitless-main' as const, externalId: match[1], division: null };
}
function archetype(href?: string) {
  if (!href) return null;
  const url = new URL(href, base);
  if (url.origin !== base || !/^\/decks\/\d+$/.test(url.pathname)) throw new Error('Unexpected archetype URL');
  return url.pathname.split('/').at(-1)! + (url.searchParams.has('variant') ? `:variant=${url.searchParams.get('variant')}` : '');
}
export function parseMainTournament(html: string, sourceUrl: string, catalogHtml = ''): MainTournament {
  const { externalId } = mainTournamentLocation(sourceUrl);
  const $ = load(html), catalog = load(catalogHtml);
  if (catalogHtml && !catalog('a[href^="/tournaments/"]').length) throw new Error('Unrecognized public Main catalog; stopped');
  const box = $('.before-content .infobox').first();
  const name = box.find('.infobox-heading').text().trim();
  const detail = box.find('.infobox-line').text().replace(/\s+/g, ' ').trim();
  if (!name || !detail) throw new Error('Main tournament header is missing');
  const dateLabel = detail.split('•')[0].trim();
  if (!publicEventDate(dateLabel)) throw new Error('Unrecognized Main tournament date');
  const countText = /([\d,]+)\*?\s+Players/i.exec(detail)?.[1];
  const row = catalog(`a[href="/tournaments/${externalId}"]`).closest('tr');
  const locationLabel = nullableText(box.find('.infobox-heading img.flag').attr('alt'));
  const results = $('main table.data-table tr[data-rank]').toArray().map((element, index) => {
    const tr = $(element);
    const link = tr.find('a[href^="/players/"]').first();
    const playerId = /^\/players\/(\d+)$/.exec(link.attr('href') ?? '')?.[1] ?? null;
    const originalName = (link.length ? link.text() : tr.attr('data-name') ?? tr.find('td').eq(1).text()).trim();
    const rank = tr.attr('data-rank');
    const placement = rank && /^\d+$/.test(rank) ? Number(rank) : null;
    const deckLink = tr.find('a[href^="/decks/"]:not([href^="/decks/list/"])').first();
    const listLink = tr.find('a[href^="/decks/list/"]').first().attr('href');
    if (!originalName || (placement !== null && placement < 1)) throw new Error('Invalid Main result row');
    if (listLink && !/^\/decks\/list\/\d+$/.test(listLink)) throw new Error('Unexpected list URL');
    return {
      entryId: playerId ?? `row:${rank ?? 'unknown'}:${index}`, playerId, name: originalName,
      country: nullableText(tr.attr('data-country') ?? tr.find('td').eq(2).find('img.flag').attr('alt')),
      placement, archetypeId: archetype(deckLink.attr('href')),
      archetypeName: nullableText(tr.attr('data-deck') ?? deckLink.find('[data-tooltip]').attr('data-tooltip')),
      decklistUrl: listLink ? new URL(listLink, base).href : null,
    };
  });
  if (!results.length) throw new Error('Missing Main results');
  const counts = new Map<string, number>();
  for (const result of results) counts.set(result.entryId,(counts.get(result.entryId) ?? 0)+1);
  // A profile link is not a unique result ID when the source repeats it in this event.
  // Retain every conflicting published row for review rather than merging or inventing IDs.
  const quarantinedResults = results.filter(result => counts.get(result.entryId)! > 1);
  return {
    externalId, name, dateLabel, locationLabel, country: locationLabel && /^[a-z]{2}$/i.test(locationLabel) ? locationLabel : null,
    format: nullableText(row.find('img.format').attr('alt')), formatLabel: nullableText(row.find('img.format').attr('data-tooltip')),
    reportedPlayerCount: countText ? Number(countText.replaceAll(',', '')) : null,
    approximate: box.find('.apc').length > 0,
    notes: nullableText($('main p').text()),
    relatedSourceUrls: $('a[href^="https://labs.limitlesstcg.com/"]').toArray().map(el => $(el).attr('href')!).filter(href => /\/\d+(?:\/(?:SR|JR))?\/standings$/.test(href)),
    publishedResultCount: results.length, quarantinedResults,
    results: results.filter(result => counts.get(result.entryId) === 1),
  };
}
export function parseMainDecklist(html: string): DeckCard[] {
  const $ = load(html);
  const cards: DeckCard[] = [];
  $('[data-text-decklist] .decklist-column').each((_index, element) => {
    const column = $(element), heading = column.find('.decklist-column-heading').text().trim();
    const category = /^Pokémon\b/u.test(heading) ? 'pokemon' : /^Trainer\b/.test(heading) ? 'trainer' : /^Energy\b/.test(heading) ? 'energy' : null;
    if (!category) throw new Error('Unrecognized card category');
    column.find('.decklist-card').each((_row, el) => {
      const card = $(el);
      const value = z.object({ count: z.number().int().positive(), name: z.string().min(1), set: z.string().min(1), number: z.string().min(1), language: z.string().min(1).nullable() }).parse({
        count: Number(card.find('.card-count').text().trim()), name: card.find('.card-name').text().trim(), set: card.attr('data-set'), number: card.attr('data-number'), language: card.attr('data-lang') ?? null,
      });
      cards.push({ ...value, category });
    });
  });
  if (!cards.length) throw new Error('Main public decklist is missing');
  return cards;
}
export function parseMainPlayerHistory(html: string, sourceUrl: string) {
  const url = new URL(sourceUrl);
  const match = /^\/players\/(\d+)(?:\/results)?$/.exec(url.pathname);
  if (url.origin !== base || url.search || url.hash || !match) throw new Error('Expected a public Main player history URL');
  const $ = load(html);
  const name = $('.infobox-heading').first().text().trim();
  if (!name) throw new Error('Missing Main player header');
  const finishes = $('main table').first().find('tr').toArray().flatMap(el => {
    const row = $(el), event = row.find('a[href^="/tournaments/"]').first();
    const id = /^\/tournaments\/(\d+)$/.exec(event.attr('href') ?? '')?.[1];
    if (!id) return [];
    const place = /^(\d+)(?:st|nd|rd|th)?$/.exec(row.find('td').eq(2).text().trim());
    const deck = row.find('a[href^="/decks/"]:not([href^="/decks/list/"])').first();
    const list = row.find('a[href^="/decks/list/"]').attr('href');
    return [{ tournamentExternalId: id, sourceUrl: `${base}/tournaments/${id}`, dateLabel: row.find('td').first().text().trim(), tournamentName: event.text().trim(), placement: place ? Number(place[1]) : null,
      archetypeId: archetype(deck.attr('href')), archetypeName: nullableText(deck.find('[data-tooltip]').attr('data-tooltip')), decklistUrl: list ? new URL(list, base).href : null }];
  });
  return { playerExternalId: match[1], name, country: nullableText($('.infobox-heading img.flag').first().attr('alt')), coverage: 'PUBLISHED_HISTORY_PAGE' as const, finishes, completeHistoryClaimed: false };
}
