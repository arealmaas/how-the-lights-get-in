import {test, expect} from '@playwright/test';
import programme from '../../programme.json' with {type: 'json'};
import briefings from '../../data/briefings.json' with {type: 'json'};

const event = no => programme.events.find(e => e.eventNo === no);
const sheet = page => page.locator('#sheet');
const option = (page, no) => sheet(page).getByRole('article', {name: event(no).title, exact: true});
const comparison = page => sheet(page).getByRole('heading', {name: 'Compare your picks', exact: true});
const storedPicks = page => page.evaluate(() => JSON.parse(localStorage.getItem('htlgi-l26-picks')).sort((a, b) => a - b));

async function seedPicks(page, picks, extra = {}) {
  await page.addInitScript(({picks, extra}) => {
    // Seed only the first document so reloads exercise the actual saved choice.
    if (sessionStorage.getItem('comparison-fixture-seeded')) return;
    sessionStorage.setItem('comparison-fixture-seeded', 'yes');
    localStorage.setItem('htlgi-l26-picks', JSON.stringify(picks));
    localStorage.setItem('htlgi-l26-state', JSON.stringify({day: '2026-09-19', picksOnly: true}));
    for (const [kind, value] of Object.entries(extra)) localStorage.setItem(`htlgi-l26-${kind}`, JSON.stringify(value));
  }, {picks, extra});
}

async function openComparison(page) {
  await page.getByRole('button', {name: 'Compare overlapping picks', exact: true}).click();
  await expect(comparison(page)).toBeVisible();
}

async function expectNoOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await sheet(page).locator('#sheet-body').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
}

async function expectFullScreen(page) {
  await expect.poll(async () => {
    const box = await sheet(page).boundingBox();
    const viewport = page.viewportSize();
    return Math.abs(box.x) + Math.abs(box.y) + Math.abs(box.width - viewport.width) + Math.abs(box.height - viewport.height);
  }).toBeLessThan(2);
}

