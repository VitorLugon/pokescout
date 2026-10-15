import { expect, test } from '@playwright/test';
import { candidate, other, entry, history, deck } from './fixtures';
import type { PlayerHistoryResponse } from '@tcg-scout/shared';
test.skip(!!process.env.POKESCOUT_LIVE_API,'Offline fixtures only.');

const combined: PlayerHistoryResponse = {
  ...history,total:2,truncated:false,
  combination:{basis:'same-name',confirmedSamePerson:false,sourceResultCount:3,groupedPairs:1,candidatesLimited:false,resultsLimited:false,excludedByReview:0,
    members:[candidate,other].map(player=>({playerId:player.id,displayName:player.displayName,identities:player.identities}))},
  entries:[{...entry,deck:{...deck,source:'limitless-labs',listImportedAt:null,listStatus:'AVAILABLE',cards:[]},tournament:{...entry.tournament,source:'limitless-labs',name:'Regional recente'},otherSources:[{...entry,id:'main-entry',tournament:{...entry.tournament,name:'Versão Main do Regional'}}]},
    {...entry,id:'older',tournament:{...entry.tournament,name:'Evento anterior'}}],
};
test('combined timeline keeps source evidence expandable and can return to the original identity',async({page})=>{
  const calls:string[]=[];
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url());calls.push(url.pathname+url.search);
    return route.fulfill({json:url.pathname.endsWith('/history')?(url.searchParams.get('view')==='same-name'?combined:history):url.pathname.includes('/decklist')?deck:{matches:[candidate,other],truncated:false}});
  });
  await page.goto(`/#/player/${candidate.id}`);
  await expect(page.getByRole('complementary',{name:'Histórico conjunto por nome'})).toBeVisible();
  await expect(page.getByText(/O nome igual não confirma identidade/)).toBeVisible();
  await expect(page.getByText('3 registros de fonte · 1 par de possível duplicação agrupado para consulta.')).toBeVisible();
  await expect(page.locator('.results > .result')).toHaveCount(2);
  await expect(page.getByText(/Há lista histórica importada na outra fonte/)).toBeVisible();
  await expect(page.getByRole('heading',{name:'Versão Main do Regional'})).toBeHidden();
  await page.getByText('Ver resultado correspondente na outra fonte',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'Versão Main do Regional'})).toBeVisible();
  await page.locator('a[href$="/entry/main-entry"]').click();
  await expect(page.getByRole('heading',{name:'Dragapult ex',level:1})).toBeVisible();
  await page.getByRole('link',{name:/Voltar ao histórico/}).click();
  await expect(page.getByLabel('Reunir nomes iguais no Labs e Limitless')).toBeChecked();
  await page.getByLabel('Reunir nomes iguais no Labs e Limitless').uncheck();
  await expect(page.getByRole('complementary',{name:'Histórico conjunto por nome'})).toHaveCount(0);
  await expect(page.locator('.results > .result')).toHaveCount(1);
  expect(calls.some(url=>url.includes('view=same-name'))).toBe(true);
  expect(calls.some(url=>url.endsWith('/history?limit=10&offset=0'))).toBe(true);
  await page.setViewportSize({width:320,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('candidate and result limits remain explicit in a combined response',async({page})=>{
  await page.route('**/api/**',route=>route.fulfill({json:{...combined,combination:{...combined.combination,candidatesLimited:true,resultsLimited:true,excludedByReview:1}}}));
  await page.goto(`/#/player/${candidate.id}`);
  await expect(page.getByText(/Conjunto limitado/)).toBeVisible();
  await expect(page.getByText(/excluídas do conjunto por avaliações/)).toBeVisible();
});
