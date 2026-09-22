import {test, expect} from '@playwright/test';
import {FINALE_DISMISSAL_KEY} from './fixtures.js';
import programme from '../../programme.json' with {type: 'json'};

const heading = 'The weekend ends. The light stays.';
const finale = page => page.getByRole('dialog', {name: heading});

test('the closing message opens on first visit, then the programme stays accessible after reload', async ({page}) => {
  await page.goto('/');
  const message = finale(page);
  await expect(message).toBeVisible();
  await expect(message).toHaveAttribute('open', '');
  await expect(message.getByRole('heading', {name: heading})).toBeVisible();

  await message.getByRole('button', {name: 'Explore the programme'}).click();
  await expect(message).toBeHidden();
  await expect(page.locator('#main')).toBeFocused();
  expect(await page.evaluate(key => sessionStorage.getItem(key), FINALE_DISMISSAL_KEY)).toBe('1');

  await page.getByRole('button', {name: /^Sunday/}).click();
  await expect(page.getByRole('button', {name: /^Sunday/})).toHaveAttribute('aria-pressed', 'true');
  const event = page.locator('article.ev').first();
  const title = await event.locator('.ev-title').textContent();
  await event.click();
  await expect(page.locator('#sheet-title')).toHaveText(title);
  await page.locator('#sheet').getByRole('button', {name: 'Close', exact: true}).click();
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(message).toBeHidden();

  await page.reload();
  await expect(page.getByRole('heading', {level: 1})).toContainText('HowTheLightGetsIn');
  await expect(message).toBeHidden();
  await page.getByRole('button', {name: 'Grid', exact: true}).click();
  await expect(page.locator('table.grid')).toBeVisible();
});

test('the close control dismisses the message and returns focus to the programme', async ({page}) => {
  await page.goto('/');
  const message = finale(page);
  await message.getByRole('button', {name: 'Close festival message'}).click();
  await expect(message).toBeHidden();
  await expect(page.locator('#main')).toBeFocused();
  await page.locator('article.ev').first().click();
  await expect(page.locator('#sheet')).toBeVisible();
});

test('keyboard focus stays in the message and Escape dismisses it', async ({page}) => {
  await page.goto('/');
  await expect(finale(page)).toBeVisible();
  const focusIsInside = () => page.evaluate(() => !!document.activeElement?.closest('dialog.festival-finale'));
  await expect.poll(focusIsInside).toBe(true);
  await page.locator('article.ev .ev-open').first().focus();
  await expect.poll(focusIsInside).toBe(true);
  for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab']) {
    await page.keyboard.press(key);
    await expect.poll(focusIsInside).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(finale(page)).toBeHidden();
  await expect(page.locator('#main')).toBeFocused();
  expect(await page.evaluate(key => sessionStorage.getItem(key), FINALE_DISMISSAL_KEY)).toBe('1');
});

test('an event deep link opens its details before the closing message', async ({page}) => {
  const event = programme.events.find(item => item.eventNo === 6);
  await page.goto('/#event=6');
  await expect(page.locator('#sheet-title')).toHaveText(event.title);
  await expect(finale(page)).toBeHidden();
  await expect(page).toHaveURL(url => url.hash === '#event=6');
  await page.locator('#sheet').getByRole('button', {name: 'Close', exact: true}).click();
  await expect(finale(page)).toBeVisible();
  await expect(page.locator('#sheet')).toBeHidden();
  await finale(page).getByRole('button', {name: 'Explore the programme'}).click();
  await expect(page.locator('#main')).toBeFocused();
  await page.locator('article.ev .ev-open').filter({hasText: event.title}).click();
  await expect(page.locator('#sheet-title')).toHaveText(event.title);
  await expect(finale(page)).toBeHidden();
});

test.describe('the closing message on phones', () => {
  test.use({isMobile: true, hasTouch: true, reducedMotion: 'reduce'});

  for (const viewport of [{width: 320, height: 568}, {width: 844, height: 390}]) {
    test(`the message fits and can be dismissed at ${viewport.width} × ${viewport.height}`, async ({page}, testInfo) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      const message = finale(page);
      const close = message.getByRole('button', {name: 'Close festival message'});
      const explore = message.getByRole('button', {name: 'Explore the programme'});
      await expect(message).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await message.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await expect(close).toBeInViewport();
      expect((await close.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await explore.scrollIntoViewIfNeeded();
      await expect(explore).toBeInViewport();
      expect((await explore.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await page.screenshot({path: testInfo.outputPath(`festival-finale-${viewport.width}.png`)});
      await explore.tap();
      await expect(message).toBeHidden();
      await page.locator('article.ev').first().tap();
      await expect(page.locator('#sheet')).toBeVisible();
    });
  }
});
