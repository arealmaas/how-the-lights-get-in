# React restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the planner from one 1 650-line HTML file to a Vite + React codebase with small modules, stores, and tests, at full behaviour parity, then finish the remaining crew features (remove and close, the overlay, the hub crew section, the crew calendar and reading list) in that codebase.

**Architecture:** Vite 8 + React 19 (JavaScript with JSX), four Zustand stores, pure logic under `src/core/`, the Firestore/auth layer under `src/cloud/` as plain modules that update the stores, hash routing in `src/routing.js`, a custom service worker built by `vite-plugin-pwa` in injectManifest mode, Vitest + Testing Library for units and components, Playwright for a headless smoke of the signed-out app, the existing emulator suite for the rules.

**Tech Stack:** vite ^8.2, react ^19.2, react-dom ^19.2, zustand ^5.0, firebase ^12.18, vite-plugin-pwa ^1.3, @vitejs/plugin-react ^6.1, vitest ^5.0, jsdom ^30, @testing-library/react ^16.3, @testing-library/jest-dom ^7, @testing-library/user-event, @playwright/test ^1.63, vite-plugin-singlefile ^2.3. Node 22. Python 3.9+ for the data pipeline.

**Spec:** `docs/superpowers/specs/2026-09-07-react-restructure-design.md` (the structure) and `CREW-SPEC.md` (the behaviour; sections 2, 3, 6, 7 are the authority for the ported cloud and crew code). The current implementation to port is `scripts/template.html` (sections marked `// ---------- name ----------`), `scripts/crew-core.js` and `scripts/test/`. The execution ledgers under `.superpowers/sdd/*/progress.md` record rulings that still bind (for example the change queue, the empty document for a foreign-marker device, the honest delete and clear paths, the re-validation of an invite before leaving).

## Global Constraints

- Behaviour parity with the current page for every feature it has, including the `.ics` output (byte-for-byte for the same input), the hash routes, the localStorage keys `htlgi-l26-state`, `-picks`, `-notes`, `-verdicts`, `-shared`, `-account`, `-queue`, `-crew-cache`, the `sessionStorage` keys `htlgi-l26-redirect` and `htlgi-l26-join`, and the copy.
- No `dangerouslySetInnerHTML` anywhere. Crew-supplied strings render as text.
- The Firebase SDK is imported only inside `src/cloud/firebase.js`, which is loaded with a dynamic `import()`; nothing else imports `firebase/*`. `CLOUD` is false when `data/firebase.json` is absent and the build must still succeed.
- `src/core/*` has no DOM, React or Firebase imports. `src/cloud/*` has no React imports.
- Every mutating planner action persists to localStorage and calls `sync.change(userFields, memberFields)`; field paths are dotted (`picks.41`) and deletions use the `'__DELETE__'` marker that `sync.change` maps to `deleteField()`.
- Tests: `npm test` (Vitest) must stay pristine; `npm run test:e2e` runs Playwright against `vite preview`; `npm run test:rules` runs the emulator suite unchanged. Every task ends with all of them green.
- Commit after every task; messages end with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; never push; never `git stash` (shared stash stack).
- British English, sentence case, "crew" throughout.

---

## File structure

See the design document's section 3 for the full layout. Tasks below name every file they create or touch.

---

### Task 1: Tooling, shell, CSS move, data pipeline trim

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html` (replaces the generated one), `src/main.jsx`, `src/App.jsx`, `src/styles/app.css`, `tests/setup.js`, `src/App.test.jsx`, `.nvmrc`
- Move: `img/` → `public/img/`, `icon-192.png`, `icon-512.png` → `public/`
- Delete: `sw.js`, `manifest.webmanifest`, `move/index.html` (all generated), `.nojekyll`
- Modify: `.gitignore`, `scripts/build.py` (data only), `README.md` (development section)

**Interfaces:**
- Produces: `npm run dev|build|preview|test|test:e2e|test:rules|data|build:move`; `src/styles/app.css` with the template's CSS verbatim; `<div id="app">` shell.

- [ ] **Step 1: `package.json`**

```json
{
  "name": "htlgi-planner",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:move": "vite build --config vite.move.config.js",
    "preview": "vite preview --port 4173 --strictPort",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:rules": "cd firebase/test && npm test",
    "data": "python3 scripts/build.py"
  },
  "dependencies": {
    "firebase": "^12.18.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.63.0",
    "@testing-library/jest-dom": "^7.0.0",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.0",
    "@vitejs/plugin-react": "^6.1.0",
    "jsdom": "^30.0.0",
    "vite": "^8.2.0",
    "vite-plugin-pwa": "^1.3.0",
    "vite-plugin-singlefile": "^2.3.0",
    "vitest": "^5.0.0"
  }
}
```

`.nvmrc`: `22`.

- [ ] **Step 2: `vite.config.js`** (the PWA plugin is added in Task 7; keep this minimal now)

```js
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {sourcemap: true},
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
  },
});
```

`tests/setup.js`:

```js
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: `index.html`** — the shell only. Take the `<head>` of `scripts/template.html` (charset, viewport, title, the two Google Fonts `<link>`s, `theme-color`, the manifest link is added by the PWA plugin later) and write:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>HowTheLightGetsIn London 2026 — unofficial planner</title>
<!-- copy the <link rel="preconnect"> and the fonts stylesheet <link> from scripts/template.html here, unchanged -->
<meta name="theme-color" content="#17191C">
<link rel="icon" href="/icon-192.png">
<link rel="apple-touch-icon" href="/icon-192.png">
</head>
<body>
<div id="app"></div>
<script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 4: CSS** — copy everything between `<style>` and `</style>` in `scripts/template.html` into `src/styles/app.css` unchanged.

- [ ] **Step 5: `src/main.jsx` and `src/App.jsx`**

```jsx
// src/main.jsx
import {createRoot} from 'react-dom/client';
import './styles/app.css';
import App from './App.jsx';

createRoot(document.getElementById('app')).render(<App />);
```

```jsx
// src/App.jsx — Task 4 fills this in; for now the masthead title so the smoke test has something to find
export default function App(){
  return (
    <header className="mast"><div className="mast-inner"><div className="brand">
      <h1>HowTheLightGetsIn <span>London 2026</span></h1>
    </div></div></header>
  );
}
```

- [ ] **Step 6: the failing test, then green**

`src/App.test.jsx`:

```jsx
import {render, screen} from '@testing-library/react';
import App from './App.jsx';

test('renders the masthead', () => {
  render(<App />);
  expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('HowTheLightGetsIn');
});
```

Run `npm install` then `npm test`: expect `1 passed`. Run `npm run build`: expect `dist/index.html` and `dist/assets/*.js`.

- [ ] **Step 7: assets, ignores, data pipeline**

`git mv img public/img && git mv icon-192.png icon-512.png public/ && git rm sw.js manifest.webmanifest move/index.html .nojekyll`. Append to `.gitignore`: `node_modules/`, `dist/`, `dist-move/`, `test-results/`, `playwright-report/`.

