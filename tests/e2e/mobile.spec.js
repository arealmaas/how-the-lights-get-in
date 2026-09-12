import {test, expect} from '@playwright/test';
import programme from '../../programme.json' with {type: 'json'};

const event = programme.events.find(e => e.eventNo === 6);

async function expectFullScreen(page){
  await expect.poll(async () => {
    const box = await page.locator('#sheet').boundingBox();
    const viewport = page.viewportSize();
    return Math.abs(box.x) + Math.abs(box.y) + Math.abs(box.width - viewport.width) + Math.abs(box.height - viewport.height);
  }).toBeLessThan(2);
}

async function expectNoOverflow(page){
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (await page.locator('#sheet').isVisible()) {
    expect(await page.locator('#sheet-body').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
}

test.describe('mobile event details', () => {
  test.use({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, reducedMotion: 'reduce'});

  test('full screen keeps notes, the selected tab and reading position; speaker navigation stays expanded', async ({page}, testInfo) => {
    await page.goto('/#event=6');
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('#sheet-title')).toHaveText(event.title);
    const pick = dialog.getByRole('button', {name: /Add to my picks/});
    await expect(pick).toBeInViewport();
    await pick.tap();
    await expect(dialog.getByRole('button', {name: /In my picks/})).toHaveAttribute('aria-pressed', 'true');

    await dialog.getByRole('button', {name: 'Full screen', exact: true}).tap();
    await expectFullScreen(page);
    await expectNoOverflow(page);
    await page.screenshot({path: testInfo.outputPath('event-full-screen.png')});
    const note = dialog.locator('textarea.notes');
    await note.fill('Keep this thought while expanding the event.');
    await dialog.getByRole('button', {name: 'Compact view', exact: true}).tap();
    await expect(note).toHaveValue('Keep this thought while expanding the event.');

    await dialog.getByRole('button', {name: 'Briefing', exact: true}).tap();
    await dialog.locator('#sheet-body').evaluate(el => { el.scrollTop = 150; });
    await dialog.getByRole('button', {name: 'Full screen', exact: true}).tap();
    await expectFullScreen(page);
    await expect(dialog.getByRole('button', {name: 'Briefing', exact: true})).toHaveAttribute('aria-pressed', 'true');
    expect(await dialog.locator('#sheet-body').evaluate(el => el.scrollTop)).toBe(150);

    await dialog.getByRole('button', {name: 'Overview', exact: true}).tap();
    await dialog.locator('.people button.link').first().tap();
    await expect(dialog.locator('.profile')).toBeVisible();
    await expectFullScreen(page);
    await dialog.getByRole('button', {name: '← Back', exact: true}).tap();
    await expect(dialog.locator('#sheet-title')).toHaveText(event.title);
    await expectFullScreen(page);
    await expect(dialog.locator('textarea.notes')).toHaveValue('Keep this thought while expanding the event.');
    await expect(dialog.getByRole('button', {name: 'Close', exact: true})).toBeInViewport();
  });

  test('closing restores the programme position and the card; the background cannot scroll', async ({page}, testInfo) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const card = page.locator('article.ev').nth(12);
    await card.scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    expect(scrollBefore).toBeGreaterThan(300);
    await page.screenshot({path: testInfo.outputPath('mobile-programme.png')});
    await card.tap();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', {name: 'Full screen', exact: true}).tap();
    await page.evaluate(() => window.scrollBy(0, 500));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // Import/account banners must remain usable above the locked, scrolled programme.
    await page.evaluate(() => { window.location.hash = 'picks=3,6'; });
    const importPicks = page.getByRole('button', {name: 'Add them to mine', exact: true});
    await expect(importPicks).toBeInViewport();
    await importPicks.tap();
    await expect(importPicks).toBeHidden();
    await dialog.locator('#sheet-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await dialog.getByRole('button', {name: 'Close', exact: true}).tap();
    await expect(dialog).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scrollBefore, 0);
    await expect(card).toBeFocused();
    await card.tap();
    await expect(dialog.getByRole('button', {name: 'Full screen', exact: true})).toHaveAttribute('aria-pressed', 'false');
    await dialog.getByRole('button', {name: 'Close', exact: true}).tap();
    await page.evaluate(() => window.scrollBy(0, 100));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
  });

  for (const viewport of [{width: 320, height: 568}, {width: 844, height: 390}]) {
    test(`cards and expanded details fit ${viewport.width} × ${viewport.height}`, async ({page}) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.locator('article.ev').first()).toBeVisible();
      await expectNoOverflow(page);
      if (viewport.width === 320) {
        const star = await page.locator('article.ev .pick').first().boundingBox();
        expect(star.width).toBeGreaterThanOrEqual(44);
        expect(star.height).toBeGreaterThanOrEqual(44);
      }
      await page.locator('article.ev').first().tap();
      await page.getByRole('button', {name: 'Full screen', exact: true}).tap();
      await expectFullScreen(page);
      await expectNoOverflow(page);
      await page.locator('#sheet-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
      const close = page.getByRole('button', {name: 'Close', exact: true});
      await expect(close).toBeInViewport();
      expect((await close.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await close.tap();
      await expect(page.getByRole('dialog')).toBeHidden();
    });
  }
});

test('keyboard focus stays in the event and Escape returns to its opener', async ({page}) => {
  await page.goto('/');
  const card = page.locator('article.ev').first();
  await card.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('#sheet-title')).toBeFocused();
  await page.keyboard.press('Tab');
  const expand = dialog.getByRole('button', {name: 'Full screen', exact: true});
  await expect(expand).toBeFocused();
  await page.keyboard.press('Enter');
  await expectFullScreen(page);
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.locator('textarea.notes')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', {name: 'Compact view', exact: true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(card).toBeFocused();
});
