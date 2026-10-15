import {expect,test} from '@playwright/test';
import {candidate,other} from './fixtures';
import type {TournamentCatalogResponse} from '@tcg-scout/shared';
test.skip(!!process.env.POKESCOUT_LIVE_API,'Offline source preference fixtures.');

test('search shows Labs first with Main available for inspection and comparison',async({page})=>{
  await page.route('**/api/players?**',route=>{
    const preferred=new URL(route.request().url()).searchParams.has('view');
    return route.fulfill({json:{matches:preferred?[{...other,alternativeMatches:[candidate]}]:[candidate,other],truncated:false,
      ...(preferred?{presentation:{policy:'labs-first',inspectedMatches:2,inspectedMatchesLimited:false}}:{})}});
  });
  await page.goto('/');await page.getByLabel('Nome do jogador').fill('João 山田');
  await expect(page.locator('.candidates > .candidate')).toHaveCount(1);
  await expect(page.locator('.candidates > .candidate > .identities')).toContainText('Limitless Labs');
  await page.getByText('Consultar nome correspondente no site principal',{exact:true}).click();
  await expect(page.locator('.other-sources')).toContainText('ID 42');
  await page.getByRole('checkbox',{name:/ID 42$/}).check();await page.getByRole('checkbox',{name:/ID 84$/}).check();
  await expect(page.getByRole('button',{name:'Comparar selecionados'})).toBeEnabled();
  await page.getByLabel('Mostrar identidades separadas por fonte').check();
  await expect(page.locator('.candidates > .candidate')).toHaveCount(2);
  await expect(page.getByRole('button',{name:'Comparar selecionados'})).toBeEnabled();
});

const event=(id:string,source:string,name:string):TournamentCatalogResponse['events'][number]=>({id,source,name,externalId:id,division:null,country:'JP',locationLabel:null,dateLabel:'24th May 2026',format:'standard-jp',resultsCoverage:'PUBLISHED_RESULTS',sourceUrl:'https://limitlesstcg.com/tournaments/42',lastSyncedAt:'2026-10-15T00:00:00Z',entriesCount:32,reportedPlayerCount:null,reportedPlayerCountApproximate:false,quarantinedResultCount:0,fullySynchronized:false,possibleDuplicate:true});
test('catalog folds a Main counterpart but keeps exclusive events and original-source mode',async({page})=>{
  const labs=event('labs','limitless-labs','Evento no Labs'),main=event('main','limitless-main','Versão no site principal'),exclusive=event('only','limitless-main','Evento asiático exclusivo');
  await page.route('**/api/tournament-catalog?**',route=>{
    const preferred=new URL(route.request().url()).searchParams.has('view');
    return route.fulfill({json:{total:preferred?2:3,limit:20,offset:0,truncated:false,events:preferred?[{...labs,otherSources:[main]},exclusive]:[labs,main,exclusive],
      ...(preferred?{presentation:{policy:'labs-first',sourceRecordCount:3,groupedPairs:1}}:{})}});
  });
  await page.goto('/#/tournaments');await expect(page.locator('.results > .result')).toHaveCount(2);
  await expect(page.getByRole('heading',{name:'Evento asiático exclusivo'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Versão no site principal'})).toBeHidden();
  await page.getByText('Resultados e detalhes complementares do site principal',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'Versão no site principal'})).toBeVisible();
  await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByLabel('Mostrar torneios separados por fonte').check();
  await expect(page.locator('.results > .result')).toHaveCount(3);
});
