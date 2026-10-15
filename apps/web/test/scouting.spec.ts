import { expect, test, type Page } from '@playwright/test';
import { candidate, deck, history } from './fixtures';
import { eventDuplicate } from './evidence-fixtures';
import { evidenceFixture, groupKey, scoutingSummary } from './scouting-fixtures';

test.skip(!!process.env.POKESCOUT_LIVE_API, 'Synthetic API fixtures, independent of the live smoke.');
const path = `/#/player/${candidate.id}/scouting`;
const region = (page: Page) => page.getByRole('region', { name: 'Arquétipos publicados neste recorte', exact: true });
async function mock(page: Page) {
  const calls: string[] = [];
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); calls.push(`${route.request().method()} ${url.pathname}${url.search}`);
    const body = url.pathname.endsWith('/scouting') ? scoutingSummary : url.pathname.endsWith('/scouting/evidence') ? evidenceFixture(url.searchParams) : url.pathname.includes('/duplicate-candidates/') ? eventDuplicate : url.pathname.endsWith('/history') ? history : deck;
    await route.fulfill({ json: body });
  });
  return calls;
}

test('summary denominators represent all results rather than the first evidence page', async ({ page }) => {
  await mock(page); await page.goto(path);
  await expect(region(page).getByText('Atendem aos filtros', { exact: true }).locator('..')).toContainText('18');
  await expect(region(page).getByText('Com arquétipo conhecido', { exact: true }).locator('..')).toContainText('15');
  await expect(region(page).getByText('Com arquétipo desconhecido', { exact: true }).locator('..')).toContainText('1');
  await expect(region(page).getByText('12 de 15', { exact: true })).toBeVisible();
  await expect(region(page).getByText('80,0%', { exact: true })).toBeVisible();
  await expect(region(page).locator('.results, .result')).toHaveCount(10);
  await expect(region(page).getByText(/Não estimam o próximo deck/)).toBeVisible();
});

test('filters preserve literal regional values, account for undated results and clear without undefined parameters', async ({ page }) => {
  const calls = await mock(page); await page.goto(path);
  await region(page).getByText('Filtrar período, formato e divisão', { exact: true }).click();
  await region(page).getByLabel('Data inicial (inclusive)').fill('2026-05-24');
  await region(page).getByLabel('Data final (inclusive)').fill('2026-06-01');
  await region(page).getByLabel('Formato da fonte', { exact: true }).selectOption('value:standard-jp');
  await region(page).getByLabel('Divisão da fonte', { exact: true }).selectOption('unknown');
  await region(page).getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect.poll(() => calls.some(call => call.includes('/scouting?') && call.includes('from=2026-05-24') && call.includes('to=2026-06-01') && call.includes('format=standard-jp') && call.includes('divisionMode=unknown'))).toBe(true);
  await region(page).getByLabel('Datas do evento').selectOption('unknown');
  await expect(region(page).getByLabel('Data inicial (inclusive)')).toBeDisabled();
  await region(page).getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect.poll(() => calls.some(call => call.includes('dateState=unknown'))).toBe(true);
  expect(calls.some(call => call.includes('undefined'))).toBe(false);
  await region(page).getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(region(page).getByLabel('Formato da fonte', { exact: true })).toHaveValue('all');
  await expect(region(page).getByLabel('Data inicial (inclusive)')).toHaveValue('');
});

