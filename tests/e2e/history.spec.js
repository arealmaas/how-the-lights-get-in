import {test, expect} from '@playwright/test';
import programme from '../../programme.json' with {type: 'json'};
import {encodeNotesParam} from '../../src/core/notes.js';

const event = programme.events.find(e => e.eventNo === 6);
const dialog = page => page.locator('#sheet');
const eventCard = page => page.locator('article.ev').filter({has: page.getByRole('button', {name: event.title, exact: true})});
const expectEventURL = page => expect(page).toHaveURL(url => url.hash === '#event=6');
const historyLength = page => page.evaluate(() => history.length);

test('opening a card gives it an event URL and browser Back and Forward follow the sheet', async ({page}) => {
  await page.goto('/');
  await expect(eventCard(page)).toBeVisible();
  const before = await historyLength(page);
  await eventCard(page).getByRole('button', {name: event.title, exact: true}).click();
  await expect(dialog(page).locator('#sheet-title')).toHaveText(event.title);
  await expectEventURL(page);
  expect(await historyLength(page)).toBe(before + 1);

  await page.goBack();
  await expect(dialog(page)).toBeHidden();
  await expect(page).toHaveURL(url => url.hash === '');
  await page.goForward();
  await expect(dialog(page).locator('#sheet-title')).toHaveText(event.title);
  await expectEventURL(page);
  expect(await historyLength(page)).toBe(before + 1);
});

