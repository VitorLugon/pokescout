import { expect, test } from '@playwright/test';
import type { IdentityComparison, PlayerHistoryResponse, PlayerSearchResponse, ScoutingSummary, ScoutingEvidence, TournamentCatalogResponse } from '@tcg-scout/shared';

test.skip(!process.env.POKESCOUT_LIVE_API, 'Opt-in: existing local API and PostgreSQL are required; no imports are performed.');

test('real catalog exposes every database page and serves Pokémon sprites locally',async({page,request})=>{
  const ids=new Set<string>();let total=0;
  for(let offset=0;offset===0||offset<total;offset+=100){
    const response=await request.get(`/api/tournament-catalog?limit=100&offset=${offset}`);expect(response.ok(),`Catalog offset ${offset}, HTTP ${response.status()}`).toBe(true);
    const body=await response.json() as TournamentCatalogResponse;total=body.total;expect(total).toBeLessThan(2001);
    for(const event of body.events){expect(ids.has(event.id)).toBe(false);ids.add(event.id);expect(event.sourceUrl).toMatch(/^https:\/\/(?:labs\.)?limitlesstcg\.com\//);}
    expect(JSON.stringify(body)).not.toContain('"raw"');
  }
  expect(ids.size).toBe(total);expect(total).toBeGreaterThan(10);
  await page.goto('/#/tournaments');await expect(page.getByRole('heading',{name:'Torneios disponíveis'})).toBeVisible();
  await expect(page.locator('.results > li')).toHaveCount(Math.min(20,total));
  await page.screenshot({path:'../../.cache/expanded-catalog-real-mobile.png',fullPage:true});
  expect((await request.get('/sprites/pokemon-icons.png')).ok()).toBe(true);
});
test('real local imports: search → source identity → partial history → imported decklist', async ({ page, request }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const searches = await request.get('/api/players?name=Jooho'); expect(searches.ok()).toBe(true);
  const candidates = await searches.json() as PlayerSearchResponse;
  const player = candidates.matches.find(item => item.identities.some(identity => identity.source === 'limitless-main'));
  expect(player, 'The preserved Asian sample should be available').toBeTruthy();
  const response = await request.get(`/api/players/${player!.id}/history?limit=10&offset=0`);
  const history = await response.json() as PlayerHistoryResponse;
  const imported = history.entries.find(entry => entry.deck?.listImportedAt);
  expect(imported, 'Existing Jooho sample has one imported historical list').toBeTruthy();
  await page.goto('/'); await page.getByLabel('Mostrar identidades separadas por fonte').check(); await page.getByLabel('Nome do jogador').fill('Jooho');
  await page.locator(`a[href="#/player/${player!.id}"]`).click();
  // This regression verifies the original single-source imported-list flow.
  await page.getByLabel('Reunir nomes iguais no Labs e Limitless').uncheck();
  await expect(page.getByText('Cobertura parcial · resultados selecionados').first()).toBeVisible();
  await expect(page.getByText('Não informado / standard-jp', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: '../../.cache/milestone-4-real-history-mobile.png', fullPage: true });
  await page.locator(`a[href$="/entry/${imported!.id}"]`).click();
  await expect(page.getByText('60', { exact: true })).toBeVisible();
  await expect(page.locator('.decklist li')).not.toHaveCount(0);
  await page.screenshot({ path: '../../.cache/milestone-4-real-deck-mobile.png', fullPage: true });
  await page.goBack(); await page.getByRole('link', { name: 'Voltar à busca' }).click();
  await expect(page.getByLabel('Nome do jogador')).toHaveValue('Jooho');
  expect(errors).toEqual([]);
});

test('real ambiguous Latin American identities remain separate', async ({ page }) => {
  await page.goto('/'); await page.getByLabel('Nome do jogador').fill('Francisco Osorio');
  await expect.poll(()=>page.locator('.candidate').count()).toBeGreaterThanOrEqual(2);
  await expect(page.getByText('ID 5391 · escopo global')).toBeVisible();
  await expect(page.getByText('ID 57170 · escopo global')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '../../.cache/milestone-4-real-search-mobile.png', fullPage: true });
});

test('real comparison keeps Latin American and cross-source identities separate using reads only', async ({ page, request }) => {
  const calls: string[] = []; page.on('request', req => { if (req.url().includes('/api/')) calls.push(req.method()); });
  await page.goto('/'); await page.getByLabel('Mostrar identidades separadas por fonte').check(); await page.getByLabel('Nome do jogador').fill('Francisco Osorio');
  await page.getByRole('checkbox', { name: /ID 5391$/ }).check();
  await page.getByRole('checkbox', { name: /ID 57170$/ }).check();
  await page.getByRole('button', { name: 'Comparar selecionados' }).click();
  await expect(page.locator('.comparison-players > article')).toHaveCount(2);
  await expect(page.locator('.comparison-players .identities').getByText('Limitless Labs · ID 5391', { exact: true })).toBeVisible();
  await expect(page.locator('.comparison-players .identities').getByText('Limitless Labs · ID 57170', { exact: true })).toBeVisible();
  await expect(page.getByText('Nenhuma avaliação registrada para este par.', { exact: true })).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `../../.cache/milestone-5-real-comparison-${width}.png` });
  }
  await page.getByRole('link', { name: 'Voltar à busca e seleção' }).click();
  await expect(page.getByLabel('Nome do jogador')).toHaveValue('Francisco Osorio');
  await page.getByRole('button', { name: 'Remover Francisco Osorio, ID 57170', exact: true }).click();
  await page.getByLabel('Nome do jogador').fill('Jooho');
  await page.getByRole('checkbox', { name: /ID 7427$/ }).check(); await page.getByRole('button', { name: 'Comparar selecionados' }).click();
  await expect(page.locator('.comparison-players .identities').getByText('Limitless · site principal · ID 7427', { exact: true })).toBeVisible();
  await expect(page.locator('.comparison-players .identities').getByText('Limitless Labs · ID 5391', { exact: true })).toBeVisible();
  await expect(page.locator('.comparison-players > article')).toHaveCount(2);
  const current = new URL(page.url()).hash.split('/');
  const response = await request.get(`/api/identity-reviews/compare?playerAId=${current[2]}&playerBId=${current[3]}&view=summary`);
  expect(response.ok()).toBe(true); const body = await response.json() as IdentityComparison;
  expect(body.automaticallyMerged).toBe(false); expect(body.reviewsTotal).toBe(0);
  expect(JSON.stringify(body)).not.toContain('"raw"');
  expect(calls.every(method => method === 'GET')).toBe(true);
});

