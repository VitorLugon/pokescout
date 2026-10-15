// Offline fixture preparation only. Inputs are manually retrieved public pages.
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
const output = 'packages/data-sources/test/fixtures';
mkdirSync(output, { recursive: true });
const pages = [
  ['.research/standings.html', 'standings.html', 'https://labs.limitlesstcg.com/0009/standings'],
  ['.research/decklist.txt', 'decklist.html', 'https://labs.limitlesstcg.com/0009/player/0509/decklist'],
];
const captures = [];
for (const [input, filename, url] of pages) {
  const original = readFileSync(input, 'utf8');
  const $ = load(original);
  // Five actual rows: top three, a BR entrant, and one null-placement entrant.
  const standingsScript = $('script[data-url*="/standings?"]').first();
  let selected = [];
  if (standingsScript.length) {
    const envelope = JSON.parse(standingsScript.text());
    const body = JSON.parse(envelope.body);
    selected = [body.message[0], body.message[1], body.message[2], body.message[9], body.message.at(-1)];
    body.message = selected;
    envelope.body = JSON.stringify(body);
    standingsScript.text(JSON.stringify(envelope));
  }
  const rows = $('tbody tr').toArray().filter(el => {
    const href = $(el).find('a[href*="/player/"]').first().attr('href');
    return selected.some(row => href === `/0009/player/${String(row.tp_id).padStart(4, '0')}`);
  }).map(el => $.html(el)).join('\n');
  const scripts = $('script[type="application/json"][data-sveltekit-fetched]').toArray()
    .filter(el => /\/labs\/data\/tcg\/(tournament|standings|decklist)\?/.test($(el).attr('data-url') ?? ''))
    .map(el => $.html(el)).join('\n');
  // Retain source title, table structure, and selected public data blocks only.
  // Remove ads, trackers, executable scripts, login/user payload, and other entries.
  const sanitized = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${$('title').text()}</title></head><body>\n<!-- SANITIZED SAMPLE, NOT COMPLETE STANDINGS. -->\n<table><tbody>${rows}</tbody></table>\n${scripts}\n</body></html>\n`;
  writeFileSync(`${output}/${filename}`, sanitized);
  captures.push({ filename, sourceUrl: url, retrievedAt: statSync(input).mtime.toISOString(), originalSha256: createHash('sha256').update(original).digest('hex') });
}
writeFileSync(`${output}/manifest.json`, JSON.stringify({
  sourceUrl: pages[0][2], decklistUrl: pages[1][2], retrievedAt: captures[0].retrievedAt,
  scope: 'Five selected standings entries, full single public decklist; original title and embedded data envelopes retained. User/auth and executable scripts removed.', captures,
}, null, 2) + '\n');