test('browser and in-app Back preserve distinct visits, event sections and reading positions', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/#event=6');
  await page.evaluate(() => document.fonts.ready);
  const sheet = dialog(page);
  const body = sheet.locator('#sheet-body');
  await expect(sheet.locator('#sheet-title')).toHaveText(event.title);
  const originalLength = await historyLength(page);
  const speaker = sheet.locator('.people button.link').first();
  await body.evaluate(el => { el.scrollTop = 160; });
  await speaker.scrollIntoViewIfNeeded();
  const eventPosition = await body.evaluate(el => el.scrollTop);
  expect(eventPosition).toBeGreaterThan(0);
  await speaker.click();
  await expect(sheet.locator('.profile')).toBeVisible();
  const speakerTitle = await sheet.locator('#sheet-title').textContent();
  const appearance = sheet.locator('.applist button').filter({hasText: event.title});
  await appearance.scrollIntoViewIfNeeded();
  const speakerPosition = await body.evaluate(el => el.scrollTop);
  expect(speakerPosition).toBeGreaterThan(0);
  await appearance.click();
  await expect(sheet.locator('#sheet-title')).toHaveText(event.title);
  await sheet.getByRole('button', {name: 'Briefing', exact: true}).click();
  await body.evaluate(el => { el.scrollTop = 260; });
  await expect.poll(() => body.evaluate(el => el.scrollTop)).toBe(260);
  expect(await historyLength(page)).toBe(originalLength + 2);

  await page.goBack();
  await expect(sheet.locator('#sheet-title')).toHaveText(speakerTitle);
  await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeCloseTo(speakerPosition, 0);
  await page.goForward();
  await expect(sheet.locator('#sheet-title')).toHaveText(event.title);
  await expect(sheet.getByRole('button', {name: 'Briefing', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => body.evaluate(el => el.scrollTop)).toBe(260);
  await page.goBack();
  await expect(sheet.locator('#sheet-title')).toHaveText(speakerTitle);
  await sheet.getByRole('button', {name: '← Back', exact: true}).click();
  await expect(sheet.locator('#sheet-title')).toHaveText(event.title);
  await expect(sheet.getByRole('button', {name: 'Overview', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeCloseTo(eventPosition, 0);
  await page.goForward();
  await expect(sheet.locator('#sheet-title')).toHaveText(speakerTitle);
  await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeCloseTo(speakerPosition, 0);
  expect(await historyLength(page)).toBe(originalLength + 2);
});

for (const action of ['Close', 'Escape']) {
  test(`${action} returns to the programme without adding closed panels to Back`, async ({page}) => {
    await page.goto('/?before=history');
    await expect(eventCard(page)).toBeVisible();
    await page.goto('/');
    await eventCard(page).getByRole('button', {name: event.title, exact: true}).click();
    await dialog(page).locator('.people button.link').first().click();
    await expect(dialog(page).locator('.profile')).toBeVisible();
    if (action === 'Escape') await page.keyboard.press('Escape');
    else await dialog(page).getByRole('button', {name: 'Close', exact: true}).click();
    await expect(dialog(page)).toBeHidden();
    await expect(page).toHaveURL(url => url.search === '' && url.hash === '');

    await page.goBack();
    await expect(page).toHaveURL(url => url.search === '?before=history' && url.hash === '');
    await expect(eventCard(page)).toBeVisible();
    await expect(dialog(page)).toBeHidden();
  });
}

test('a direct event link has a programme Back destination and reload preserves its history', async ({page}) => {
  await page.goto('/#event=6');
  await expect(dialog(page).locator('#sheet-title')).toHaveText(event.title);
  const initialLength = await historyLength(page);
  await page.reload();
  await expect(dialog(page).locator('#sheet-title')).toHaveText(event.title);
  await expectEventURL(page);
  expect(await historyLength(page)).toBe(initialLength);
  await page.goBack();
  await expect(dialog(page)).toBeHidden();
  await expect(page).toHaveURL(url => url.hash === '');
  await expect(eventCard(page)).toBeVisible();
  await page.goForward();
  await expect(dialog(page).locator('#sheet-title')).toHaveText(event.title);
  await expectEventURL(page);
  expect(await historyLength(page)).toBe(initialLength);
});

test('reload restores nested detail history without adding another visit', async ({page}) => {
  await page.goto('/#event=6');
  await dialog(page).locator('.people button.link').first().click();
  await expect(dialog(page).locator('.profile')).toBeVisible();
  const speakerTitle = await dialog(page).locator('#sheet-title').textContent();
  const initialLength = await historyLength(page);
  await page.reload();
  await expect(dialog(page).locator('#sheet-title')).toHaveText(speakerTitle);
  expect(await historyLength(page)).toBe(initialLength);
  await page.goBack();
  await expect(dialog(page).locator('#sheet-title')).toHaveText(event.title);
  await expectEventURL(page);
  await page.goBack();
  await expect(dialog(page)).toBeHidden();
});

test('import data leaves the URL before a decision and accepting it preserves a newer event URL', async ({page}) => {
  const note = 'This private note must never enter navigation state.';
  const {param} = encodeNotesParam({6: note});
  await page.goto(`/#picks=3,6&verdicts=6:Draw&notes=${param}`);
  const accept = page.getByRole('button', {name: 'Add them to mine', exact: true});
  await expect(accept).toBeVisible();
  await expect(page).toHaveURL(url => url.hash === '');
  const initialState = await page.evaluate(() => JSON.stringify(history.state));
  expect(initialState).not.toContain(param);
  expect(initialState).not.toContain(note);
  await eventCard(page).getByRole('button', {name: event.title, exact: true}).click();
  await expectEventURL(page);
  await accept.click();
  await expect(accept).toBeHidden();
  await expectEventURL(page);
  await expect(page.locator('[data-count-picks]')).toHaveText('2');
  await dialog(page).getByRole('button', {name: 'Notes', exact: true}).click();
  await expect(dialog(page).getByRole('textbox', {name: 'My note'})).toHaveValue(note);
  await dialog(page).getByRole('button', {name: 'Save note', exact: true}).click();
  await expect(dialog(page).locator('.note-card .note-text')).toHaveText(note);
  await page.goBack();
  await expect(dialog(page)).toBeHidden();
  await expect(page).toHaveURL(url => url.hash === '');
  const restoredState = await page.evaluate(() => JSON.stringify(history.state));
  expect(restoredState).not.toContain(param);
  expect(restoredState).not.toContain(note);
  await expect(accept).toBeHidden();
  await page.goForward();
  await expectEventURL(page);
  await expect(dialog(page).locator('#sheet-title')).toHaveText(event.title);
  await expect(accept).toBeHidden();
});

test('crew invite tokens stay out of restored URLs and navigation state', async ({page}) => {
  const token = 'abcdefghijklmnopqrstu_';
  await page.goto(`/#join=AbCdEfGhIjKlMnOpQrSt.${token}`);
  await expect(eventCard(page)).toBeVisible();
  await expect(page).toHaveURL(url => url.hash === '');
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain(token);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('htlgi-l26-join')).token)).toBe(token);
  await eventCard(page).getByRole('button', {name: event.title, exact: true}).click();
  await expectEventURL(page);
  await page.goBack();
  await expect(dialog(page)).toBeHidden();
  await expect(page).toHaveURL(url => url.hash === '');
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain(token);
  await page.reload();
  await expect(eventCard(page)).toBeVisible();
  await expect(page).toHaveURL(url => url.hash === '');
  await expect(dialog(page)).toBeHidden();
});

test('hash navigation and duplicate browser notifications open an event only once', async ({page}) => {
  await page.goto('/');
  await expect(eventCard(page)).toBeVisible();
  await page.evaluate(() => { location.hash = '#event=6'; });
  await expect(dialog(page).locator('#sheet-title')).toHaveText(event.title);
  await expectEventURL(page);
  const initialLength = await historyLength(page);
  // A single same-document hash navigation can deliver both events. Replaying them
  // also exercises listeners receiving an already-reconciled location/state pair.
  await page.evaluate(() => {
    dispatchEvent(new PopStateEvent('popstate', {state: history.state}));
    dispatchEvent(new HashChangeEvent('hashchange', {oldURL: location.href, newURL: location.href}));
  });
  await expect(dialog(page).getByRole('button', {name: '← Back', exact: true})).toBeHidden();
  expect(await historyLength(page)).toBe(initialLength);
  await page.goBack();
  await expect(dialog(page)).toBeHidden();
  await expect(page).toHaveURL(url => url.hash === '');
  await page.goForward();
  await expect(dialog(page).locator('#sheet-title')).toHaveText(event.title);
  await expect(dialog(page).getByRole('button', {name: '← Back', exact: true})).toBeHidden();
  expect(await historyLength(page)).toBe(initialLength);
});

test('an import into an open event does not leave older panels behind after Close', async ({page}) => {
  await page.goto('/?before=import');
  await expect(eventCard(page)).toBeVisible();
  await page.goto('/');
  await eventCard(page).getByRole('button', {name: event.title, exact: true}).click();
  await dialog(page).locator('.people button.link').first().click();
  await expect(dialog(page).locator('.profile')).toBeVisible();
  const speakerTitle = await dialog(page).locator('#sheet-title').textContent();
  await page.evaluate(() => { location.hash = 'picks=3,6'; });
  await page.getByRole('button', {name: 'Add them to mine', exact: true}).click();
  await expectEventURL(page);
  await expect(dialog(page).locator('#sheet-title')).toHaveText(speakerTitle);
  await dialog(page).getByRole('button', {name: 'Close', exact: true}).click();
  await expect(page).toHaveURL(url => url.hash === '');
  await expect(dialog(page)).toBeHidden();
  await page.goBack();
  await expect(page).toHaveURL(url => url.search === '?before=import');
  await expect(dialog(page)).toBeHidden();
});
