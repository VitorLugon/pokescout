import { expect, test, type Page } from '@playwright/test';
import { candidate, other, deck, entry, history } from './fixtures';

test.skip(!!process.env.POKESCOUT_LIVE_API, 'Offline browser tests run independently of the live smoke.');
async function mock(page: Page) {
  const calls: string[] = [];
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); calls.push(url.pathname + url.search);
    const body = url.pathname === '/api/players' ? { matches: [candidate, other], truncated: false } : url.pathname.endsWith('/history') ? (url.searchParams.get('offset') === '10' ? { ...history, entries: [{ ...entry, id: 'next-entry', tournament: { ...entry.tournament, name: 'Segunda página' } }], offset: 10, truncated: false } : history) : deck;
    await route.fulfill({ json: body });
  });
  return calls;
}
async function search(page: Page) { await page.goto('/'); await page.getByLabel('Nome do jogador').fill('João 山田'); await expect(page.getByRole('heading', { name: 'Identidades encontradas' })).toBeVisible(); }
async function openHistory(page: Page) { await search(page); await page.getByRole('link', { name: /Consultar histórico de.*limitless-main/ }).click(); await expect(page.getByRole('heading', { name: candidate.displayName, exact: true })).toBeVisible(); }

test('international search keeps ambiguous identities separate and uses existing normalization', async ({ page }) => {
  const calls = await mock(page); await search(page);
  await expect(page.locator('.candidate')).toHaveCount(2);
  await expect(page.getByText('ID 42 · escopo global')).toBeVisible();
  await expect(page.getByText('ID 84 · escopo global')).toBeVisible();
  expect(calls.filter(url => url.startsWith('/api/players?'))).toHaveLength(1);
  expect(new URL(calls[0], 'http://local').searchParams.get('name')).toBe('joao 山田');
  await expect(page.getByText(/Há outro candidato/)).toHaveCount(2);
});

