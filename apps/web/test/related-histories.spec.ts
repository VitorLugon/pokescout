import { expect, test } from '@playwright/test';
import { candidate, other, entry, history } from './fixtures';

test.skip(!!process.env.POKESCOUT_LIVE_API, 'Local API fixtures only.');

test('history exposes other source candidates without combining results or hiding pagination', async ({ page }) => {
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith('/history') ? { ...history, entries: [{ ...entry, tournament: { ...entry.tournament, name: 'Regional de teste recente' } }] } : { matches: [candidate, other], truncated: false };
    return route.fulfill({ json: body });
  });
  await page.goto(`/#/player/${candidate.id}`);
  const related = page.getByRole('complementary', { name: 'Outros históricos encontrados' });
  await expect(related).toBeVisible();
  await expect(related).toContainText('Limitless Labs · ID 84');
  await expect(related.getByRole('link', { name: 'Ver outro histórico' })).toHaveAttribute('href', `#/player/${other.id}`);
  await expect(related.getByRole('link', { name: 'Comparar identidades' })).toHaveAttribute('href', `#/compare/${candidate.id}/${other.id}`);
  await expect(page.locator('.result')).toHaveCount(1);
  await expect(page.getByText('Exibindo 1–1 de 11 resultados', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Próxima' })).toBeEnabled();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('similar names alone are not presented as the same player', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/history') ? history : { matches: [candidate, { ...other, aliases: ['João 山田 Júnior'] }], truncated: false } }));
  await page.goto(`/#/player/${candidate.id}`);
  await expect(page.locator('.result')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Outros históricos encontrados' })).toHaveCount(0);
});