In `scripts/build.py`: delete `SW_TEMPLATE`, `MANIFEST`, `page_payload`, and in `main()` everything after `(ROOT / 'programme.json').write_text(...)` except the final `print` lines; delete the `--artifact`/`--preview` handling and the `firebase` loading; update the module docstring to say it writes `programme.json` only. `python3 scripts/build.py` must still print the counts.

README "Development": replace the paragraph with: "`npm install`, then `npm run dev` for a live-reloading dev server, `npm run build` for `dist/`, `npm test` for the unit and component tests, `npm run test:e2e` for the browser smoke (`npx playwright install chromium` once), `npm run test:rules` for the Firestore rules. `python3 scripts/build.py` regenerates `programme.json` from `data/extract.json`."

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "Vite + React scaffold: shell, styles, data pipeline trimmed, old generated files removed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Data module and the pure core, with tests

**Files:**
- Create: `src/data/index.js`, `src/core/time.js`, `labels.js`, `filters.js`, `clashes.js`, `calendar.js`, `notes.js`, `crew.js`, `reading.js`, `exports.js`, and a `*.test.js` next to each.

**Interfaces (exact exports):**
- `data/index.js`: `EVENTS, SPEAKERS, ACTS, BRIEFINGS, BRIEF_NOTE, MEDIA, PLAYLIST, EXTRA, byNo, spkBySlug, spkByName, actBySlug, GROUP, GROUPS, VENUES, TOPICS, DAYS, PERFORMANCE, LONDON_OFFSET_MIN, PUBLIC_URL, FIREBASE, CLOUD` — the same values the template computes near its top. `FIREBASE` comes from `Object.values(import.meta.glob('/data/firebase.json', {eager: true}))[0]?.default ?? null` and `CLOUD = !!FIREBASE`.
- `core/time.js`: `londonNow()`, `simulatedNow(search)`, `currentNow(search)`, `minutes(t)`, `addMinutes(t, mins)`, `dur(e)`, `isFestivalDay(date)`.
- `core/labels.js`: `ticketBadge(e) → {cls, text} | null`, `ticketLine(e)`, `whoPlain(e)`, `initials(name)`, `slug(s)`, `cleanDesc(s)`, `ytId(url)`.
- `core/filters.js`: `matches(e, f, picks, crewAny)` where `f = {day, groups, venue, topic, picksOnly, crewOnly, q}`; `hasFilters(f)`.
- `core/clashes.js`: `overlapMin(a, b)`, `computeClashes(events, picks) → {clashes: Map, soft: Map}` (same shapes as today).
- `core/calendar.js`: `eventTimes(e)`, `calDescription(e, prefix = '')`, `calLocation(e)`, `icsFile(events, name, prefixFor = null)`, `gcalLink(e)`, `icsFilename(e)`.
- `core/notes.js`: `b64u`, `mergeNoteText`, `encodeNotesParam`, `decodeNotesParam`, `picksToMap`, `mapToPicks`, `mergeState` (moved from `scripts/crew-core.js` as ES exports).
- `core/crew.js`: `projectForCrew`, `parseJoinHash`, `memberColour`, `pickedBy`, `crewSummary` (moved likewise).
- `core/reading.js`: `readingList(events, pickSet)`, `readingCount(items)`, `readingMarkdown(items)`.
- `core/exports.js`: `notesMarkdown(events, picks, notes, verdicts)`, `picksLink(origin, picks, verdicts)`, `safeDecode(s)`, `parseImportHash(hash, byNo) → {picks, verdicts, notes}` (the parsing half of today's `checkHash`).

- [ ] **Step 1: Port**, section by section from `scripts/template.html`: `// ---------- time ----------` → `time.js` (the `SIM`/`NOW` constants become functions of `location.search` so tests can pass a value); `// ---------- labels ----------` → `labels.js` and `filters.js` (`matches` takes its inputs as arguments instead of reading globals); `// ---------- clashes ----------` → `clashes.js` (returns the two maps instead of assigning globals); `// ---------- calendar export ----------` → `calendar.js` (`download()` stays in the UI layer, not here); `crew-core.js` → `notes.js` + `crew.js` (drop the IIFE and the `module.exports` line; `export` each function); `// ---------- reading list ----------` (`readingList`, `readingMarkdown`, `readingCount`) → `reading.js` taking `events` and a `Set` of picks; `notesMarkdown`, `picksLink`, `safeDecode` and the parsing part of `checkHash` → `exports.js`.

- [ ] **Step 2: Tests** — move `scripts/test/crew-core.test.mjs` cases into `notes.test.js` and `crew.test.js` (same assertions, ESM imports). Add:

```js
// src/core/calendar.test.js
import {icsFile, eventTimes, calDescription} from './calendar.js';
const e = {id: 'ev-9', eventNo: 9, title: 'Test, with; commas', type: 'Talks', venue: 'Ring', date: '2026-09-19', time: '14:30', speakers: ['A B'], hosts: [], topics: ['t'], description: 'd', ticketing: 'included', url: 'https://x/e', people: [], links: []};
test('times are exported in UTC with a one-hour London offset', () => {
  expect(eventTimes(e)).toEqual({start: '20260919T133000Z', end: '20260919T143000Z', dur: 60});
});
test('the ics file has the calendar wrapper, one event, escaped text and folded lines', () => {
  const ics = icsFile([e], 'HTLGI London 2026');
  expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
  expect(ics).toContain('UID:htlgi-london-2026-ev-9@arealmaas.github.io');
  expect(ics).toContain('SUMMARY:Test\\, with\; commas');
  expect(ics.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75)).toBe(true);
  expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
});
test('a prefix goes first in the description', () => {
  expect(calDescription(e, 'Going: you, Kari').startsWith('Going: you, Kari\n\n')).toBe(true);
});
```

```js
// src/core/clashes.test.js
import {computeClashes} from './clashes.js';
const ev = (no, time) => ({eventNo: no, date: '2026-09-19', time, type: 'Talks'});
test('starts within 15 minutes clash, a 30-minute overlap is soft', () => {
  const events = [ev(1, '10:00'), ev(2, '10:10'), ev(3, '10:30'), ev(4, '12:00')];
  const {clashes, soft} = computeClashes(events, new Set([1, 2, 3, 4]));
  expect([...clashes.keys()].sort()).toEqual([1, 2]);
  expect(soft.get(1).map(x => x.no)).toEqual([3]);
  expect(clashes.has(4)).toBe(false);
});
```

```js
// src/core/filters.test.js
import {matches, hasFilters} from './filters.js';
const f = {day: '2026-09-19', groups: [], venue: '', topic: '', picksOnly: false, crewOnly: false, q: ''};
const e = {eventNo: 1, date: '2026-09-19', type: 'Debates', venue: 'Arena', topics: ['Mind'], title: 'Free will', speakers: ['Sam'], hosts: [], description: ''};
test('filters compose', () => {
  expect(matches(e, f, new Set(), () => false)).toBe(true);
  expect(matches(e, {...f, day: '2026-09-20'}, new Set(), () => false)).toBe(false);
  expect(matches(e, {...f, groups: ['talks']}, new Set(), () => false)).toBe(false);
  expect(matches(e, {...f, q: 'free'}, new Set(), () => false)).toBe(true);
  expect(matches(e, {...f, picksOnly: true}, new Set([1]), () => false)).toBe(true);
  expect(matches(e, {...f, crewOnly: true}, new Set(), no => no === 1)).toBe(true);
  expect(hasFilters(f)).toBeFalsy();
  expect(hasFilters({...f, venue: 'Arena'})).toBeTruthy();
});
```

```js
// src/core/reading.test.js
import {readingList, readingCount} from './reading.js';
test('two books per speaker plus the briefing reading', () => {
  const events = [{eventNo: 1, date: '2026-09-19', time: '10:00', title: 'T', people: [{name: 'Sam', slug: 'sam'}]}];
  const extras = {sam: {books: [{title: 'A'}, {title: 'B'}, {title: 'C'}]}};
  const briefings = {1: {reading: [{title: 'R', by: 'X'}]}};
  const items = readingList(events, new Set([1]), extras, briefings);
  expect(items[0].bks.map(b => b.title)).toEqual(['A', 'B']);
  expect(items[0].reads).toEqual([{title: 'R', by: 'X'}]);
  expect(readingCount(items)).toBe(3);
});
```

(`readingList` therefore takes `extras` and `briefings` as arguments; the UI passes `EXTRA` and `BRIEFINGS`.)

```js
// src/core/exports.test.js
import {parseImportHash, picksLink, safeDecode} from './exports.js';
const byNo = new Map([[3, {}], [6, {}], [41, {}]]);
test('an import hash yields picks, verdicts and notes; garbage is ignored', () => {
  const r = parseImportHash('#picks=3,6,999&verdicts=6:Draw;7:X;41:&notes=', byNo);
  expect(r.picks).toEqual([3, 6]);
  expect(r.verdicts).toEqual({6: 'Draw'});
  expect(r.notes).toEqual({});
  expect(parseImportHash('#event=3', byNo)).toBeNull();
});
test('picksLink carries sorted picks and encoded verdicts', () => {
  expect(picksLink('https://x/', new Set([41, 3]), {6: 'A B'})).toBe('https://x/#picks=3,41&verdicts=6:A%20B');
});
test('safeDecode never throws', () => { expect(safeDecode('%E0%A4%A')).toBe(''); });
```

Run `npm test`: everything passes; `npm run build` still succeeds.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "Core modules: time, labels, filters, clashes, calendar, notes, crew, reading, exports — with tests"` (with the trailer).

---

### Task 3: Stores

**Files:**
- Create: `src/store/planner.js`, `src/store/sheet.js`, `src/store/banner.js`, `src/store/cloud.js`, `src/store/planner.test.js`, `src/store/sheet.test.js`, `src/cloud/sync.js` (stub with `change()` only; Task 8 fills it)

**Interfaces:** as the design document's section 4. Exact:

```js
// src/store/planner.js
import {create} from 'zustand';
import {byNo} from '../data/index.js';
import {change as syncChange} from '../cloud/sync.js';

export const LS = {state: 'htlgi-l26-state', picks: 'htlgi-l26-picks', notes: 'htlgi-l26-notes', verdicts: 'htlgi-l26-verdicts', shared: 'htlgi-l26-shared'};
export const DEL = '__DELETE__';
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const clean = (obj, ok) => Object.fromEntries(Object.entries(obj || {}).filter(([k, v]) => byNo.has(+k) && ok(v)));

export function hydrate(){
  const f = Object.assign({day: '2026-09-19', view: 'list', groups: [], venue: '', topic: '', picksOnly: false, crewOnly: false}, load(LS.state, {}));
  if (!['2026-09-19', '2026-09-20'].includes(f.day)) f.day = '2026-09-19';
  return {
    ...f, q: '',
    picks: new Set((load(LS.picks, []) || []).filter(n => byNo.has(n))),
    verdicts: clean(load(LS.verdicts, {}), v => typeof v === 'string' && v),
    notes: clean(load(LS.notes, {}), v => typeof v === 'string' && v.trim()),
    shared: clean(load(LS.shared, {}), v => v === true),
  };
}
const persistFilters = s => save(LS.state, {day: s.day, view: s.view, groups: s.groups, venue: s.venue, topic: s.topic, picksOnly: s.picksOnly, crewOnly: s.crewOnly});

export const usePlanner = create((set, get) => ({
  ...hydrate(),
  setFilter(patch){ set(patch); persistFilters(get()); },
  clearFilters(){ set({groups: [], venue: '', topic: '', picksOnly: false, crewOnly: false, q: ''}); persistFilters(get()); },
  setQuery(q){ set({q}); },
  togglePick(no){
    const picks = new Set(get().picks); const on = !picks.has(no);
    if (on) picks.add(no); else picks.delete(no);
    set({picks}); save(LS.picks, [...picks]);
    syncChange({['picks.' + no]: on ? true : DEL}, {['picks.' + no]: on ? true : DEL});
  },
  setVerdict(no, who){
    const verdicts = {...get().verdicts}; if (who) verdicts[no] = who; else delete verdicts[no];
    set({verdicts}); save(LS.verdicts, verdicts);
    syncChange({['verdicts.' + no]: who || DEL}, {['verdicts.' + no]: who || DEL});
  },
  setNote(no, text){
    text = String(text || '').slice(0, 20000);
    const notes = {...get().notes}; if (text.trim()) notes[no] = text; else delete notes[no];
    set({notes}); save(LS.notes, notes);
    syncChange({['notes.' + no]: notes[no] || DEL}, get().shared[no] ? {['notes.' + no]: notes[no] || DEL} : null);
  },
  setShared(no, on){
    const shared = {...get().shared}; if (on) shared[no] = true; else delete shared[no];
    set({shared}); save(LS.shared, shared);
    const note = get().notes[no];
    syncChange({['shared.' + no]: on ? true : DEL}, {['notes.' + no]: on && note ? note : DEL});
  },
  importFromLink({picks: inc = [], verdicts: inV = {}, notes: inN = {}}, mergeNoteText){
    const s = get(); const picks = new Set(s.picks); inc.forEach(n => picks.add(n));
    const verdicts = {...s.verdicts, ...inV};
    const notes = {...s.notes}; for (const [no, t] of Object.entries(inN)) notes[no] = mergeNoteText(notes[no], t);
    set({picks, verdicts, notes}); save(LS.picks, [...picks]); save(LS.verdicts, verdicts); save(LS.notes, notes);
    const uf = {}, mf = {};
    inc.forEach(n => { uf['picks.' + n] = true; mf['picks.' + n] = true; });
    for (const no of Object.keys(inV)) { uf['verdicts.' + no] = verdicts[no]; mf['verdicts.' + no] = verdicts[no]; }
    for (const no of Object.keys(inN)) { uf['notes.' + no] = notes[no]; if (s.shared[no]) mf['notes.' + no] = notes[no]; }
    if (Object.keys(uf).length) syncChange(uf, mf);
  },
  // the snapshot side of sync: replace the four maps without syncing back; `keepNote` is the note being typed
  replaceFromAccount({picks, verdicts, notes, shared}, keepNote){
    const s = get();
    const nextNotes = clean(notes, v => typeof v === 'string' && v.trim());
    if (keepNote != null) { if (s.notes[keepNote]) nextNotes[keepNote] = s.notes[keepNote]; else delete nextNotes[keepNote]; }
    const next = {picks: new Set(Object.keys(picks || {}).map(Number).filter(n => byNo.has(n))), verdicts: clean(verdicts, v => typeof v === 'string'), notes: nextNotes, shared: clean(shared, v => v === true)};
    const same = JSON.stringify([[...s.picks].sort(), s.verdicts, s.notes, s.shared]) === JSON.stringify([[...next.picks].sort(), next.verdicts, next.notes, next.shared]);
    if (same) return false;
    set(next); save(LS.picks, [...next.picks]); save(LS.verdicts, next.verdicts); save(LS.notes, next.notes); save(LS.shared, next.shared);
    return true;
  },
  local(){ const s = get(); return {picks: Object.fromEntries([...s.picks].map(n => [n, true])), verdicts: {...s.verdicts}, notes: {...s.notes}, shared: {...s.shared}}; },
  clearLocal(){ set({picks: new Set(), verdicts: {}, notes: {}, shared: {}}); Object.values(LS).forEach(k => localStorage.removeItem(k)); },
}));
```

```js
// src/store/sheet.js
import {create} from 'zustand';
export const useSheet = create((set, get) => ({
  stack: [],
  open(kind, key){ set({stack: [...get().stack, {kind, key}]}); },
  replaceTop(kind, key){ const s = get().stack.slice(0, -1); set({stack: [...s, {kind, key}]}); },
  back(){ set({stack: get().stack.slice(0, -1)}); },
  close(){ set({stack: []}); },
}));
export const topSheet = () => useSheet.getState().stack.at(-1) || null;
```

```js
// src/store/banner.js — actions are {label, primary?, onClick}; input is an optional read-only value with a Copy button
import {create} from 'zustand';
export const useBanner = create(set => ({
  banner: null,
  show(banner){ set({banner}); },
  hide(){ set({banner: null}); },
}));
export const showBanner = b => useBanner.getState().show(b);
export const hideBanner = () => useBanner.getState().hide();
export const okBanner = text => showBanner({text, actions: [{label: 'OK', onClick: hideBanner}]});
```

```js
// src/store/cloud.js
import {create} from 'zustand';
export const useCloud = create(set => ({
  user: null, accountName: '', marker: null, syncPending: false, syncStopped: false, syncPaused: false, signInBranch: '',
  crewId: null, crew: null,
  patch(p){ set(p); },
}));
```

`src/cloud/sync.js` for now:

```js
// Task 8 replaces this file. Until then the planner store's sync hook is a no-op.
export function change(){}
```

- [ ] **Step 1: tests, then the stores** — `src/store/planner.test.js`:

```js
import {vi, beforeEach, test, expect} from 'vitest';
vi.mock('../cloud/sync.js', () => ({change: vi.fn()}));
import {change} from '../cloud/sync.js';
import {usePlanner, DEL, LS} from './planner.js';

beforeEach(() => { localStorage.clear(); usePlanner.setState({picks: new Set(), verdicts: {}, notes: {}, shared: {}}); change.mockClear(); });

test('togglePick persists and syncs a field-level change', () => {
  usePlanner.getState().togglePick(3);
  expect(usePlanner.getState().picks.has(3)).toBe(true);
  expect(JSON.parse(localStorage.getItem(LS.picks))).toEqual([3]);
  expect(change).toHaveBeenLastCalledWith({'picks.3': true}, {'picks.3': true});
  usePlanner.getState().togglePick(3);
  expect(change).toHaveBeenLastCalledWith({'picks.3': DEL}, {'picks.3': DEL});
});
test('notes are capped and shared notes reach the member projection', () => {
  usePlanner.getState().setShared(6, true);
  usePlanner.getState().setNote(6, 'x'.repeat(20005));
  expect(usePlanner.getState().notes[6].length).toBe(20000);
  expect(change).toHaveBeenLastCalledWith({'notes.6': 'x'.repeat(20000)}, {'notes.6': 'x'.repeat(20000)});
  usePlanner.getState().setNote(7, 'private');
  expect(change).toHaveBeenLastCalledWith({'notes.7': 'private'}, null);
});
test('replaceFromAccount keeps the note being typed and reports whether anything changed', () => {
  usePlanner.getState().setNote(6, 'typing');
  const changed = usePlanner.getState().replaceFromAccount({picks: {3: true}, verdicts: {}, notes: {6: 'server', 41: 'other'}, shared: {}}, 6);
  expect(changed).toBe(true);
  expect(usePlanner.getState().notes).toEqual({6: 'typing', 41: 'other'});
  expect(usePlanner.getState().replaceFromAccount({picks: {3: true}, verdicts: {}, notes: {6: 'typing', 41: 'other'}, shared: {}}, null)).toBe(false);
});
test('importFromLink unions and syncs once', () => {
  usePlanner.getState().importFromLink({picks: [3, 6], verdicts: {6: 'Draw'}, notes: {6: 'n'}}, (a, b) => b);
  expect(change).toHaveBeenCalledTimes(1);
  expect(change.mock.calls[0][0]).toEqual({'picks.3': true, 'picks.6': true, 'verdicts.6': 'Draw', 'notes.6': 'n'});
});
```

Note: event numbers used in tests must exist in `programme.json` (`byNo`); 3, 6, 7 and 41 do.

`src/store/sheet.test.js`: open two sheets, `topSheet()` is the second, `back()` returns to the first, `close()` empties.

Run `npm test` — the store tests fail until the stores exist; write the stores; all green.

- [ ] **Step 2: Commit** — `"Stores: planner, sheet, banner, cloud — with tests"` (trailer).

---

### Task 4: The shell: masthead, toolbar, list, grid, now & next, footer, e2e smoke

**Files:**
- Create: `src/ui/Masthead.jsx`, `Toolbar.jsx`, `Chips.jsx`, `Status.jsx`, `NowNext.jsx`, `EventList.jsx`, `EventGrid.jsx`, `EventCard.jsx`, `Footer.jsx`, `Banner.jsx`, `src/ui/EventCard.test.jsx`, `playwright.config.js`, `tests/e2e/smoke.spec.js`
- Modify: `src/App.jsx`, `src/main.jsx` (hash on boot comes in Task 5)

**Interfaces:**
- `App` composes: `<Masthead/>` (brand, the *My festival* and *Reading list* buttons with counts, opening the `hub` and `reading` sheets), `<Toolbar/>` (day segment, view segment, search box with clear, `<Chips/>`, venue and topic selects, `<Status/>`), `<Banner/>`, `<NowNext/>`, `<main>` with `<EventList/>` or `<EventGrid/>` by `view`, `<Footer/>`, and `<Sheet/>` (Task 5; render nothing until then).
- A hook `useFiltered()` in `src/ui/useFiltered.js` returns `{list, clashes, soft, crewAny}` from the planner store (`computeClashes` over picks, `matches` per event, `crewAny` from the cloud store's crew — `() => false` until Task 10).
- `EventCard({e, picked, clash, hasNote})` renders the card markup of `renderList`'s inner template (star button, kicker, title, who line with hosts, footer badges and tags) with `onClick` → `useSheet.open('event', e.eventNo)` and the star → `togglePick`.

- [ ] **Step 1: Port the markup** from `renderList`, `renderGrid`, `renderChips`, `renderStatus`, `renderNowNext`, the `<header class="mast">`, `<div class="top">`, `<footer>` blocks, keeping every class name so `app.css` applies unchanged. Interactive `data-*` buttons become `onClick` handlers on store actions. The masthead counts are `picks.size` and `readingCount(readingList(EVENTS, picks, EXTRA, BRIEFINGS))`. The footer's "saved in this browser / or in your account" sentence and the privacy paragraph render on `CLOUD` (`{CLOUD && <div className="noprint" id="privacy">…</div>}`). `NowNext` re-renders every minute on festival days (`setInterval` in a `useEffect`).
- [ ] **Step 2: `Banner.jsx`** renders `useBanner().banner` as `<div className="banner"><div className="banner-inner"><span>{text}</span>{input && <input readOnly value={input} aria-label="Link"/>}{actions.map(a => <button type="button" className={'btn' + (a.primary ? ' primary' : '')} onClick={a.onClick}>{a.label}</button>)}</div></div>` and scrolls itself into view when it appears.
- [ ] **Step 3: Component test** `EventCard.test.jsx`: render a fixture event picked with a clash and a note; expect the star to have `aria-pressed="true"`, the `✎ notes` badge, and the clash badge text; click the star → the planner store's `togglePick` was called (spy via `usePlanner.setState({togglePick: vi.fn()})`).
- [ ] **Step 4: Playwright** — `playwright.config.js`:

```js
import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  use: {baseURL: 'http://localhost:4173'},
  webServer: {command: 'npm run build && npm run preview', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 120000},
  projects: [{name: 'chromium', use: {browserName: 'chromium'}}],
});
```

`tests/e2e/smoke.spec.js`:

```js
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
```

Run `npx playwright install chromium` once, then `npm run test:e2e`: passes. `npm test` green.

- [ ] **Step 5: Commit** — `"Shell UI: masthead, toolbar, list, grid, now & next, footer, banner; e2e smoke"` (trailer).

---

### Task 5: Sheets: event, speaker, act; notes and verdicts; `#event=`

