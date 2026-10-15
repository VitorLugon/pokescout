import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
const directory = 'packages/data-sources/test/fixtures/international';
mkdirSync(directory, { recursive: true });
const captures = JSON.parse(readFileSync('.research/m35/captures.json', 'utf8'));
const manifest = [];
for (const capture of captures) {
  if (capture.key === 'main-robots') continue;
  const original = readFileSync(`.research/m35/${capture.key}.html`, 'utf8');
  const $ = load(original);
  let content = '', sample = false;
  if (capture.key.startsWith('labs-')) {
    const scripts = $('script[data-sveltekit-fetched]').toArray().filter(el => /\/data\/tcg\/(tournament|standings|decklist)\?/.test($(el).attr('data-url') ?? ''));
    for (const element of scripts) {
      if ($(element).attr('data-url').includes('/standings?')) {
        const envelope = JSON.parse($(element).text()), data = JSON.parse(envelope.body);
        const selected = data.message.slice(0, 4);
        for (const extra of [data.message.find(row => /[^\x00-\x7F]/.test(row.name)), data.message.find(row => row.country === 'JP')]) if (extra && !selected.includes(extra)) selected.push(extra);
        data.message = selected; envelope.body = JSON.stringify(data); $(element).text(JSON.stringify(envelope)); sample = true;
      }
    }
    content = scripts.map(el => $.html(el)).join('\n');
  } else if (capture.key === 'main-index') {
    const rows = $('table tr').toArray().filter(el => $(el).find('a[href="/tournaments/569"],a[href="/tournaments/567"],a[href="/tournaments/515"]').length);
    content = `<main><table>${rows.map(el => $.html(el)).join('\n')}</table></main>`;
    sample = true;
  } else if (capture.key.endsWith('-list')) {
    const wrapper = $('[data-text-decklist]').first();
    wrapper.find('.card-price,script,button,iframe').remove();
    content = `<main>${$.html(wrapper)}</main>`;
  } else if (capture.key.startsWith('profile-')) {
    content = `<main>${$.html($('.infobox').first())}${$.html($('main table').first())}</main>`;
  } else {
    if (capture.key === 'main-world-observation') { $('main table tr[data-rank]').slice(4).remove(); sample = true; }
    content = `<div class="before-content">${$.html($('.before-content .infobox').first())}</div><main>${$.html($('main table').first())}${$('main p').toArray().map(el=>$.html(el)).join('\n')}</main>`;
  }
  // Keep parser structure; remove executable code and all unrelated account/advertising markup.
  const sanitized = `<!doctype html><html><head><meta charset="utf-8"><title>${$('title').text()}</title></head><body>${content}</body></html>`;
  writeFileSync(`${directory}/${capture.key}.html`, sanitized);
  manifest.push({ ...capture, selectedFixtureRows: sample, originalSha256: createHash('sha256').update(original).digest('hex') });
}
writeFileSync(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2));