test('real scouting summary reconciles filtered evidence and retains filters after opening an imported list', async ({ page, request }) => {
  const candidates = await (await request.get('/api/players?name=Jooho')).json() as PlayerSearchResponse;
  const player = candidates.matches.find(player => player.identities.some(identity => identity.source === 'limitless-main'))!;
  const summaryResponse = await request.get(`/api/players/${player.id}/scouting`); expect(summaryResponse.ok()).toBe(true);
  const summary = await summaryResponse.json() as ScoutingSummary;
  expect(summary.counts.matchingResults).toBeGreaterThanOrEqual(1); expect(summary.counts.knownArchetypeResults).toBeGreaterThanOrEqual(1);
  expect(summary.groups.reduce((total,group)=>total+group.resultCount,0)).toBe(summary.counts.knownArchetypeResults);
  await page.goto('/'); await page.getByLabel('Mostrar identidades separadas por fonte').check(); await page.getByLabel('Nome do jogador').fill('Jooho');
  await page.locator(`a[href="#/player/${player.id}"]`).click();
  await page.getByRole('link', { name: 'Arquétipos publicados e filtros' }).click();
  const region = page.getByRole('region', { name: 'Arquétipos publicados neste recorte', exact: true });
  const firstGroup=summary.groups[0];
  await expect(region.getByText(`${firstGroup.resultCount} de ${firstGroup.denominator}`, { exact: true }).first()).toBeVisible();
  await expect(region.getByText(`${firstGroup.percentage.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`, { exact: true }).first()).toBeVisible();
  await region.getByText('Filtrar período, formato e divisão', { exact: true }).click();
  await region.getByLabel('Data inicial (inclusive)').fill('2026-05-24'); await region.getByLabel('Data final (inclusive)').fill('2026-05-24');
  await region.getByLabel('Formato da fonte', { exact: true }).selectOption('value:standard-jp'); await region.getByLabel('Divisão da fonte', { exact: true }).selectOption('unknown');
  await region.getByRole('button', { name: 'Aplicar filtros' }).click(); await expect(region.getByText('1 de 1', { exact: true })).toBeVisible();
  const filteredUrl = `/api/players/${player.id}/scouting?from=2026-05-24&to=2026-05-24&formatMode=known&format=standard-jp&divisionMode=unknown`;
  const filtered = await (await request.get(filteredUrl)).json() as ScoutingSummary;
  const evidence = await (await request.get(filteredUrl.replace('/scouting?', '/scouting/evidence?') + '&group=' + encodeURIComponent(filtered.groups[0].key))).json() as ScoutingEvidence;
  expect(evidence.total).toBe(filtered.groups[0].resultCount); expect(evidence.revision).toBe(filtered.revision);
  await region.getByRole('button', { name: `Ver resultados de ${filtered.groups[0].name}`, exact: true }).click();
  await region.getByRole('link', { name: 'Abrir lista histórica' }).click(); await expect(page.getByText('60', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar ao histórico', exact: true }).click();
  await expect(region.getByLabel('Data inicial (inclusive)')).toHaveValue('2026-05-24');
  await expect(region.getByLabel('Formato da fonte', { exact: true })).toHaveValue('value:standard-jp');
  for (const width of [320,390]) {
    await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await region.locator('.summary-counts').screenshot({ path: `../../.cache/milestone-6-real-counts-${width}.png` });
    await region.locator('.archetype-groups').screenshot({ path: `../../.cache/milestone-6-real-groups-${width}.png` });
  }
  const cerys = await (await request.get('/api/players?name=Cerys%20Jones')).json() as PlayerSearchResponse;
  let verifiedMultiEvent = false;
  for (const candidate of cerys.matches) {
    const response=await request.get(`/api/players/${candidate.id}/scouting`);expect(response.ok(),`Scouting HTTP ${response.status()}`).toBe(true);
    const history = await response.json() as ScoutingSummary;
    if (history.counts.availableResults < 3) continue;
    expect(history.groups.reduce((total, group) => total + group.resultCount, 0)).toBe(history.counts.knownArchetypeResults);
    expect(history.counts.eligibleResults + history.counts.excludedPossibleDuplicates).toBe(history.counts.matchingResults);
    verifiedMultiEvent = true; break;
  }
  expect(verifiedMultiEvent).toBe(true);
});
