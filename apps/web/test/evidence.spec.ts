import { expect, test, type Page } from '@playwright/test';
import { candidate, other, history, entry } from './fixtures';
import { comparison, eventDuplicate, resultDuplicate, eventId, resultId } from './evidence-fixtures';

test.skip(!!process.env.POKESCOUT_LIVE_API, 'Offline evidence fixtures, separate from the real local smoke.');
const comparePath = `/#/compare/${candidate.id}/${other.id}`;
async function mock(page: Page) {
  const calls: string[] = [];
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); calls.push(`${route.request().method()} ${url.pathname}${url.search}`);
    let body: unknown = {};
    if (url.pathname === '/api/players') body = { matches: [candidate, other, { ...candidate, id: '44444444-4444-4444-8444-444444444444', displayName: 'Terceiro candidato', identities: [{ source: 'limitless-main', scope: 'global', externalId: '99' }] }], truncated: false };
    if (url.pathname.endsWith('/history')) body = { ...history, entries: [{ ...entry, duplicateResultsAsA: [{ id: resultId }], tournament: { ...entry.tournament, duplicateEventsAsA: [{ id: eventId }] } }] };
    if (url.pathname === '/api/identity-reviews/compare') body = comparison;
    if (url.pathname.includes('/duplicate-candidates/')) body = url.pathname.includes('/result/') ? resultDuplicate : eventDuplicate;
    await route.fulfill({ json: body });
  });
  return calls;
}
async function select(page: Page) {
  await page.goto('/'); await page.getByLabel('Nome do jogador').fill('João 山田');
  await expect(page.getByRole('checkbox',{name:/Selecionar para comparar/})).toHaveCount(3);
  await page.getByRole('checkbox', { name: /ID 42$/ }).check();
  await page.getByRole('checkbox', { name: /ID 84$/ }).check();
}