**Files:**
- Create: `src/ui/Sheet.jsx`, `src/ui/sheets/EventSheet.jsx`, `SpeakerSheet.jsx`, `ActSheet.jsx`, `src/ui/event/People.jsx`, `Media.jsx`, `Briefing.jsx`, `Notes.jsx`, `Verdict.jsx`, `src/ui/download.js` (`download(filename, text, mime)` from the template), `src/routing.js` (only `#event=` for now), `src/ui/sheets/EventSheet.test.jsx`, `src/ui/event/Notes.test.jsx`
- Modify: `src/App.jsx` (render `<Sheet/>`), `src/main.jsx` (call `routing.boot()` after render; listen to `hashchange`)

**Interfaces:**
- `Sheet` renders the top of the sheet stack inside the `#sheet` dialog markup from the template (grip, back button when the stack is deeper than one, close button, scrim), focuses the `h2` on open, closes on Escape and on scrim click, and re-renders when the stack changes.
- `EventSheet({no})` ports `showEvent`: hero, kicker, title, when, clash notes (from `useFiltered`), tabs when a briefing exists, the overview (People, description, Media, meta, actions: pick toggle, *Add to calendar (.ics)* → `download(icsFilename(e), icsFile([e], 'HTLGI London 2026'), 'text/calendar;charset=utf-8')`, *Google Calendar* link), then `<Verdict/>` for debates and `<Notes/>`.
- `Notes({no})`: a controlled textarea with a local `draft`; on change, set the draft and schedule `setNote` after 250 ms; on blur, flush; when the store note changes and the textarea is not focused, the draft follows. The caption reads "Saved to your account." when `useCloud().user` else "Saved in this browser only.", followed by the export sentence. (The share checkbox arrives in Task 10.)
- `Verdict({e})`: the "Who won?" pills; clicking the selected one clears it.
- `routing.js`: `boot()` reads `location.hash` for `event=` (switch the day if needed, `useSheet.open('event', no)`); `onHashChange` does the same. (`#join=` and the import banner join in Tasks 6 and 9.)

