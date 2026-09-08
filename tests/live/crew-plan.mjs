// tests/live/crew-plan.mjs — the crew plan, end to end, against the live Firebase project: two headless
// browsers signed in as the two test accounts (.env.local; see .env.example) drive the built app (dist/,
// cloud on) through creating a crew, adding to the plan from a card, inviting and joining, seeing the plan
// arrive on the other account, adding from the sheet, removing someone else's entry, the hub's plan list,
// the Crew filter, the cached ring on a reload, and closing the crew. It writes to the live project: a crew
// named below is created and closed. `npm run test:live` builds, resets both accounts and runs this;
// screenshots land in test-results/live/. Not part of `npm test` — it needs the project and the accounts.
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {accounts, config} from './accounts.mjs';

const {A, B} = accounts();
config();
const PORT = Number(process.env.HTLGI_LIVE_PORT || 4175), BASE = `http://localhost:${PORT}/`;
const CREW_NAME = 'Plan test crew';
const SHOTS = 'test-results/live';
const T = 30000;
fs.mkdirSync(SHOTS, {recursive: true});
if (!fs.existsSync('dist/index.html')) { console.error('dist/ is missing: run `npm run build` first (npm run test:live does).'); process.exit(2); }

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {stdio: 'ignore'});
for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 500)); }

