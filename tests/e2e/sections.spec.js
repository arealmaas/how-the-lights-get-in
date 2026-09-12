import {test, expect} from '@playwright/test';
import programme from '../../programme.json' with {type: 'json'};
import briefings from '../../data/briefings.json' with {type: 'json'};

const event = programme.events.find(item => item.eventNo === 6);
const withoutBriefing = programme.events.find(item => !briefings[item.eventNo]);
const longNote = 'A question to carry into the next conversation.\n\n' +
  Array.from({length: 24}, (_, i) => `Thought ${i + 1}: What changes when we leave room for another perspective? Keep this passage available while checking the briefing and returning to the conversation.`).join('\n\n') +
  '\n\nThe final thought is still here.';

const sheet = page => page.getByRole('dialog');
const body = page => sheet(page).locator('#sheet-body');
const sections = page => sheet(page).getByRole('group', {name: 'Event sections'});
const sectionButton = (page, name) => sections(page).getByRole('button', {name, exact: true});

async function openEvent(page, no = 6){
  await page.goto(`/#event=${no}`);
  await expect(sheet(page).locator('#sheet-title')).toHaveText(programme.events.find(item => item.eventNo === no).title);
  await page.evaluate(() => document.fonts.ready);
}

async function seedNote(page){
  await page.addInitScript(text => {
    localStorage.setItem('htlgi-l26-notes', JSON.stringify({6: text}));
  }, longNote);
}