test('comparison includes filtered-out picks and separates overlapping slots by day', async ({page}) => {
  await seedPicks(page, [3, 6, 8, 84, 85]);
  await page.goto('/');
  await page.getByRole('searchbox', {name: 'Search', exact: true}).fill(event(3).title);
  await expect(page.locator('article.ev')).toHaveCount(1);
  await openComparison(page);
  for (const no of [3, 6, 8]) await expect(option(page, no)).toBeVisible();
  await expect(option(page, 84)).toHaveCount(0);
  const slots = sheet(page).getByRole('group', {name: 'Overlapping time slots'});
  await expect(slots.getByRole('button')).toHaveCount(2);
  await expect(slots.getByRole('button', {name: 'Saturday 10:00 · 3 options', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await slots.getByRole('button', {name: 'Sunday 10:30 · 2 options', exact: true}).click();
  await expect(option(page, 3)).toHaveCount(0);
  for (const no of [84, 85]) await expect(option(page, no)).toBeVisible();
  await page.reload();
  await expect(comparison(page)).toBeVisible();
  await expect(slots.getByRole('button', {name: 'Sunday 10:30 · 2 options', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect(option(page, 84)).toBeVisible();
});

test('each option gives the question, stakes, people, topics and practical ticket information', async ({page}, testInfo) => {
  await page.setViewportSize({width: 1440, height: 1000});
  await seedPicks(page, [6, 7]);
  await page.goto('/');
  await openComparison(page);
  for (const no of [6, 7]) {
    const e = event(no), card = option(page, no);
    await expect(card.getByRole('heading', {name: e.title, exact: true})).toBeVisible();
    await expect(card).toContainText(e.time);
    await expect(card).toContainText(e.venue);
    await expect(card).toContainText(e.type);
    await expect(card).toContainText(briefings[no].question);
    await expect(card).toContainText(briefings[no].why);
    for (const topic of e.topics) await expect(card).toContainText(topic);
    for (const person of e.people) {
      const name = person.name + (person.role === 'host' ? ' · host' : '');
      await expect(card.getByRole('button', {name, exact: true})).toBeVisible();
      const profile = programme.speakers.find(s => s.slug === person.slug);
      if (profile?.tagline) await expect(card).toContainText(profile.tagline);
    }
    await expect(card).toContainText('Included with the Festival Ticket');
    await expect(card).toContainText('optional Fast Pass £8 + VAT');
    await expect(card.getByRole('button', {name: 'Full event details', exact: true})).toBeVisible();
    await expect(card.getByRole('button', {name: 'Choose this event', exact: true})).toBeVisible();
  }
  await expect(option(page, 6)).toContainText('60 min');
  await expect(sheet(page)).toContainText(/60.minutes|an hour|one.hour/);
  await expect(sheet(page)).toContainText(/start times only/);
  await expectNoOverflow(page);
  await page.screenshot({path: testInfo.outputPath('comparison-desktop.png')});
  const programmeDetails = option(page, 6).locator('details').filter({has: page.getByText('Programme & arguments', {exact: true})});
  const summary = programmeDetails.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(programmeDetails).toHaveAttribute('open', '');
  await expect(programmeDetails).toContainText(briefings[6].sides[0].label);
  await page.keyboard.press('Tab');
  await expect(programmeDetails.getByRole('link', {name: 'Official event page ↗', exact: true})).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(summary).toBeFocused();
});

test('event and speaker details return to the selected comparison through Back, Forward and reload', async ({page}) => {
  await seedPicks(page, [3, 6, 84, 85]);
  await page.goto('/');
  await openComparison(page);
  await sheet(page).getByRole('group', {name: 'Overlapping time slots'}).getByRole('button', {name: 'Sunday 10:30 · 2 options', exact: true}).click();
  await option(page, 84).getByRole('button', {name: 'Full event details', exact: true}).click();
  await expect(sheet(page).locator('#sheet-title')).toHaveText(event(84).title);
  await expect(page).toHaveURL(url => url.hash === '#event=84');
  await sheet(page).locator('.people button.link').first().click();
  await expect(sheet(page).locator('.profile')).toBeVisible();
  const speakerName = await sheet(page).locator('#sheet-title').textContent();
  await page.reload();
  await expect(sheet(page).locator('#sheet-title')).toHaveText(speakerName);
  await page.goBack();
  await expect(sheet(page).locator('#sheet-title')).toHaveText(event(84).title);
  await page.goBack();
  await expect(comparison(page)).toBeVisible();
  await expect(option(page, 84)).toBeVisible();
  await expect(option(page, 3)).toHaveCount(0);
  await page.goForward();
  await expect(sheet(page).locator('#sheet-title')).toHaveText(event(84).title);
  await sheet(page).getByRole('button', {name: '← Back', exact: true}).click();
  await expect(comparison(page)).toBeVisible();
  await option(page, 84).getByRole('button', {name: event(84).people[0].name, exact: true}).click();
  await expect(sheet(page).locator('.profile')).toBeVisible();
  await sheet(page).getByRole('button', {name: '← Back', exact: true}).click();
  await expect(option(page, 84)).toBeVisible();
  await sheet(page).getByRole('button', {name: 'Close', exact: true}).click();
  await expect(sheet(page)).toBeHidden();
  await expect(page).toHaveURL(url => url.hash === '');
});

test('choosing removes direct overlaps, preserves compatible picks and notes, and can be undone', async ({page}) => {
  const note = 'Keep this question even if I choose the other event.';
  await seedPicks(page, [3, 6, 8, 84], {notes: {6: note}, verdicts: {6: 'Draw'}});
  await page.goto('/');
  await openComparison(page);
  await option(page, 3).getByRole('button', {name: 'Choose this event', exact: true}).click();
  // 3 ends at 11:00 when 8 starts. They belong to one conflict chain via 6,
  // but choosing 3 must not discard the perfectly compatible later event.
  await expect.poll(() => storedPicks(page)).toEqual([3, 8, 84]);
  await expect(sheet(page).getByRole('status')).toContainText(event(3).title);
  await expect(option(page, 6)).toBeVisible();
  await sheet(page).getByRole('button', {name: 'Undo choice', exact: true}).click();
  await expect.poll(() => storedPicks(page)).toEqual([3, 6, 8, 84]);
  await option(page, 6).getByRole('button', {name: 'Choose this event', exact: true}).click();
  await expect.poll(() => storedPicks(page)).toEqual([6, 84]);
  await sheet(page).getByRole('button', {name: 'Undo choice', exact: true}).click();
  await expect.poll(() => storedPicks(page)).toEqual([3, 6, 8, 84]);
  await option(page, 3).getByRole('button', {name: 'Choose this event', exact: true}).click();
  await page.reload();
  await expect(sheet(page)).toContainText('Your picks fit together');
  await expect.poll(() => storedPicks(page)).toEqual([3, 8, 84]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('htlgi-l26-notes')))).toEqual({6: note});
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('htlgi-l26-verdicts')))).toEqual({6: 'Draw'});
});

test('partial overlaps can be compared from both an event and My festival', async ({page}) => {
  await seedPicks(page, [3, 6]);
  await page.goto('/#event=3');
  await sheet(page).getByRole('button', {name: 'Compare these picks', exact: true}).click();
  await expect(comparison(page)).toBeVisible();
  await expect(option(page, 3)).toBeVisible();
  await expect(option(page, 6)).toBeVisible();
  await expect(sheet(page)).toContainText(/30 min/);
  await sheet(page).getByRole('button', {name: '← Back', exact: true}).click();
  await expect(sheet(page).locator('#sheet-title')).toHaveText(event(3).title);
  await sheet(page).getByRole('button', {name: 'Close', exact: true}).click();
  await page.getByRole('button', {name: /My festival/}).click();
  await sheet(page).getByRole('button', {name: 'Compare overlapping picks', exact: true}).click();
  await expect(comparison(page)).toBeVisible();
  await expect(option(page, 6)).toBeVisible();
  await sheet(page).getByRole('button', {name: '← Back', exact: true}).click();
  await expect(sheet(page).locator('#sheet-title')).toHaveText('Your weekend');
});

test('events without briefings retain their descriptions and make sold-out or extra tickets clear', async ({page}) => {
  await seedPicks(page, [1, 2]);
  await page.goto('/');
  await openComparison(page);
  await expect(option(page, 1)).toContainText('Modern science buries its assumptions.');
  await expect(option(page, 2)).toContainText('God is back in politics, and the New Right put him there.');
  await expect(option(page, 1)).toContainText(/sold out/i);
  await expect(option(page, 2)).toContainText('Not included with the Festival Ticket');
  for (const price of ['£25', '£30', '£35', 'VAT']) await expect(option(page, 2)).toContainText(price);
  await expect(option(page, 1).getByRole('button', {name: 'Full event details', exact: true})).toBeVisible();
  await expect(option(page, 2).getByRole('button', {name: 'Full event details', exact: true})).toBeVisible();
});

test('back-to-back picks do not produce a conflict comparison', async ({page}) => {
  await seedPicks(page, [3, 8, 84]);
  await page.goto('/');
  await expect(page.locator('article.ev')).toHaveCount(2);
  await expect(page.getByRole('button', {name: 'Compare overlapping picks', exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: /My festival/}).click();
  await expect(sheet(page).getByRole('button', {name: 'Compare overlapping picks', exact: true})).toHaveCount(0);
});

for (const {width, height, scheme} of [
  {width: 390, height: 844, scheme: 'light'},
  {width: 320, height: 568, scheme: 'dark'},
]) {
  test(`comparison stays readable and usable at ${width}px in ${scheme} mode`, async ({page}, testInfo) => {
    await page.setViewportSize({width, height});
    await page.emulateMedia({colorScheme: scheme, reducedMotion: 'reduce'});
    await seedPicks(page, [6, 7, 8]);
    await page.goto('/');
    await openComparison(page);
    await page.evaluate(() => document.fonts.ready);
    await expectNoOverflow(page);
    await page.screenshot({path: testInfo.outputPath(`comparison-${width}-${scheme}.png`)});
    await sheet(page).getByRole('button', {name: 'Full screen', exact: true}).click();
    await expectFullScreen(page);
    await expectNoOverflow(page);
    await sheet(page).getByRole('region', {name: 'Overlap timeline'}).getByRole('button', {name: /Lost in the Quantum World/}).click();
    await expect(option(page, 6).getByRole('heading', {name: event(6).title, exact: true})).toBeFocused();
    await expect(option(page, 6).getByRole('heading', {name: event(6).title, exact: true})).toBeInViewport();
    await page.screenshot({path: testInfo.outputPath(`comparison-card-${width}-${scheme}.png`)});
    for (const no of [6, 7, 8]) {
      const card = option(page, no);
      const box = await card.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      const choose = card.getByRole('button', {name: 'Choose this event', exact: true});
      await choose.scrollIntoViewIfNeeded();
      expect((await choose.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await expect(card).toContainText(briefings[no].why);
    }
    await option(page, 8).getByRole('button', {name: 'Full event details', exact: true}).click();
    await expect(sheet(page).locator('#sheet-title')).toHaveText(event(8).title);
    await expectFullScreen(page);
    await sheet(page).getByRole('button', {name: '← Back', exact: true}).click();
    await expect(comparison(page)).toBeVisible();
    await expectFullScreen(page);
    await option(page, 8).getByRole('button', {name: 'Choose this event', exact: true}).click();
    await expect.poll(() => storedPicks(page)).toEqual([8]);
    await sheet(page).getByRole('button', {name: 'Undo choice', exact: true}).click();
    await expect.poll(() => storedPicks(page)).toEqual([6, 7, 8]);
    await expectNoOverflow(page);
    const close = sheet(page).getByRole('button', {name: 'Close', exact: true});
    await expect(close).toBeInViewport();
    expect((await close.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(sheet(page)).toBeHidden();
    await expect(page.getByRole('button', {name: 'Compare overlapping picks', exact: true})).toBeFocused();
  });
}
