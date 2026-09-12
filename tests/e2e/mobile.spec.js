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
    await dialog.getByRole('button', {name: 'Notes', exact: true}).tap();
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
    await dialog.getByRole('button', {name: 'Notes', exact: true}).tap();
    await expect(dialog.locator('.note-card .note-text')).toHaveText('Keep this thought while expanding the event.');
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
  await expect(dialog.getByRole('link', {name: 'Google Calendar ↗'})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', {name: 'Compact view', exact: true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(card).toBeFocused();
});

test.describe('mobile notes', () => {
  test.use({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, reducedMotion: 'reduce'});
  const longNote = 'A question to come back to\n\nWhat changes when we think of uncertainty as something to explore?\n\n' +
    Array.from({length: 14}, (_, i) => `Thought ${i + 1}: Keep the question open. There is more to understand, and a good conversation makes room for another perspective.`).join('\n\n') +
    '\n\nThe very last line — keep this too.';

  test('the full note can be saved, edited, reopened, found in My festival and exported without picks', async ({page}, testInfo) => {
    await page.goto('/#event=6');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', {name: 'Notes', exact: true}).tap();
    const editor = dialog.getByRole('textbox', {name: 'My note'});
    await editor.fill(longNote);
    await expect.poll(() => editor.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(2);
    expect(await editor.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    const save = dialog.getByRole('button', {name: 'Save note', exact: true});
    expect((await save.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await save.tap();
    const text = dialog.locator('.note-card .note-text');
    expect(await text.textContent()).toBe(longNote);
    expect(await text.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(2);
    await expectNoOverflow(page);
    await dialog.locator('.note-card').evaluate(el => {
      const body = document.getElementById('sheet-body');
      body.scrollTop += el.getBoundingClientRect().top - body.getBoundingClientRect().top - 12;
    });
    await page.screenshot({path: testInfo.outputPath('mobile-note-reading.png')});
    await dialog.getByRole('button', {name: 'Edit note', exact: true}).tap();
    await expect(editor).toHaveValue(longNote);
    const edited = longNote + '\n\nAdded after the talk.';
    await editor.fill(edited);
    // Escape closes without depending on blur or waiting for autosave.
    await page.keyboard.press('Escape');
    await page.reload();
    await dialog.getByRole('button', {name: 'Notes', exact: true}).tap();
    expect(await text.textContent()).toBe(edited);
    await dialog.getByRole('button', {name: 'Close', exact: true}).tap();
    await page.getByRole('button', {name: /My festival/}).tap();
    const entry = dialog.locator('.notebook-entry');
    await expect(entry).toHaveCount(1);
    expect(await entry.locator('.note-text').textContent()).toBe(edited);
    await expect(dialog.getByText('Nothing picked yet')).toBeVisible();
    await dialog.getByRole('searchbox', {name: 'Search my notes'}).fill('Added after the talk');
    await expect(entry).toHaveCount(1);
    await dialog.getByRole('button', {name: `Edit note for ${event.title}`}).tap();
    await expect(dialog.getByRole('button', {name: 'Notes', exact: true})).toHaveAttribute('aria-pressed', 'true');
    await expect(editor).toHaveValue(edited);
    await editor.fill('A final revision from My festival.');
    await dialog.getByRole('button', {name: 'Save note', exact: true}).tap();
    await dialog.getByRole('button', {name: '← Back', exact: true}).tap();
    await expect(entry.locator('.note-text')).toHaveText('A final revision from My festival.');
    const downloading = page.waitForEvent('download');
    await dialog.getByRole('button', {name: 'Export notes (.md)'}).tap();
    expect((await downloading).suggestedFilename()).toBe('htlgi-london-2026-notes.md');
  });

  test('long notes fit narrow and landscape phones in dark mode and remain editable offline', async ({page, context, browserName}, testInfo) => {
    await page.setViewportSize({width: 320, height: 568});
    await page.emulateMedia({colorScheme: 'dark'});
    await page.goto('/#event=6');
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Let the active worker cache the preview server's CORS response variants too.
    await page.reload();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', {name: 'Notes', exact: true}).tap();
    await dialog.getByRole('textbox', {name: 'My note'}).fill(longNote + '\n' + 'unbrokentext'.repeat(90));
    await dialog.getByRole('button', {name: 'Save note', exact: true}).tap();
    await expectNoOverflow(page);
    await dialog.locator('.note-card').evaluate(el => {
      const body = document.getElementById('sheet-body');
      body.scrollTop += el.getBoundingClientRect().top - body.getBoundingClientRect().top - 12;
    });
    await page.screenshot({path: testInfo.outputPath('narrow-note-dark.png')});
    await context.setOffline(true);
    // Playwright WebKit refuses offline navigations before the worker can answer. Both
    // engines exercise offline edits; Chromium also reloads from the offline cache.
    if (browserName === 'chromium') {
      await page.reload();
      await dialog.getByRole('button', {name: 'Notes', exact: true}).tap();
    }
    await expect(dialog.locator('.note-card .note-text')).toContainText('The very last line');
    await dialog.getByRole('button', {name: 'Edit note', exact: true}).tap();
    const editor = dialog.getByRole('textbox', {name: 'My note'});
    await editor.fill(longNote + '\n\nWritten offline.');
    await page.setViewportSize({width: 844, height: 390});
    await expect.poll(() => editor.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(2);
    await expectNoOverflow(page);
    await page.setViewportSize({width: 320, height: 568});
    await expect.poll(() => editor.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(2);
    await dialog.getByRole('button', {name: 'Save note', exact: true}).tap();
    await expect(dialog.getByRole('status')).toHaveText('Saved on this device');
    await context.setOffline(false);
    await page.reload();
    await dialog.getByRole('button', {name: 'Notes', exact: true}).tap();
    await expect(dialog.locator('.note-card .note-text')).toContainText('Written offline.');
  });
});