test('exactly two candidates, removal, search changes and browser back preserve selection', async ({ page }) => {
  await mock(page); await select(page);
  await expect(page.getByRole('checkbox', { name: /Terceiro candidato/ })).toBeDisabled();
  await page.getByLabel('Nome do jogador').fill('Outro nome');
  await expect(page.getByRole('button', { name: 'Comparar selecionados' })).toBeEnabled();
  await page.getByRole('button', { name: 'Remover João 山田, ID 42', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Comparar selecionados' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /ID 42$/ }).check();
  await page.getByRole('button', { name: 'Comparar selecionados' }).click();
  await expect(page.getByRole('heading', { name: /Duas identidades/ })).toBeVisible();
  await page.goBack(); await expect(page.getByLabel('Nome do jogador')).toHaveValue('Outro nome');
  await expect(page.getByRole('checkbox', { name: /ID 84$/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /ID 42$/ })).toBeChecked();
});

test('cross-source evidence, nulls, truncation and contradictory reviews remain separate and safe', async ({ page }) => {
  const calls = await mock(page); await page.goto(comparePath);
  await expect(page.locator('.identities').getByText('Limitless · site principal · ID 42', { exact: true })).toBeVisible();
  await expect(page.getByText('Limitless Labs · ID 84', { exact: true })).toBeVisible();
  await expect(page.getByText(/Países informados neste recorte: Não informado/)).toBeVisible();
  await expect(page.getByText(/Evidência limitada:/)).toBeVisible();
  await expect(page.getByText(/Revisões truncadas:/)).toBeVisible();
  await expect(page.getByText(/Existem avaliações contraditórias/)).toBeVisible();
  await expect(page.getByText('Avaliação: mesma pessoa', { exact: true })).toBeVisible();
  await expect(page.getByText('Avaliação: pessoas diferentes', { exact: true })).toBeVisible();
  await expect(page.getByText('Avaliação: identidade incerta', { exact: true })).toBeVisible();
  await expect(page.getByText(/Os jogadores, identificadores e históricos continuam separados/)).toBeVisible();
  await expect(page.locator('.comparison-players > article')).toHaveCount(2);
  await expect(page.locator('.comparison-players > article').first()).toContainText('101');
  await expect(page.locator('.review script, .review img, a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.getByText('<script>window.bad = true</script> Avaliação sintética.', { exact: true })).toHaveCount(3);
  await expect(page.getByText('Link de origem não informado', { exact: true })).toHaveCount(3);
  expect(calls.some(url => url.includes('view=summary'))).toBe(true); expect(calls.every(url => url.startsWith('GET '))).toBe(true);
});

test('changing comparison ignores an old response even when it finishes later', async ({ page }) => {
  await mock(page); let oldRequested = false;
  await page.route('**/api/identity-reviews/compare?**', async route => {
    const a = new URL(route.request().url()).searchParams.get('playerAId');
    if (a === candidate.id) { oldRequested = true; await new Promise(resolve => setTimeout(resolve, 1200)); }
    const body = structuredClone(comparison); body.players[0].displayName = a === candidate.id ? 'Comparação antiga' : 'Comparação nova';
    await route.fulfill({ json: body }).catch(() => {});
  });
  await page.goto(comparePath); await expect.poll(() => oldRequested).toBe(true);
  await page.evaluate(([a, b]) => { window.location.hash = `/compare/${b}/${a}`; }, [candidate.id, other.id]);
  await expect(page.getByRole('heading', { name: 'Comparação nova', exact: true })).toBeVisible();
  await page.waitForTimeout(1300);
  await expect(page.getByRole('heading', { name: 'Comparação antiga', exact: true })).toHaveCount(0);
});

test('comparison missing identities, errors, retry and empty assessments', async ({ page }) => {
  await mock(page); let status = 404;
  await page.route('**/api/identity-reviews/compare?**', route => route.fulfill({ status, json: status === 200 ? { ...comparison, reviews: [], reviewsTotal: 0, reviewsTruncated: false, reviewDecisionsConflict: false, players: comparison.players.map(player => ({ ...player, entries: [], resultCount: 0, historyTruncated: false })) } : {} }));
  await page.goto(comparePath); await expect(page.getByRole('alert')).toContainText('não foi encontrada');
  status = 503; await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível');
  status = 200; await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText('Nenhuma avaliação registrada para este par.', { exact: true })).toBeVisible();
  await expect(page.getByText('Nenhum resultado disponível neste recorte.', { exact: true })).toHaveCount(2);
});

test('duplicate result from history exposes both representations and related event; back preserves history', async ({ page }) => {
  await mock(page); await page.goto(`/#/player/${candidate.id}`);
  await page.getByRole('link', { name: /Consultar possível resultado duplicado/ }).click();
  await expect(page.getByRole('heading', { name: 'Possível resultado duplicado', exact: true })).toBeVisible();
  await expect(page.getByText('Nome normalizado compatível', { exact: true })).toBeVisible();
  await expect(page.getByText('ID do resultado na fonte', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Possível resultado duplicado', exact: true }).getByText('Não informado', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Resultado na fonte' })).toHaveCount(2);
  await page.getByRole('link', { name: /Consultar o par de eventos relacionado/ }).click();
  await expect(page.getByRole('heading', { name: 'Possível evento duplicado', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar às evidências anteriores' }).click();
  await expect(page.getByText('Página 1', { exact: true })).toBeVisible();
});

test('duplicate event from comparison retains both source IDs, URLs and timestamps', async ({ page }) => {
  await mock(page); await page.goto(comparePath);
  await page.getByRole('link', { name: /Consultar possível evento duplicado/ }).click();
  await expect(page.getByText('Mesmo país anfitrião', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Possível evento duplicado', exact: true }).getByText(/Dados do evento obtidos em/)).toHaveCount(2);
  const links = page.getByRole('link', { name: 'Torneio na fonte' });
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute('href', eventDuplicate.tournaments[0].sourceUrl);
  await expect(links.nth(1)).toHaveAttribute('href', eventDuplicate.tournaments[1].sourceUrl);
  await page.goBack(); await expect(page.getByRole('heading', { name: /Duas identidades/ })).toBeVisible();
});

test('duplicate errors and missing records never start a write or synchronization', async ({ page }) => {
  const calls = await mock(page); let status = 404;
  await page.route('**/api/duplicate-candidates/**', route => route.fulfill({ status, json: status === 200 ? eventDuplicate : {} }));
  await page.goto(`/#/player/${candidate.id}/duplicate/event/${eventId}`);
  await expect(page.getByRole('alert')).toContainText('não encontrado');
  status = 500; await page.getByRole('button', { name: 'Tentar novamente' }).click(); await expect(page.getByRole('alert')).toContainText('Não foi possível');
  status = 200; await page.getByRole('button', { name: 'Tentar novamente' }).click(); await expect(page.getByText('Mesmo país anfitrião', { exact: true })).toBeVisible();
  expect(calls.every(url => url.startsWith('GET '))).toBe(true);
});

test('source coverage and local import completeness are explained independently', async ({ page }) => {
  await mock(page); const body = structuredClone(comparison);
  body.players[0].entries[0].tournament.resultsCoverage = 'UNKNOWN';
  body.players[1].entries[0].tournament.resultsCoverage = 'COMPLETE_STANDINGS';
  await page.route('**/api/identity-reviews/compare?**', route => route.fulfill({ json: body }));
  await page.goto(comparePath);
  await expect(page.getByText('Cobertura não informada', { exact: true })).toBeVisible();
  await expect(page.getByText('Standings completos na fonte', { exact: true })).toBeVisible();
  await expect(page.getByText('Importação parcial: resultados ou listas podem estar ausentes.', { exact: true })).toHaveCount(2);
  await page.getByText('Como interpretar cobertura e importação', { exact: true }).first().click();
  await expect(page.getByText(/Uma fonte pode publicar standings completos/).first()).toBeVisible();
});

test('320 and 390px comparison/duplicate layouts and keyboard selection', async ({ page }) => {
  await mock(page); await select(page);
  const button = page.getByRole('button', { name: 'Comparar selecionados' }); await button.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Duas identidades/ })).toBeFocused();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `../../.cache/milestone-5-comparison-${width}.png`, fullPage: true });
    await page.locator('.comparison-players > article').first().screenshot({ path: `../../.cache/milestone-5-player-${width}.png` });
  }
  await page.locator('.reviews').screenshot({ path: '../../.cache/milestone-5-reviews.png' });
  await page.getByRole('link', { name: /Consultar possível evento duplicado/ }).click();
  await expect(page.getByRole('heading', { name: 'Possível evento duplicado', exact: true })).toBeFocused();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `../../.cache/milestone-5-duplicate-${width}.png`, fullPage: true });
  }
});
