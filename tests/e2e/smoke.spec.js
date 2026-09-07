import {test, expect} from '@playwright/test';
test('the programme renders, filters and picks work', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {level: 1})).toContainText('HowTheLightGetsIn');
  const cards = page.locator('article.ev');
  await expect(cards.first()).toBeVisible();
  const saturday = await cards.count(); expect(saturday).toBeGreaterThan(50);
  await page.getByRole('button', {name: /Sunday/}).click();
  await expect.poll(() => cards.count()).not.toBe(saturday);
  await page.getByRole('button', {name: /Debates/}).first().click();
  await expect(page.locator('#status')).toContainText('Showing');
  await page.getByRole('button', {name: 'Clear filters'}).click();
  await cards.first().getByRole('button', {name: /my picks/}).click();
  await expect(page.locator('[data-count-picks]')).toHaveText('1');
  await page.getByRole('button', {name: 'Grid'}).click();
  await expect(page.locator('table.grid')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-count-picks]')).toHaveText('1');   // persisted
});