test('debounce and out-of-order searches never replace the newest results', async ({ page }) => {
  let oldRequested = false;
  await page.route('**/api/players?**', async route => {
    const name = new URL(route.request().url()).searchParams.get('name');
    if (name === 'antigo') { oldRequested = true; await new Promise(resolve => setTimeout(resolve, 1000)); }
    await route.fulfill({ json: { matches: [{ ...candidate, displayName: name === 'antigo' ? 'Resultado antigo' : 'Resultado novo' }], truncated: false } }).catch(() => {});
  });
  await page.goto('/'); const input = page.getByLabel('Nome do jogador');
  await input.fill('a'); await expect(page.getByText('Buscando jogadores…')).toHaveCount(0);
  await input.fill('antigo'); await expect.poll(() => oldRequested).toBe(true);
  await input.fill('novo'); await expect(page.getByRole('heading', { name: 'Resultado novo' })).toBeVisible();
  await page.waitForTimeout(1100);
  await expect(page.getByRole('heading', { name: 'Resultado antigo' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Resultado novo' })).toBeVisible();
});

test('partial history preserves nulls, regional formats, provenance and duplicate warnings', async ({ page }) => {
  await mock(page); await openHistory(page);
  await expect(page.getByText('Não informado / standard-jp', { exact: true })).toBeVisible();
  await expect(page.getByText('Recorde histórico').locator('..')).toContainText('Não informado');
  await expect(page.getByText(/País anfitrião: KR/)).toBeVisible();
  await expect(page.getByText('País do jogador informado').locator('..')).toContainText('JP');
  await expect(page.getByText('Cobertura parcial · resultados selecionados')).toBeVisible();
  await expect(page.getByText(/Possível resultado duplicado/)).toBeVisible();
  await expect(page.getByText(/Não equivalem a participações únicas/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Resultado na fonte' })).toHaveAttribute('href', entry.sourceUrl);
  await page.screenshot({ path: '../../.cache/milestone-4-history-mobile.png', fullPage: true });
});

test('pagination uses API offsets; browser back preserves page and search', async ({ page }) => {
  const calls = await mock(page); await openHistory(page);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.getByRole('heading', { name: 'Segunda página' })).toBeVisible();
  expect(calls.some(url => url.includes('limit=10&offset=10'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Próxima' })).toBeDisabled();
  await page.getByRole('link', { name: 'Abrir lista histórica' }).click();
  await expect(page.getByRole('heading', { name: 'Dragapult ex', exact: true })).toBeVisible();
  await page.goBack(); await expect(page.getByText('Página 2', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar à busca' }).click();
  await expect(page.getByLabel('Nome do jogador')).toHaveValue('João 山田');
  await expect(page.locator('.candidate')).toHaveCount(2);
});

test('imported historical cards retain quantities, Unicode and printing identifiers', async ({ page }) => {
  const calls = await mock(page); await openHistory(page);
  await page.getByRole('link', { name: 'Abrir lista histórica' }).click();
  await expect(page.getByText('ドラパルトex', { exact: true })).toBeVisible();
  await expect(page.getByText(/TWM · 130 · Idioma: ja/)).toBeVisible();
  await expect(page.getByText(/Ela não informa o deck atual/)).toBeVisible();
  expect(calls.filter(url => url.endsWith('/decklist'))).toHaveLength(1);
});

test('missing imported list is a read-only empty state', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/')) requests.push(request.method()); });
  await mock(page);
  await page.route('**/api/entries/*/decklist', route => route.fulfill({ status: 404, json: { error: 'No successfully imported decklist' } }));
  await page.goto(`/#/player/${candidate.id}/entry/${entry.id}`);
  await expect(page.getByText(/Nenhuma lista importada disponível/)).toBeVisible();
  expect(requests.every(method => method === 'GET')).toBe(true);
});

test('source availability, missing data and failed extraction remain distinct', async ({ page }) => {
  await mock(page);
  const variants = [
    { ...entry, id: 'unavailable', placement: null, country: null, deck: { ...deck, archetypeName: null, availableAtSource: false, listImportedAt: null, listStatus: 'UNAVAILABLE' } },
    { ...entry, id: 'pending', deck: { ...deck, listImportedAt: null, listStatus: 'AVAILABLE' } },
    { ...entry, id: 'failed', deck: { ...deck, listImportedAt: null, listStatus: 'FAILED' } },
  ];
  await page.route('**/api/players/*/history?**', route => route.fulfill({ json: { ...history, entries: variants, total: 3, truncated: false } }));
  await openHistory(page);
  await expect(page.getByText('Lista indisponível na fonte', { exact: true })).toBeVisible();
  await expect(page.getByText('Disponível na fonte · ainda não importada', { exact: true })).toBeVisible();
  await expect(page.getByText('Falha de extração · sem lista importada', { exact: true })).toBeVisible();
  await expect(page.getByText('Colocação não informada', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir lista histórica' })).toHaveCount(0);
});

test('search error, retry, empty results and truncation are actionable', async ({ page }) => {
  await mock(page); let fail = true;
  await page.route('**/api/players?**', route => route.fulfill(fail ? { status: 500, json: { error: 'Internal server error' } } : { json: { matches: [], truncated: false } }));
  await page.goto('/'); await page.getByLabel('Nome do jogador').fill('Nada');
  await expect(page.getByRole('alert')).toContainText('Não foi possível consultar');
  fail = false; await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText(/Nenhum jogador encontrado/)).toBeVisible();
  await page.route('**/api/players?**', route => route.fulfill({ json: { matches: [candidate], truncated: true } }));
  await page.getByLabel('Nome do jogador').fill('João');
  await expect(page.getByText(/Exibindo até 30 candidatos/)).toBeVisible();
});

test('history/list failures can be retried; previous valid list survives failed refresh', async ({ page }) => {
  await mock(page); let failHistory = true; let failDeck = true;
  await page.route('**/api/players/*/history?**', route => route.fulfill(failHistory ? { status: 503, json: {} } : { json: history }));
  await page.goto(`/#/player/${candidate.id}`);
  await expect(page.getByRole('alert')).toBeVisible(); failHistory = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await page.route('**/api/entries/*/decklist', route => route.fulfill(failDeck ? { status: 500, json: {} } : { json: { ...deck, listStatus: 'FAILED' } }));
  await page.getByRole('link', { name: 'Abrir lista histórica' }).click();
  await expect(page.getByRole('alert')).toBeVisible(); failDeck = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText(/Esta é a última lista importada/)).toBeVisible();
  await expect(page.getByText('ドラパルトex', { exact: true })).toBeVisible();
});

test('320px layout, touch targets and keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mock(page); await page.goto('/');
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Ir para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('main')).toBeFocused();
  await page.getByLabel('Nome do jogador').fill('João 山田');
  await expect(page.locator('.candidate')).toHaveCount(2);
  const button = page.getByRole('link', { name: /Consultar histórico de.*limitless-main/ });
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '../../.cache/milestone-4-search-320.png', fullPage: true });
  await button.click(); await expect(page.getByText('Não informado / standard-jp', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