test('archetype evidence pagination and imported-list back navigation preserve filters and group', async ({ page }) => {
  const calls = await mock(page); await page.goto(path);
  await region(page).getByRole('button', { name: 'Ver resultados de Dragapult ex', exact: true }).click();
  await expect(region(page).getByText('12 resultados publicados de fonte neste conjunto.', { exact: true })).toBeVisible();
  await region(page).getByRole('button', { name: 'Próxima' }).click();
  await expect(region(page).getByText('Página 2', { exact: true })).toBeVisible();
  await expect(region(page).locator('.result')).toHaveCount(2);
  await region(page).getByRole('link', { name: 'Abrir lista histórica' }).first().click();
  await expect(page.getByRole('heading', { name: 'Dragapult ex', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar ao histórico', exact: true }).click();
  await expect(region(page).getByRole('heading', { name: 'Dragapult ex', exact: true }).last()).toBeVisible();
  await expect(region(page).getByText('Página 2', { exact: true })).toBeVisible();
  expect(calls.some(call => call.includes('offset=10') && new URL(call.slice(4), 'http://local').searchParams.get('group') === groupKey)).toBe(true);
  expect(calls.every(call => call.startsWith('GET '))).toBe(true);
});

test('unknown archetypes and excluded duplicate evidence remain inspectable without changing eligibility', async ({ page }) => {
  await mock(page); await page.goto(path);
  await region(page).getByRole('button', { name: 'Arquétipos desconhecidos (1)', exact: true }).click();
  await expect(region(page).getByText('1 resultados publicados de fonte neste conjunto.', { exact: true })).toBeVisible();
  await expect(region(page).locator('.result')).toHaveCount(1);
  await region(page).getByRole('button', { name: 'Ver possíveis duplicações (2)', exact: true }).click();
  await expect(region(page).locator('.result')).toHaveCount(2);
  await region(page).getByRole('link', { name: /Consultar possível evento duplicado/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Possível evento duplicado', exact: true })).toBeVisible();
  await page.goBack(); await expect(region(page).getByRole('heading', { name: 'Excluídos por possível duplicação', exact: true })).toBeVisible();
  await expect(region(page).getByText('Resultados elegíveis', { exact: true }).locator('..')).toContainText('16');
});

test('summary and evidence errors, stale revision and retry are explicit', async ({ page }) => {
  await mock(page); let status = 404;
  await page.route('**/api/players/*/scouting?**', route => route.fulfill({ status, json: status === 200 ? scoutingSummary : {} }));
  await page.goto(path); await expect(region(page).getByRole('alert')).toContainText('Identidade não encontrada');
  status = 200; await region(page).getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(region(page).getByText('12 de 15', { exact: true })).toBeVisible();
  await page.route('**/api/players/*/scouting/evidence?**', route => route.fulfill({ status: 500, json: {} }));
  await region(page).getByRole('button', { name: 'Todos os resultados filtrados' }).click();
  await expect(region(page).getByRole('alert')).toBeVisible();
  await page.route('**/api/players/*/scouting/evidence?**', route => route.fulfill({ json: { ...evidenceFixture(new URL(route.request().url()).searchParams), revision: 'changed' } }));
  await region(page).getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(region(page).getByText(/Os dados mudaram entre as consultas/)).toBeVisible();
  await expect(region(page).locator('.result')).toHaveCount(0);
  await page.route('**/api/players/*/scouting/evidence?**', route => route.fulfill({ json: evidenceFixture(new URL(route.request().url()).searchParams) }));
  await region(page).getByRole('button', { name: 'Atualizar recorte' }).click();
  await expect(region(page).locator('.result')).toHaveCount(10);
});

test('filter changes ignore an older response arriving later', async ({ page }) => {
  await mock(page); let requested = false;
  await page.route('**/api/players/*/scouting?**', async route => {
    const old = new URL(route.request().url()).searchParams.get('format') === 'standard';
    if (old) { requested = true; await new Promise(resolve => setTimeout(resolve, 1200)); }
    const body = structuredClone(scoutingSummary); body.groups[0].name = old ? 'Resumo antigo' : 'Resumo novo';
    await route.fulfill({ json: body }).catch(() => {});
  });
  await page.goto(path); await region(page).getByText('Filtrar período, formato e divisão', { exact: true }).click();
  await region(page).getByLabel('Formato da fonte', { exact: true }).selectOption('value:standard'); await region(page).getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect.poll(() => requested).toBe(true);
  await region(page).getByLabel('Formato da fonte', { exact: true }).selectOption('value:standard-jp'); await region(page).getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(region(page).getByRole('heading', { name: 'Resumo novo', exact: true })).toBeVisible();
  await page.waitForTimeout(1300); await expect(region(page).getByRole('heading', { name: 'Resumo antigo', exact: true })).toHaveCount(0);
});

test('unknown-only and empty slices never display an invented zero percentage', async ({ page }) => {
  await mock(page); let empty = false;
  await page.route('**/api/players/*/scouting?**', route => route.fulfill({ json: { ...scoutingSummary, groups: [], counts: { ...scoutingSummary.counts, matchingResults: empty ? 0 : 1, eligibleResults: empty ? 0 : 1, knownArchetypeResults: 0, unknownArchetypeResults: empty ? 0 : 1 } } }));
  await page.goto(path); await expect(region(page).getByText(/Não há denominador para percentuais/)).toBeVisible();
  await expect(region(page).getByText('0,0%', { exact: true })).toHaveCount(0);
  empty = true; await region(page).getByText('Filtrar período, formato e divisão', { exact: true }).click();
  await region(page).getByLabel('Datas do evento').selectOption('known'); await region(page).getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(region(page).getByText(/Nenhum resultado atende aos filtros/)).toBeVisible();
});

test('mobile summary/filter layout, keyboard and navigation preserve context at 320/390px', async ({ page }) => {
  await mock(page); await page.goto(`/#/player/${candidate.id}`);
  const link = page.getByRole('link', { name: 'Arquétipos publicados e filtros' }); await link.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Arquétipos publicados neste recorte', exact: true })).toBeFocused();
  await region(page).getByText('Filtrar período, formato e divisão', { exact: true }).click();
  for (const width of [320,390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(region(page).getByText('12 de 15', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `../../.cache/milestone-6-overview-${width}.png` });
    await region(page).locator('.summary-counts').screenshot({ path: `../../.cache/milestone-6-counts-${width}.png` });
    await region(page).locator('.archetype-groups').screenshot({ path: `../../.cache/milestone-6-groups-${width}.png` });
  }
  await region(page).getByLabel('Formato da fonte', { exact: true }).selectOption('value:standard-jp'); await region(page).getByRole('button', { name: 'Aplicar filtros' }).click();
  await region(page).getByRole('link', { name: 'Voltar ao histórico', exact: true }).click();
  await page.getByRole('link', { name: 'Arquétipos publicados e filtros' }).click();
  await expect(region(page).getByLabel('Formato da fonte', { exact: true })).toHaveValue('value:standard-jp');
});