- [ ] **Step 1: Port** `openSheet`/`closeSheet`/`goBack` into `Sheet.jsx`; `showEvent`, `mediaBlock`, `briefingBlock`, `talkBriefingBlock`, `appearsList`, `showSpeaker`, `extrasBlock`, `showAct` into the components; `avatar`/`hero`/`portrait` become small components in `People.jsx` (photos are `/img/...` paths from `programme.json`'s `photo`). The YouTube embed keeps the click-to-load behaviour.
- [ ] **Step 2: Tests** — `EventSheet.test.jsx`: open event 6 (a debate) in the sheet store, render `<Sheet/>`, expect the title, a *Who won?* label, the notes textarea; click *Add to my picks* → the store has 6 in `picks`. `Notes.test.jsx` with `vi.useFakeTimers()`: type into the textarea, advance 250 ms, `usePlanner.getState().notes[6]` equals the text; then `usePlanner.setState({notes: {6: 'server'}})` while focused → the textarea still shows the typed text; blur → still the typed text (the draft won).
- [ ] **Step 3: e2e** — add to `smoke.spec.js`: open the first card, expect the dialog with the title, type a note, close, reopen → the note persists; visit `/#event=6` → the dialog opens with event 6's title.
- [ ] **Step 4: Commit** — `"Sheets: event, speaker, act; notes with a draft; verdicts; #event= routing"` (trailer).

---

### Task 6: Hub, stats, reading list, share and export, the import banner

**Files:**
- Create: `src/ui/sheets/HubSheet.jsx`, `StatsSheet.jsx`, `ReadingSheet.jsx`, `src/ui/hub/HubCards.jsx`, `DayList.jsx`, `src/ui/hub/HubSheet.test.jsx`
- Modify: `src/routing.js` (the import banner), `src/ui/Sheet.jsx` (dispatch the three kinds), `tests/e2e/smoke.spec.js`

**Interfaces:**
- `HubSheet` ports `showHub`: summary line, the four cards (reading list card opening the reading sheet; calendar export of all picks; the share link input with Copy using `picksLink(location.origin + location.pathname, picks, verdicts)`; notes with *Export notes (.md)*), the day lists via `DayList` (ports `hubList`), the foot (stats, about). The Account and Crew cards and the crew section are slots filled in Tasks 8–10: render `<AccountCard/>` and `<CrewCard/>` from `src/ui/hub/` only when `CLOUD`; create them now as components returning `null`.
- `StatsSheet` ports `showStats` and `barList`; `ReadingSheet` ports `showReadingList` with *Export (.md)* and *Copy as text* (the Mine/Crew tabs arrive in Task 10).
- `routing.js` gains the import flow: on boot and on `hashchange`, `parseImportHash(location.hash, byNo)`; compute what is fresh against the store; if nothing, strip the hash; else `showBanner({text: 'This link carries 2 picks, 1 verdict (…you don't have yet).', actions: [{label: 'Add them to mine', primary: true, onClick}, {label: 'Not now', onClick}]})` with the pluralised counts; *Add* calls `usePlanner.getState().importFromLink(fresh, mergeNoteText)`, strips the hash, hides the banner; *Not now* strips the hash and hides.

- [ ] **Step 1: Port and wire**; `HubSheet.test.jsx`: with three picks in the store, render, expect "3 picks", the share link value contains `#picks=`, and the reading-list card. `routing.test.js` (jsdom): set `location.hash` to an import link, call `boot()`, expect the banner store to hold the text with the right counts; click *Add* → store updated and hash cleared.
- [ ] **Step 2: e2e**: visit `/#picks=3,6&verdicts=6:Draw&notes=<param from encodeNotesParam>` → banner → *Add them to mine* → count 2, open event 6 → verdict Draw and the note text.
- [ ] **Step 3: Commit** — `"Hub, stats and reading sheets; share link, exports, import banner"` (trailer).

---

### Task 7: PWA, the move page, hosting and workflows

**Files:**
- Create: `src/sw.js`, `src/sw.test.js`, `vite.move.config.js`, `move/index.html`, `move/main.js`
- Modify: `vite.config.js`, `src/main.jsx` (register the service worker), `firebase.json` (`hosting.public: "dist"`), `.github/workflows/firebase-hosting-merge.yml`, `.github/workflows/firebase-hosting-pull-request.yml`, `.github/workflows/deploy.yml`
- Delete: `scripts/move-template.html`, `scripts/assemble-site.sh`

**Interfaces:**
- The built `dist/sw.js` precaches the app shell from `self.__WB_MANIFEST`, keeps photos in the immutable `htlgi-img-v1` cache (best effort, from the same manifest filtered on `/img/`), uses a scope-namespaced cache for everything else, serves pages network-first, never intercepts same-origin `/__/*`, and caches `fonts.googleapis.com`, `fonts.gstatic.com` and same-origin assets with stale-while-revalidate.

- [ ] **Step 1: `vite.config.js`**

```js
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectManifest: {globPatterns: ['**/*.{js,css,html,png}', 'img/**/*.webp'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024},
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'HTLGI London 2026 Planner', short_name: 'HTLGI 2026',
        description: 'Unofficial planner for the HowTheLightGetsIn London festival, 19–20 September 2026.',
        start_url: '/', scope: '/', display: 'standalone', background_color: '#F3F4F1', theme_color: '#17191C',
        icons: [{src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'}, {src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'}, {src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'}],
      },
    }),
  ],
  build: {sourcemap: true},
  test: {environment: 'jsdom', setupFiles: ['./tests/setup.js'], include: ['src/**/*.test.{js,jsx}'], css: false},
});
```

- [ ] **Step 2: `src/sw.js`** — the current `sw.js` logic (see `SW_TEMPLATE` in git history at commit 81f9962, or the committed `sw.js` before Task 1 removed it) rewritten around the manifest:

```js
/* eslint-env serviceworker */
const MANIFEST = self.__WB_MANIFEST || [];
const SCOPE_TAG = self.registration.scope.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(-40);
const PREFIX = 'htlgi-' + SCOPE_TAG + '-';
const BUILD = MANIFEST.map(e => e.revision || e.url).join('|');
const CACHE = PREFIX + hash(BUILD);
const IMG_CACHE = 'htlgi-img-v1';
const urlOf = e => new URL(e.url, self.registration.scope).href;
const ASSETS = MANIFEST.filter(e => !e.url.includes('img/')).map(urlOf);
const IMAGES = MANIFEST.filter(e => e.url.includes('img/')).map(urlOf);
function hash(s){ let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); }

self.addEventListener('install', e => {
  const core = caches.open(CACHE).then(c => c.addAll(ASSETS.concat([self.registration.scope])));
  const photos = caches.open(IMG_CACHE).then(c => Promise.all(IMAGES.map(u => c.match(u).then(hit => hit || c.add(u).catch(() => {})))));
  e.waitUntil(Promise.all([core, photos]).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/__/')) return;   // Firebase auth helpers: never intercepted
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(self.registration.scope, r.clone())); return r; }).catch(() => caches.match(self.registration.scope)));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.includes('/img/')) {
    e.respondWith(caches.open(IMG_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }))));
    return;
  }
  const cacheable = url.origin === self.location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!cacheable) return;
  e.respondWith(caches.match(req).then(cached => {
    const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') caches.open(CACHE).then(c => c.put(req, r.clone())); return r; }).catch(() => cached);
    return cached || net;
  }));
});
```

In `src/main.jsx` add `import {registerSW} from 'virtual:pwa-register'; registerSW({immediate: true});` (guarded by `if ('serviceWorker' in navigator)`).

- [ ] **Step 3: `src/sw.test.js`** — port `scripts/test/sw.test.mjs`'s `vm` sandbox against `src/sw.js` with `self.__WB_MANIFEST = [{url: 'index.html', revision: '1'}, {url: 'assets/a.js', revision: '2'}, {url: 'img/x.webp', revision: null}]` in the sandbox: the activate sweep deletes only same-scope caches; `/__/auth/handler` (navigate) and `apis.google.com` are not responded; `/programme.json` and the fonts host are; images go to the image cache.
- [ ] **Step 4: the move page** — `move/index.html` is the current `scripts/move-template.html` with the `<script>/*__CORE__*/</script>` line removed and the inline IIFE replaced by `<script type="module" src="./main.js"></script>`; `move/main.js` is that IIFE's body with `import {encodeNotesParam} from '../src/core/notes.js';` at the top and `CrewCore.encodeNotesParam` → `encodeNotesParam`. `vite.move.config.js`:

```js
import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
export default defineConfig({root: 'move', plugins: [viteSingleFile()], build: {outDir: '../dist-move', emptyOutDir: true}});
```

`npm run build:move` → `dist-move/index.html` self-contained; `grep -c 'encodeNotesParam\|__DELETE__' dist-move/index.html` shows the codec inlined once.

- [ ] **Step 5: hosting and workflows** — `firebase.json`: `"public": "dist"`. Merge workflow steps: checkout, setup-node 22 with `cache: npm`, `npm ci`, `npm test`, rules tests (`cd firebase/test && npm ci && npm test`, JDK already on ubuntu-latest), deploy rules with the local binary as today, `npm run build`, hosting deploy of `dist`. PR workflow: checkout, setup-node, `npm ci`, `npm test`, `npm run build`, preview deploy. `deploy.yml`: build step `npm ci && npm run build:move` then publish `folder: dist-move`. Validate the YAML with the Ruby one-liner. Delete `scripts/move-template.html` and `scripts/assemble-site.sh`.
- [ ] **Step 6: verify** `npm run build` writes `dist/sw.js` containing `htlgi-img-v1` and no `__WB_MANIFEST` placeholder left unresolved (grep `self.__WB_MANIFEST` is replaced by an array literal); `npm test` green; `npm run test:e2e` green (Playwright runs against the built preview, so the SW is exercised in Chromium: add an assertion that `navigator.serviceWorker.controller` becomes non-null after a reload).
- [ ] **Step 7: Commit** — `"PWA service worker via injectManifest, the move page as a single-file build, workflows on npm"` (trailer).

---

### Task 8: Cloud: Firebase loader, auth, the sign-in sequence and sync, the Account card

**Files:**
- Create: `src/cloud/firebase.js`, `src/cloud/auth.js`, `src/cloud/sync.js` (replaces the stub), `src/cloud/sync.test.js`, `src/cloud/auth.test.js`, `src/ui/hub/AccountCard.jsx` (replaces the null component), `src/ui/hub/AccountCard.test.jsx`
- Modify: `src/main.jsx` (`auth.bootCloud()`), `src/routing.js` (the redirect flag), `src/ui/hub/HubSheet.jsx` (the Account card slot)

**Interfaces:**
- `cloud/firebase.js` (the only file importing `firebase/*`): `export async function init(config)` → `{app, auth, db, A, F}` where `A` and `F` are the namespaces from `firebase/auth` and `firebase/firestore` (`import * as A from 'firebase/auth'`), initialising Firestore with `persistentLocalCache({tabManager: persistentMultipleTabManager()})`. Memoised.
- `cloud/auth.js`: `loadFirebase(auto)` (dynamic `import('./firebase.js')`, wires `onAuthStateChanged` → `onAuth`, handles the redirect flag, error banners as ruled: auto+offline → short line, auto+online → console, manual → the technical banner), `bootCloud()` (loads when the marker, the redirect flag or a pending invite exists), `signInGoogle()` (popup on desktop, redirect on `PHONE || STANDALONE`), `emailAction(kind, {email, password, name})` for `signin|create|reset|link`, `authText(e)`, `authMessage(e)`, `signOutUser(clearDevice)` (confirm on plain sign-out; clear-device removes every `htlgi-l26-*` key, `sessionStorage`, `terminate()` + `clearIndexedDbPersistence()` with the "other tabs" alert, reload), `changeName(name)`, `reauth()`, `deleteAccount()` (the re-auth pre-check, honest failure banners, re-entrancy guard). `STANDALONE`, `IOS`, `PHONE` live in `src/cloud/platform.js`.
- `cloud/sync.js`: `change(userFields, memberFields)` (the queue + `withSentinels` + batch), `afterSignIn(user)` (the five branches, `signInBranch` recorded in the cloud store, the `online` retry, the queue replay on the fast path and clearing on the others), `subscribeUser()`, `applyUserData(data)` (calls `usePlanner.getState().replaceFromAccount(data, focusedNote())` where `focusedNote()` reads `document.activeElement` for a `textarea[data-note]`, sets `accountName`, `crewId` in the cloud store and calls `crew.onPointer()` from `cloud/crew.js` — a no-op module until Task 9), `stopSync(msg)`, `syncError(e)`, `unsubscribeUser()`. Field-level writes: `b.update(ref, {...withSentinels(fields), updatedAt: F.serverTimestamp()})`.
- `AccountCard`: the signed-out state (Google and email buttons, order per standalone iOS, the email form with Sign in / Create account / Forgot password, Enter submits via the form's `onSubmit`, inline message), the signed-in state (name, email, the sync sentence from the flags, Change name, Add a password with its form, Sign out, Sign out and clear this device, Delete account, the privacy line as a button that closes the sheet and scrolls to `#privacy`).

- [ ] **Step 1: Port** the account section of `scripts/template.html` function by function into `auth.js` and `sync.js`, replacing every `showBanner('<span>…</span><button …>')` with `okBanner('…')` or `showBanner({text, actions})`, every `refreshSheet()` with nothing (React re-renders from the stores), `accountName`/`user`/flags with `useCloud.getState().patch({...})`, and `localState()` with `usePlanner.getState().local()`. Keep the localStorage/sessionStorage keys and the `'__DELETE__'` marker. `syncStats` becomes `useCloud`'s `stats: {writes, snapshots}`.
- [ ] **Step 2: Tests with a mocked Firebase** — `vi.mock('./firebase.js', () => ({init: vi.fn(async () => fake)}))` where `fake` has `A` = `{onAuthStateChanged: vi.fn(), getRedirectResult: vi.fn(async () => null), signOut: vi.fn(), …}` and `F` = `{doc: (db, ...p) => p.join('/'), getDocFromServer: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn(), onSnapshot: vi.fn(), writeBatch: () => batch, serverTimestamp: () => 'TS', deleteField: () => 'DELETE_FIELD'}` and `batch = {update: vi.fn(), set: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => {})}`. Cases in `sync.test.js`: (a) marker matches → `signInBranch === 'subscribe'` and a queued change from localStorage is replayed as one batch with `DELETE_FIELD` substituted; (b) no document and no marker → `setDoc` with the complete document from local state (`create-from-local`); (c) no document, foreign marker → `setDoc` with empty maps (`create-empty`); (d) document and no marker → `mergeState` result written and the "Merged N picks" banner shown (`merge`); (e) document and foreign marker → `replace`; (f) `getDocFromServer` rejects → `syncPending` true, banner shown, no marker; (g) `change()` with no `fb` and a marker → queued in `htlgi-l26-queue`, not written; (h) a snapshot with `exists() === false` while not deleting → `stopSync` sets `syncStopped`; (i) `syncError({code: 'resource-exhausted'})` shows the pause banner once. `auth.test.js`: `authText` mappings; `signInGoogle` chooses redirect when `PHONE`; `deleteAccount` refuses when `crewOwnedByMe` (mock `cloud/crew.js`) and re-auths first when the last sign-in is old.
- [ ] **Step 3: `AccountCard.test.jsx`**: signed-out renders both buttons and the hidden email form; signed-in with `syncPending` shows "not synced yet"; with `syncStopped` shows "Sync stopped"; the Google button is listed after the email button when `STANDALONE && IOS` (mock `cloud/platform.js`).
- [ ] **Step 4: wire** `HubSheet` to render `<AccountCard/>` when `CLOUD`; `main.jsx` calls `bootCloud()` after the first render. `npm test`, `npm run build`, `npm run test:e2e` (the e2e runs without `data/firebase.json`, so the card is absent: assert the hub shows no Account card in that mode).
- [ ] **Step 5: Commit** — `"Cloud layer: Firebase loader, auth flows, sign-in sequence, sync queue; Account card"` (trailer).

---

### Task 9: Crews: subscriptions, cache, create, join, leave, remove, hand over, close; the Crew card

**Files:**
- Create: `src/cloud/crew.js` (replaces the no-op), `src/cloud/crew.test.js`, `src/ui/hub/CrewCard.jsx` (replaces the null component), `src/ui/hub/CrewCard.test.jsx`
- Modify: `src/routing.js` (`#join=`), `src/cloud/sync.js` (`afterSubscribe` → `offerJoin`), `src/main.jsx` (crew cache overlay on boot)

**Interfaces:**
- `cloud/crew.js`: `onPointer()`, `subscribeCrew(id)`, `unsubscribeCrew()`, `crewGone(msg)`, `createCrew(name)`, `renameCrew(name)`, `leaveCrew(silent) → boolean`, `closeCrew(silent) → boolean`, `removeMember(uid)`, `readmit(uid)`, `makeOwner(uid)`, `createInvite() → token`, `revokeInvite(token)`, `inviteLink(token)`, `liveInvites()`, `pendingJoin()`, `clearJoin()`, `offerJoin()`, `acceptJoin()`, `crewOwnedByMe()`, `others()`; all reading and writing `useCloud` (`crewId`, `crew`) and using `usePlanner.getState().local()` for projections. Ported from the crew section of `scripts/template.html` plus the Phase 2 Task 5 code that was never applied (`removeMember`, `readmit`, `makeOwner`, `closeCrew` from `docs/superpowers/plans/2026-09-07-crew-phase-2-crews-and-invites.md`, Task 5).
- Parked ruling applied here: `acceptJoin()` re-reads the invite (`getDoc`) and stops with the "no longer works" banner **before** calling `leaveCrew(true)` when the invite is missing, revoked or expired.
- `CrewCard`: no crew → Create a crew (a name prompt rendered as a small inline form, not `window.prompt`); in a crew → name, members with colours and pick counts, live invites with Copy/Revoke, Invite link, Rename (inline form), Leave, and for the creator Remove / Make owner per member, Close crew, and the Removed list with Re-admit. Confirmations use `window.confirm` as today.
- Prompts: the template used `prompt()` for crew names; the React version uses inline forms (a `NamePrompt` component with an input and Save/Cancel) so the e2e can drive them.

- [ ] **Step 1: Port and add** with the same batch shapes as the spec (verify against `firebase/firestore.rules`; the emulator tests already prove those shapes).
- [ ] **Step 2: Tests** — `crew.test.js` with the same mocked Firebase pattern: `createCrew('X')` issues one batch with `set(crews/id)`, `set(members/uid)`, `update(users/uid)`; `acceptJoin()` with a pending invite whose `getDoc` returns `revoked: true` shows the banner and never calls `leaveCrew` or a batch; with a live invite it batches member+pointer then drops `invite`; a members snapshot without the own document (not from cache, not leaving) calls `crewGone`; `removeMember` batches a delete plus a block record with the name; `closeCrew` deletes in chunks of at most nine then tombstones with the own member delete and pointer removal. `CrewCard.test.jsx`: owner sees Remove/Make owner/Close; member does not; a live invite renders Copy and Revoke.
- [ ] **Step 3: routing** — `#join=` parsing with `parseJoinHash`, the `sessionStorage` pending invite with the one-hour expiry, `history.replaceState`, `loadFirebase()` then `offerJoin()` when signed out. e2e (no cloud): visiting `/#join=<20 chars>.<22 chars>` strips the hash and, with `CLOUD` false, shows nothing (assert the hash is gone).
- [ ] **Step 4: Commit** — `"Crews: subscriptions, create, join (re-validated), leave, remove, hand over, close; Crew card"` (trailer).

---

### Task 10: The crew overlay, the hub crew section, the crew calendar, the reading-list toggle

**Files:**
- Create: `src/ui/CrewBadges.jsx`, `src/ui/event/CrewRow.jsx`, `src/ui/hub/CrewSection.jsx`, `src/ui/hub/CrewSection.test.jsx`, `src/ui/event/CrewRow.test.jsx`
- Modify: `src/ui/EventCard.jsx`, `EventGrid.jsx`, `Chips.jsx`, `useFiltered.js` (`crewAny`), `src/ui/sheets/EventSheet.jsx`, `src/ui/event/Notes.jsx` (share checkbox), `src/ui/sheets/HubSheet.jsx`, `src/ui/sheets/ReadingSheet.jsx`, `src/core/reading.js` (a `going` decorator), `src/store/planner.js` (`crewOnly` already exists)

**Interfaces:** as `CREW-SPEC.md` section 7 "Everywhere" and "My festival crew section": `CrewBadges({no})` (initials dots of members other than me who picked it, colours by join order); the **Crew** chip with the day's count toggling `crewOnly`; `CrewRow({e})` (Going / not yet, *Join them*, the verdict tally on debates, *Crew notes* from others' shared notes rendered as text); the *Share this note with the crew* checkbox in `Notes` calling `setShared`; `CrewSection` (All of you, Where you split, Only you / Only them as `<details>`, *Crew calendar (.ics)* using `icsFile(union, name, e => 'Going: ' + names)`, *Crew reading list*); the reading sheet's Mine / Crew tabs with `goingNames` per event.

- [ ] **Step 1: build the components** from the Phase 2 plan's Tasks 6–7 code (translated to JSX; `crewSummary` and `pickedBy` from `core/crew.js`).
- [ ] **Step 2: tests** — `CrewRow.test.jsx`: with a crew of me + Kari (picked) + Morten (not), renders "Going: Kari · not yet: Morten" and *Join them* when I have not picked; a debate shows "Kari: Draw"; a shared note from Kari renders as text (a `<b>` in the note shows as literal text). `CrewSection.test.jsx`: the summary lists and the split slot.
- [ ] **Step 3: Commit** — `"Crew overlay, hub crew section, crew calendar, reading-list toggle"` (trailer).

---

### Task 11: Cleanup, docs, the owner's checklist

**Files:**
- Delete: `scripts/template.html`, `scripts/crew-core.js`, `scripts/test/` (both files), `index.html`-era leftovers if any (`programme.json` stays: it is data)
- Modify: `README.md` (Development, Deployment, Accounts, Crew sections), `ROADMAP.md` (Batch 5 ✅ with the restructure noted), `CREW-SPEC.md` (a "Codebase" note in section 8 pointing at the design document; status line), `.github/workflows/*` (final check), `firebase/test/package.json` unchanged

- [ ] **Step 1: delete the old implementation** and grep the repo for `template.html`, `crew-core`, `assemble-site`, `__CORE__`, `IN_ARTIFACT`, `selftest` — no matches outside `docs/` and `.superpowers/`.
- [ ] **Step 2: docs** — README: the Development section from Task 1; the Deployment section updated for `npm run build` and `dist`; the Crew section from the Phase 2 plan's Task 8; ROADMAP Batch 5 done with a line "Restructured as a Vite + React app"; `CREW-SPEC.md` section 8 gains "Codebase: see `docs/superpowers/specs/2026-09-07-react-restructure-design.md`; the module list in this section is superseded."
- [ ] **Step 3: run everything** — `npm test`, `npm run build`, `npm run build:move`, `npm run test:e2e`, `npm run test:rules`; all green.
- [ ] **Step 4: owner checklist** in the README's Accounts section (already there) plus `CREW-SPEC.md` section 10's manual matrix pointer.
- [ ] **Step 5: Commit** — `"Remove the single-file app; docs for the React codebase"` (trailer).
