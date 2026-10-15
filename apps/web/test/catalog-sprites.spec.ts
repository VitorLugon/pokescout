import {expect,test} from '@playwright/test';
import {pokemonSpriteNumbers} from '../src/PokemonSprites';
import {deck,history} from './fixtures';
test.skip(!!process.env.POKESCOUT_LIVE_API,'Offline catalog and sprite fixtures.');

test('species decoration recognizes international names and card suffixes without inventing unknown icons',()=>{
  expect(pokemonSpriteNumbers('Dragapult ex / Charizard')).toEqual([887,6]);
  expect(pokemonSpriteNumbers('ドラパルト')).toEqual([887]);
  expect(pokemonSpriteNumbers('ドラパルトex')).toEqual([887]);
  expect(pokemonSpriteNumbers('Nidoran♀ / Nidoran♂')).toEqual([29,32]);
  expect(pokemonSpriteNumbers('Mega Kangaskhan ex')).toEqual([115]);
  expect(pokemonSpriteNumbers('Radiant Charizard')).toEqual([6]);
  expect(pokemonSpriteNumbers('Pikachurandom / Arquétipo desconhecido')).toEqual([]);
  expect(pokemonSpriteNumbers('constructor')).toEqual([]);
});
test('all imported tournament pages are reachable, partial coverage and duplicates stay explicit',async({page})=>{
  await page.route('**/api/tournament-catalog?**',route=>{
    const offset=Number(new URL(route.request().url()).searchParams.get('offset'));
    return route.fulfill({json:{total:21,limit:20,offset,truncated:offset===0,events:[{id:String(offset),name:offset?'Evento da segunda página':'Campeonato 山田',source:'limitless-main',externalId:'fixture',division:null,country:offset?null:'JP',locationLabel:offset?'ptcgo':null,dateLabel:'May 24, 2026',format:'standard-jp',resultsCoverage:'PUBLISHED_RESULTS',sourceUrl:'https://limitlesstcg.com/tournaments/569',lastSyncedAt:'2026-10-14T00:00:00Z',entriesCount:8,reportedPlayerCount:5000,reportedPlayerCountApproximate:true,quarantinedResultCount:2,fullySynchronized:false,possibleDuplicate:true}]}});
  });
  await page.goto('/');await page.getByRole('link',{name:'Consultar torneios importados →'}).click();
  await expect(page.getByRole('heading',{name:'Campeonato 山田'})).toBeVisible();
  await expect(page.getByText(/Cobertura parcial/)).toBeVisible();await expect(page.getByText(/Possível evento duplicado/)).toBeVisible();
  await expect(page.getByText('Participantes informados pela fonte: aproximadamente 5000')).toBeVisible();await expect(page.getByText(/Importação parcial/)).toBeVisible();
  await expect(page.getByText(/2 linhas publicadas em quarentena/)).toBeVisible();
  await page.getByRole('button',{name:'Próxima'}).click();await expect(page.getByRole('heading',{name:'Evento da segunda página'})).toBeVisible();
  await expect(page.getByText('Local / plataforma na fonte: ptcgo')).toBeVisible();
  await expect(page.getByRole('button',{name:'Próxima'})).toBeDisabled();
  await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('deck sprites load locally and keep accessible literal names',async({page})=>{
  const external:string[]=[];page.on('request',request=>{if(!new URL(request.url()).hostname.includes('127.0.0.1'))external.push(request.url());});
  await page.route('**/api/**',route=>route.fulfill({json:route.request().url().includes('/history')?history:{...deck,archetypeName:'Dragapult / Charizard',cards:[{...deck.cards[0],category:'pokemon',name:'Dragapult ex'}]}}));
  await page.goto('/#/player/fixture/entry/fixture');
  await expect(page.getByRole('heading',{name:'Dragapult / Charizard'})).toBeVisible();
  await expect(page.locator('.decklist strong')).toHaveText('Dragapult ex');
  expect(await page.locator('.decklist .pokemon-sprite').evaluate(element=>getComputedStyle(element).backgroundPosition)).toBe('-440px -2190px');
  expect((await page.request.get('/sprites/pokemon-icons.png')).ok()).toBe(true);
  await page.screenshot({path:'../../.cache/expansion-sprites-mobile.png',fullPage:true});
  expect(external).toEqual([]);
});
