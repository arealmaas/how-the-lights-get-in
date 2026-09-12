import {test, expect} from '@playwright/test';
import programme from '../../programme.json' with {type: 'json'};
import {encodeNotesParam} from '../../src/core/notes.js';

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
  const swActive = await page.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active));
  expect(swActive).toBe(true);
});

test('opening the first card shows the dialog with its title; a note survives closing and reopening it', async ({page}) => {
  await page.goto('/');
  const firstTitle = await page.locator('article.ev .ev-title').first().textContent();
  await page.locator('article.ev').first().click();

  const dialog = page.locator('#sheet');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#sheet-title')).toHaveText(firstTitle);

  const note = dialog.locator('textarea.notes');
  await dialog.getByRole('button', {name: 'Notes', exact: true}).click();
  await note.fill('a thought worth keeping');
  await page.locator('#close').click();
  await expect(dialog).toBeHidden();

  await page.locator('article.ev').first().click();
  await dialog.getByRole('button', {name: 'Notes', exact: true}).click();
  await expect(dialog.locator('.note-card .note-text')).toHaveText('a thought worth keeping');
  await dialog.getByRole('button', {name: 'Edit note', exact: true}).click();
  await expect(dialog.getByRole('textbox', {name: 'My note'})).toHaveValue('a thought worth keeping');
});

test('visiting #event= opens the dialog on that event', async ({page}) => {
  const title = programme.events.find(e => e.eventNo === 6).title;
  await page.goto('/#event=6');

  const dialog = page.locator('#sheet');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#sheet-title')).toHaveText(title);
});

test('an import link banners picks/verdicts/notes; accepting adds them and they show on the event', async ({page}) => {
  const {param} = encodeNotesParam({6: 'a note carried by the link'});
  await page.goto(`/#picks=3,6&verdicts=6:Draw&notes=${param}`);

  const addButton = page.getByRole('button', {name: 'Add them to mine'});
  await expect(addButton).toBeVisible();
  await addButton.click();
  await expect(addButton).toBeHidden();

  await expect(page.locator('[data-count-picks]')).toHaveText('2');

  await page.goto('/#event=6');
  const dialog = page.locator('#sheet');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', {name: 'Notes', exact: true}).click();
  await expect(dialog.getByRole('button', {name: 'Draw', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('.note-card .note-text')).toHaveText('a note carried by the link');
});

// The e2e build has no data/firebase.json, so CLOUD is false: the hub must not advertise an account it
// cannot offer, and the Firebase chunk must never be fetched — it is behind a dynamic import that only
// runs for a device with an account, a returning redirect or a pending invite.
test('without a Firebase config the hub offers no account and the SDK chunk is never fetched', async ({page}) => {
  const sdk = [];
  page.on('request', r => { if (/firebase/i.test(r.url())) sdk.push(r.url()); });

  await page.goto('/');
  await page.getByRole('button', {name: /My festival/}).click();

  const dialog = page.locator('#sheet');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', {name: 'Your weekend'})).toBeVisible();
  await expect(dialog.locator('.hub-card.account')).toHaveCount(0);
  await expect(dialog.getByText('Crew and account')).toHaveCount(0);
  expect(sdk).toEqual([]);
});

// An invite link opened by someone the planner cannot sign in (no data/firebase.json, so CLOUD is false)
// must still take the token out of the address bar and the history, and must say nothing it cannot back
// up — there is no account to join a crew with.
test('a #join= link leaves an empty hash and, without a Firebase config, no banner', async ({page}) => {
  await page.goto('/#join=AbCdEfGhIjKlMnOpQrSt.abcdefghijklmnopqrstu_');

  await expect(page.locator('article.ev').first()).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
  await expect(page.locator('.banner')).toHaveCount(0);
});