const log = (...a) => console.log(...a);
const steps = [];
const record = (name, ok, detail = '') => { steps.push({name, ok, detail}); log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
function watch(page, label){
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
  page.errors = errors; page.label = label;
  return page;
}
const shot = async (page, name) => { await page.screenshot({path: `${SHOTS}/${name}.png`}); };

async function openHub(page){
  if (await page.locator('#sheet:not([hidden])').count()) await page.keyboard.press('Escape');
  await page.getByRole('button', {name: /My festival/i}).click();
  await page.getByRole('heading', {name: 'Your weekend'}).waitFor({state: 'visible', timeout: T});
}
const closeSheet = async page => { await page.keyboard.press('Escape'); await page.locator('#sheet').waitFor({state: 'hidden', timeout: T}); };
async function signIn(page, who){
  await page.goto(BASE, {waitUntil: 'domcontentloaded'});
  await openHub(page);
  await page.getByRole('button', {name: 'Use email and password'}).click();
  await page.getByPlaceholder('Email').fill(who.email);
  await page.getByPlaceholder('Password (8 or more characters)').fill(who.password);
  await page.getByRole('button', {name: 'Sign in', exact: true}).click();
  await page.getByRole('button', {name: 'Sign out', exact: true}).waitFor({state: 'visible', timeout: T});
}
const ringed = page => page.locator('article.ev.crew');
const crewChip = page => page.locator('.chip.crewchip');
const sheet = page => page.locator('#sheet');   // the sheet's buttons share their accessible names with the cards' toggles behind it
const title = async card => (await card.locator('.ev-title').textContent()).trim();
const count = (page, n) => page.waitForFunction(k => document.querySelectorAll('article.ev.crew').length === k, n, {timeout: T});

const browser = await chromium.launch();
const ctxA = await browser.newContext({viewport: {width: 1280, height: 900}});
const ctxB = await browser.newContext({viewport: {width: 1280, height: 900}});
const a = watch(await ctxA.newPage(), 'A');
const b = watch(await ctxB.newPage(), 'B');
a.on('dialog', d => d.accept()); b.on('dialog', d => d.accept());

try {
  log('\n== 1. sign in ==');
  await signIn(a, A); record('A signs in', true, A.email);
  await signIn(b, B); record('B signs in', true, B.email);
  record('both start with no crew (reset ran first)', (await a.getByRole('button', {name: 'Create a crew'}).count()) > 0 && (await b.getByRole('button', {name: 'Create a crew'}).count()) > 0);
  record('no crew: no masthead crew button, no Crew chip', (await a.locator('.mbtn.crewbtn').count()) === 0 && (await crewChip(a).count()) === 0);
  // a hash-only navigation to the invite link later does not reload the page, so an open hub would stay open
  await closeSheet(a); await closeSheet(b);

  log('\n== 2. A creates a crew ==');
  await openHub(a);
  await a.getByRole('button', {name: 'Create a crew'}).click();
  await a.getByPlaceholder('The Heath Three').fill(CREW_NAME);
  await a.getByRole('button', {name: /^Save$/}).click();
  await a.locator('.hub-card.crew .cname-h').waitFor({state: 'visible', timeout: T});
  record('crew created', (await a.locator('.hub-card.crew .cname-h').textContent()) === CREW_NAME);
  // "live" (a server members snapshot) only flips on a data change, so a crew of one says "last synced":
  // pre-existing, and not what this run is about
  await a.locator('.hub-card.crew .planline').waitFor({timeout: T});
  record('the card says the plan is empty and how to add to it', /Nothing in the crew’s plan yet/.test(await a.locator('.hub-card.crew .planline').textContent()));
  record('the hub opens with "Crew plan · 0"', (await a.locator('h3.crewplan-h').textContent()) === 'Crew plan · 0');
  await closeSheet(a);
  await a.locator('.mbtn.crewbtn').waitFor({state: 'visible', timeout: T});
  record('masthead crew button carries the crew name, count hidden at 0', (await a.locator('.mbtn.crewbtn .label').textContent()) === CREW_NAME && (await a.locator('[data-count-crew]').isHidden()));
  record('Crew chip appears at (0)', /Crew \(0\)/.test(await crewChip(a).textContent()));
  await shot(a, '01-a-crew-created');

  log('\n== 3. A adds the first card to the plan from its crew button ==');
  const cardA1 = a.locator('article.ev').first();
  const t1 = await title(cardA1);
  const starBefore = await cardA1.locator('.pick').getAttribute('aria-pressed');
  await cardA1.locator('.crewpick').click();
  await cardA1.locator('.crewpick[aria-pressed="true"]').waitFor({timeout: T});
  await count(a, 1);
  record('the card is ringed and its crew button pressed', true, t1);
  record('the star is untouched', (await cardA1.locator('.pick').getAttribute('aria-pressed')) === starBefore, `star was ${starBefore}`);
  await a.waitForFunction(() => /Crew \(1\)/.test(document.querySelector('.chip.crewchip')?.textContent || ''), null, {timeout: T});
  record('Crew chip counts (1)', true);
  record('masthead count shows 1', (await a.locator('[data-count-crew]').textContent()) === '1' && await a.locator('[data-count-crew]').isVisible());
  await shot(a, '02-a-first-plan-entry');

  log('\n== 4. A invites, B joins ==');
  await openHub(a);
  await a.getByRole('button', {name: 'Invite link'}).click();
  const inviteInput = a.locator('.banner input').first();
  await inviteInput.waitFor({state: 'visible', timeout: T});
  const inviteUrl = await inviteInput.inputValue();
  const localInvite = BASE + inviteUrl.slice(inviteUrl.indexOf('#'));   // the link names the live site; keep its fragment
  await a.getByRole('button', {name: 'Close'}).click().catch(() => {});
  await closeSheet(a);
  await b.goto(localInvite, {waitUntil: 'domcontentloaded'});
  const joinBtn = b.getByRole('button', {name: 'Join', exact: true});
  await joinBtn.waitFor({state: 'visible', timeout: T});
  await joinBtn.click();
  await b.locator('.mbtn.crewbtn').waitFor({state: 'visible', timeout: T});
  await b.waitForFunction(name => document.querySelector('.mbtn.crewbtn .label')?.textContent === name, CREW_NAME, {timeout: T});
  record('B joined: masthead crew button carries the crew name', true);

  log('\n== 5. B sees the plan A made ==');
  await count(b, 1);
  const cardB1 = ringed(b).first();
  record('B sees the same ringed card', (await title(cardB1)) === t1, await title(cardB1));
  record('B: Crew chip (1) and masthead count 1', /Crew \(1\)/.test(await crewChip(b).textContent()) && (await b.locator('[data-count-crew]').textContent()) === '1');
  record('B: the star is not set by the plan', (await cardB1.locator('.pick').getAttribute('aria-pressed')) === 'false');
  await cardB1.click();
  await b.locator('#sheet:not([hidden])').waitFor({timeout: T});
  // the name comes from the members snapshot, which lands a moment after the crew document's plan did
  await b.waitForFunction(() => /added by /.test(document.querySelector('.going .plan')?.textContent || ''), null, {timeout: T}).catch(() => {});
  const planLine = (await b.locator('.going .plan').textContent()).trim();
  record('the sheet says it is in the plan and who added it', /^In the crew’s plan · added by /.test(planLine), planLine);
  record('the sheet button reads "In the crew’s plan", pressed', (await sheet(b).getByRole('button', {name: 'In the crew’s plan'}).getAttribute('aria-pressed')) === 'true');
  await shot(b, '03-b-sheet-in-plan');
  await closeSheet(b);

  log('\n== 6. B adds a second event from the sheet; A sees it live ==');
  const cardB2 = b.locator('article.ev').nth(1);
  const t2 = await title(cardB2);
  await cardB2.click();
  await b.locator('#sheet:not([hidden])').waitFor({timeout: T});
  await sheet(b).getByRole('button', {name: 'Add to the crew’s plan'}).click();
  await sheet(b).getByRole('button', {name: 'In the crew’s plan'}).waitFor({timeout: T});
  await closeSheet(b);
  await count(b, 2);
  await count(a, 2);
  const aTitles = await Promise.all((await ringed(a).all()).map(title));
  record('A sees both entries without a reload', aTitles.includes(t1) && aTitles.includes(t2), aTitles.join(' / '));
  record('A: Crew chip (2), masthead 2', /Crew \(2\)/.test(await crewChip(a).textContent()) && (await a.locator('[data-count-crew]').textContent()) === '2');
  await shot(a, '04-a-two-entries');

  log('\n== 7. B removes A’s entry ==');
  await cardB1.locator('.crewpick').click();
  await count(a, 1);
  record('A sees A’s entry go, B’s stays', (await title(ringed(a).first())) === t2);
  await count(b, 1);

  log('\n== 8. the hub’s plan list ==');
  await openHub(a);
  record('A: "Crew plan · 1"', (await a.locator('h3.crewplan-h').textContent()) === 'Crew plan · 1');
  const rows = a.locator('.planday + ul.hub-list').first().locator('li');   // the hub's first list is my own picks by day
  const mark = (await rows.first().locator('.m .xtra').textContent()).trim();
  record('the row names who is going and who added it', /added by /.test(mark) && /Nobody going yet|Going: /.test(mark), mark);
  record('the row is B’s event', (await rows.first().locator('.n').textContent()).trim() === t2);
  record('the crew card counts 1 event in the plan', /^1 event in the crew’s plan\./.test(await a.locator('.hub-card.crew .planline').textContent()));
  await shot(a, '05-a-hub-plan');
  await closeSheet(a);

  log('\n== 9. the Crew filter and the cached ring on reload ==');
  await crewChip(b).click();
  await b.waitForFunction(() => document.querySelectorAll('article.ev').length === 1, null, {timeout: T});
  record('B: the Crew filter shows the plan only', (await title(b.locator('article.ev').first())) === t2);
  await b.locator('#status').waitFor({timeout: T});
  await shot(b, '06-b-crew-filter');
  await crewChip(b).click();
  await b.reload({waitUntil: 'domcontentloaded'});
  await count(b, 1);
  record('B: after a reload the ring is back (cache, then live)', (await title(ringed(b).first())) === t2);

  log('\n== 10. A closes the crew; B loses it ==');
  await openHub(a);
  await a.getByRole('button', {name: 'Close crew'}).click();
  await a.getByRole('button', {name: 'Create a crew'}).waitFor({state: 'visible', timeout: 45000});
  record('A closed the crew', true);
  // B's member document goes before the tombstone, so B hears "no longer in this crew" (CREW-SPEC section 3)
  await b.waitForFunction(() => /no longer in this crew|crew was closed/i.test(document.body.textContent || ''), null, {timeout: 45000})
    .then(() => record('B is told', true))
    .catch(() => record('B is told', false, 'no banner within 45s'));
  await b.waitForFunction(() => !document.querySelector('.mbtn.crewbtn') && !document.querySelector('article.ev.crew'), null, {timeout: T});
  record('B: crew button and rings are gone', true);
  await closeSheet(a);
  record('A: crew button and rings are gone', (await a.locator('.mbtn.crewbtn').count()) === 0 && (await ringed(a).count()) === 0);
  await shot(b, '07-b-closed');
} catch (e) {
  record('run completed', false, e.message.split('\n')[0]);
  log('\nSTACK:', e.stack);
  await shot(a, 'zz-a-failure').catch(() => {});
  await shot(b, 'zz-b-failure').catch(() => {});
}

log('\n===== console errors =====');
for (const p of [a, b]) {
  const bad = p.errors.filter(e => !/net::ERR|Failed to load resource|favicon/.test(e));
  log(`-- ${p.label} (${p.errors.length}, ${bad.length} not network) --`);
  p.errors.forEach(e => log('   ' + e.slice(0, 300)));
  record(`no React or script errors in ${p.label}`, !bad.some(e => /Minified React error|Rendered (more|fewer) hooks|#310|pageerror/.test(e)));
}
log('\n===== summary =====');
const failed = steps.filter(s => !s.ok);
log(`${steps.length - failed.length}/${steps.length} checks passed${failed.length ? ' — a run that stops part-way leaves a crew behind; the next npm run test:live resets it' : ''}`);
failed.forEach(s => log(`  FAILED: ${s.name} — ${s.detail}`));
await browser.close();
server.kill();
process.exit(failed.length ? 1 : 0);