async function expectReachableSections(page){
  for (const button of await sections(page).getByRole('button').all()) {
    await expect(button).toBeInViewport({ratio: 1});
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await button.evaluate(el => {
      const box = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
  }
  expect(await body(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
}

async function chooseSection(page, name){
  const button = sectionButton(page, name);
  await expect(button).toBeInViewport({ratio: 1});
  expect(await button.evaluate(el => {
    const box = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  })).toBe(true);
  // Playwright's locator.click() first scrolls sticky elements into the scroll-padding
  // area even when they are fully visible. Click the proven visible target directly
  // so the test measures the user's reading position, not that preparatory scroll.
  const box = await button.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

async function expectPanelBelowSections(page, id){
  await expect.poll(async () => {
    const strip = await sections(page).boundingBox();
    const panel = await sheet(page).locator(id).boundingBox();
    return panel.y - strip.y - strip.height;
  }).toBeGreaterThanOrEqual(-1);
  const strip = await sections(page).boundingBox();
  const panel = await sheet(page).locator(id).boundingBox();
  expect(panel.y - strip.y - strip.height).toBeLessThan(32);
}

async function readFurther(page, distance){
  const before = await body(page).evaluate(el => el.scrollTop);
  await body(page).evaluate((el, amount) => { el.scrollTop += amount; }, distance);
  await expect.poll(() => body(page).evaluate(el => el.scrollTop)).toBeGreaterThan(before + 100);
  return body(page).evaluate(el => el.scrollTop);
}

test.use({reducedMotion: 'reduce'});

test('a narrow phone keeps sections reachable while reading briefings and long notes in dark mode', async ({page}, testInfo) => {
  await page.setViewportSize({width: 320, height: 568});
  await page.emulateMedia({colorScheme: 'dark'});
  await seedNote(page);
  await openEvent(page);
  await expectReachableSections(page);
  expect(await body(page).evaluate(el => el.scrollTop)).toBe(0);
  await page.screenshot({path: testInfo.outputPath('sections-narrow-initial.png')});

  await chooseSection(page, 'Briefing');
  await expectPanelBelowSections(page, '#briefing-6');
  const briefingPosition = await readFurther(page, 650);
  await expectReachableSections(page);
  await page.screenshot({path: testInfo.outputPath('sections-narrow-briefing.png')});
  await chooseSection(page, 'Briefing');
  expect(await body(page).evaluate(el => el.scrollTop)).toBeCloseTo(briefingPosition, 0);

  await chooseSection(page, 'Notes');
  await expectPanelBelowSections(page, '#notes-6');
  const notePosition = await readFurther(page, 700);
  await expectReachableSections(page);
  const edit = sheet(page).getByRole('button', {name: 'Edit note', exact: true});
  await expect(edit).toBeInViewport({ratio: 1});
  const strip = await sections(page).boundingBox();
  expect((await edit.boundingBox()).y).toBeGreaterThanOrEqual(strip.y + strip.height - 1);
  await page.screenshot({path: testInfo.outputPath('sections-narrow-note.png')});

  await chooseSection(page, 'Briefing');
  await expect.poll(() => body(page).evaluate(el => el.scrollTop)).toBeCloseTo(briefingPosition, 0);
  await chooseSection(page, 'Notes');
  await expect.poll(() => body(page).evaluate(el => el.scrollTop)).toBeCloseTo(notePosition, 0);
  await expect(sheet(page).locator('.note-card .note-text')).toHaveText(longNote);
});

test('desktop keyboard section switching works in full screen without adding history entries', async ({page}, testInfo) => {
  await page.setViewportSize({width: 1280, height: 900});
  await openEvent(page);
  await sheet(page).getByRole('button', {name: 'Full screen', exact: true}).click();
  const historyLength = await page.evaluate(() => history.length);
  await sectionButton(page, 'Overview').focus();
  await page.keyboard.press('Tab');
  await expect(sectionButton(page, 'Briefing')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(sectionButton(page, 'Briefing')).toHaveAttribute('aria-pressed', 'true');
  await expectPanelBelowSections(page, '#briefing-6');
  await page.keyboard.press('Tab');
  await expect(sectionButton(page, 'Notes')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(sectionButton(page, 'Notes')).toHaveAttribute('aria-pressed', 'true');
  await expectReachableSections(page);
  await page.keyboard.press('Tab');
  await expect(sheet(page).getByRole('button', {name: 'Save note', exact: true})).toBeFocused();
  await page.keyboard.press('Tab');
  const editor = sheet(page).getByRole('textbox', {name: 'My note'});
  await expect(editor).toBeFocused();
  const toolbar = await sheet(page).locator('.note-toolbar').boundingBox();
  expect((await editor.boundingBox()).y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height - 1);
  await editor.fill('A note written using the keyboard.');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(sheet(page).getByRole('button', {name: 'Edit note', exact: true})).toBeFocused();
  await expect(sheet(page).locator('.note-card .note-text')).toHaveText('A note written using the keyboard.');
  await page.screenshot({path: testInfo.outputPath('sections-desktop-notes.png')});
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();
});

test('returning from a speaker keeps the event’s separate briefing and notes positions', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await seedNote(page);
  await openEvent(page);
  await chooseSection(page, 'Briefing');
  const briefingPosition = await readFurther(page, 400);
  await chooseSection(page, 'Notes');
  const notePosition = await readFurther(page, 500);
  await chooseSection(page, 'Overview');
  const speaker = sheet(page).locator('.people button.link').first();
  await speaker.click();
  await expect(sheet(page).locator('.profile')).toBeVisible();
  await page.goBack();
  await expect(sheet(page).locator('#sheet-title')).toHaveText(event.title);
  await expect(sectionButton(page, 'Overview')).toHaveAttribute('aria-pressed', 'true');
  await chooseSection(page, 'Briefing');
  await expect.poll(() => body(page).evaluate(el => el.scrollTop)).toBeCloseTo(briefingPosition, 0);
  await chooseSection(page, 'Notes');
  await expect.poll(() => body(page).evaluate(el => el.scrollTop)).toBeCloseTo(notePosition, 0);
  await expectReachableSections(page);
});

test('Edit note from the notebook reveals the editor below the section navigation', async ({page}) => {
  await page.setViewportSize({width: 320, height: 568});
  await seedNote(page);
  await page.goto('/');
  await page.getByRole('button', {name: /My festival/}).click();
  await sheet(page).getByRole('button', {name: `Edit note for ${event.title}`}).click();
  const editor = sheet(page).getByRole('textbox', {name: 'My note'});
  await expect(editor).toBeFocused();
  await expect(editor).toBeInViewport();
  await expectReachableSections(page);
  const strip = await sections(page).boundingBox();
  expect((await editor.boundingBox()).y).toBeGreaterThanOrEqual(strip.y + strip.height - 1);
  await expect(sheet(page).getByRole('button', {name: 'Save note', exact: true})).toBeInViewport({ratio: 1});
  await editor.fill(longNote + '\n\nA revision from the notebook.');
  await chooseSection(page, 'Briefing');
  await chooseSection(page, 'Notes');
  await expect(editor).toHaveValue(longNote + '\n\nA revision from the notebook.');
});

test('events without a briefing have two balanced sections and keep an unsaved note when switching', async ({page}) => {
  await page.setViewportSize({width: 320, height: 568});
  await openEvent(page, withoutBriefing.eventNo);
  await expect(sections(page).getByRole('button')).toHaveCount(2);
  await expect(sectionButton(page, 'Briefing')).toHaveCount(0);
  await expectReachableSections(page);
  const overviewWidth = (await sectionButton(page, 'Overview').boundingBox()).width;
  expect((await sectionButton(page, 'Notes').boundingBox()).width).toBeCloseTo(overviewWidth, 0);
  await chooseSection(page, 'Notes');
  const editor = sheet(page).getByRole('textbox', {name: 'My note'});
  await editor.fill('A thought from an event without a briefing.');
  await chooseSection(page, 'Overview');
  await expect(editor).toBeHidden();
  await chooseSection(page, 'Notes');
  await expect(editor).toHaveValue('A thought from an event without a briefing.');
  await expectReachableSections(page);
});
