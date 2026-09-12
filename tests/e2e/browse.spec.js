import {test, expect} from '@playwright/test';

test('mobile filters expose every option and preserve selection when closed', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/');
  const toggle = page.getByRole('button', {name: /Filters/});
  await expect(page.getByRole('combobox', {name: 'Venue', exact: true})).toBeHidden();
  await toggle.click();
  await page.getByRole('button', {name: 'Debates', exact: true}).click();
  await page.getByRole('combobox', {name: 'Venue', exact: true}).selectOption('Arena');
  await expect(toggle).toHaveText('Filters2−');
  await expect(page.locator('article.ev').first()).toBeVisible();
  const count = await page.locator('article.ev').count();
  await page.getByRole('button', {name: `Show ${count} events`, exact: true}).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await page.reload();
  await expect(page.locator('article.ev')).toHaveCount(count);
  await expect(toggle).toContainText('2');
  await toggle.click();
  await page.getByRole('button', {name: 'Debates', exact: true}).focus();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await page.getByRole('button', {name: 'Clear filters', exact: true}).click();
  await expect(page.locator('article.ev')).toHaveCount(76);
});

test('empty search can reset the visible query or find the same search on Sunday', async ({page}) => {
  await page.goto('/');
  const search = page.getByRole('searchbox', {name: 'Search', exact: true});
  await search.fill('no-such-event-xyz');
  await expect(page.getByRole('heading', {name: 'No matching events on Saturday'})).toBeVisible();
  await page.getByRole('button', {name: 'Reset filters', exact: true}).click();
  await expect(search).toHaveValue('');
  await expect(page.locator('article.ev')).toHaveCount(76);
  await search.fill('Philosophy Breakfast with Rebecca Goldstein');
  await page.getByRole('button', {name: 'See 1 on Sunday', exact: true}).click();
  await expect(page.locator('article.ev')).toHaveCount(1);
  await expect(search).toHaveValue('Philosophy Breakfast with Rebecca Goldstein');
  await expect(page.getByRole('button', {name: /Sunday/}).first()).toHaveAttribute('aria-pressed', 'true');
});

test('empty picks offer the other day and a route back to browsing', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: /Sunday/}).click();
  await page.locator('article.ev .pick').first().click();
  await page.getByRole('button', {name: /Saturday/}).click();
  await page.getByRole('button', {name: /My picks/}).click();
  await expect(page.getByRole('heading', {name: 'No picks for Saturday yet'})).toBeVisible();
  await page.getByRole('button', {name: 'See 1 on Sunday', exact: true}).click();
  await expect(page.locator('article.ev')).toHaveCount(1);
  await page.getByRole('button', {name: /Saturday/}).click();
  await page.getByRole('button', {name: 'Browse the programme', exact: true}).click();
  await expect(page.locator('article.ev')).toHaveCount(76);
});

test('the grid removes venues with no matching events and exposes table navigation', async ({page}) => {
  await page.goto('/');
  await page.getByRole('combobox', {name: 'Venue', exact: true}).selectOption('Ring');
  await page.getByRole('button', {name: 'Grid', exact: true}).click();
  await expect(page.getByRole('columnheader')).toHaveText(['Time', 'Ring']);
  await expect(page.getByRole('rowheader').first()).toHaveText('10:00');
  await page.getByRole('region', {name: 'Programme by time and venue'}).focus();
  await expect(page.getByRole('region', {name: 'Programme by time and venue'})).toBeFocused();
  await expect(page.locator('.gridnote')).toBeVisible();
});

for (const {width, height, scheme} of [
  {width: 320, height: 568, scheme: 'dark'},
  {width: 390, height: 844, scheme: 'light'},
  {width: 1280, height: 900, scheme: 'light'},
  {width: 1280, height: 900, scheme: 'dark'},
]) {
  test(`programme fits ${width}px in ${scheme} mode`, async ({page}, testInfo) => {
    await page.setViewportSize({width, height});
    await page.emulateMedia({colorScheme: scheme});
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('article.ev').first()).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: testInfo.outputPath(`programme-${width}-${scheme}.png`)});
    if (width < 900) {
      await page.getByRole('button', {name: /Filters/}).click();
      await expect(page.getByRole('button', {name: "Children's", exact: true})).toBeVisible();
      await expect(page.getByRole('combobox', {name: 'Topic', exact: true})).toBeVisible();
      await page.getByRole('button', {name: 'Show 76 events', exact: true}).scrollIntoViewIfNeeded();
      await expect(page.getByRole('button', {name: 'Show 76 events', exact: true})).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({path: testInfo.outputPath(`filters-${width}-${scheme}.png`)});
    } else {
      await expect(page.getByRole('button', {name: /Filters/})).toBeHidden();
    }
  });
}
