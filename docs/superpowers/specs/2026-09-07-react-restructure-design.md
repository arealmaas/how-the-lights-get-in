# React restructure — design

Status: approved in principle on 7 September 2026 ("go react now, don't worry about the days"). This document fixes the structure the rest of the crew work is built on. It supersedes the "changes to the repo" parts of `CREW-SPEC.md` section 8; the product behaviour in `CREW-SPEC.md` is unchanged.

## 1. Why

`scripts/template.html` is 1 650 lines of CSS and one script that renders everything with string templates and a single click dispatcher. Adding accounts and crews turned every change into exact-string surgery on that file, and reviews kept finding the same classes of bug (unescaped strings, re-render clobbering focused inputs, ordering of listeners). The app moves to a Vite + React codebase with small modules, real components, a state store the cloud layer can update from outside React, and tests that run in Node and in a headless browser.

## 2. Decisions

- **Vite 8 + React 19, JavaScript with JSX.** No TypeScript for now: the port is a transcription of working code, and a type layer can be added file by file later.
- **Zustand 5 for state.** Four small stores (planner, sheet, banner, cloud). The Firestore listeners and the sync queue live in plain modules under `src/cloud/` and call `store.setState`; components subscribe with selectors. No context plumbing, no reducers.
- **Data is imported at build time.** `programme.json`, `data/briefings.json`, `data/media.json` and `data/speakers-extra.json` are imported as JSON and bundled; `data/firebase.json` is optional and read with `import.meta.glob`, so the build succeeds without it and `CLOUD` is false. `scripts/build.py` keeps only the extraction and normalisation that produce `programme.json`.
- **`firebase` from npm (12.18.0), lazily imported** as its own chunk, so nobody without a session downloads it; the pinned CDN URL goes away.
- **PWA via `vite-plugin-pwa` in `injectManifest` mode** with our own service worker source (`src/sw.js`): the scope-namespaced cache, the fonts and Firebase-chunk caching, the `/__/` exclusion, network-first pages. The plugin injects the precache list and generates the web manifest.
- **Tests:** Vitest with jsdom and Testing Library for core modules, stores and components; Playwright (Chromium) for a headless end-to-end smoke of the local, signed-out app; the Firestore rules tests stay as they are under `firebase/test/`.
- **Dropped:** the claude.ai artifact build, the `?selftest` block (replaced by real tests), `scripts/assemble-site.sh`, the `IN_ARTIFACT` branches, the string-template `esc()` discipline (React escapes).
- **Kept:** the hash routes (`#event=`, `#picks=…&verdicts=…&notes=…`, `#join=`), the localStorage keys (`htlgi-l26-*`) so nothing a tester already has is lost, the `.ics` output byte-for-byte, the visual design (the CSS moves as a whole).
- **The move page** (`move/`) becomes a second Vite build with `vite-plugin-singlefile`, sharing the notes codec from `src/core/notes.js`; `deploy.yml` publishes its output folder once.

## 3. Layout

```
index.html                     Vite entry: the shell (head, fonts, <div id="app">), nothing else
vite.config.js                 react plugin, pwa plugin (injectManifest), base './'
vite.move.config.js            the move page as a single-file build → dist-move/
package.json                   scripts: dev, build, preview, test, test:e2e, test:rules, data
public/                        img/, icon-192.png, icon-512.png, .nojekyll (copied as-is)
src/
  main.jsx                     createRoot(<App/>), boot(): stores hydrate, cloud boot, hash route
  App.jsx                      Masthead, Toolbar, Banner, NowNext, EventList | EventGrid, Footer, Sheet
  data/index.js                the JSON imports and the derived lookups: EVENTS, SPEAKERS, ACTS, BRIEFINGS,
                               MEDIA, PLAYLIST, EXTRA, byNo, spkBySlug, spkByName, actBySlug, GROUP, GROUPS,
                               VENUES, TOPICS, DAYS, PERFORMANCE, PUBLIC_URL, FIREBASE, CLOUD
  core/                        pure functions, no DOM, no React, no Firebase — all unit-tested
    time.js                    londonNow, simulatedNow (?now=), minutes, addMinutes, isFestivalDay
    filters.js                 matches(event, filters, picks, crewAny), hasFilters
    clashes.js                 overlapMin, computeClashes → {clashes, soft}
    calendar.js                eventTimes, calDescription(e, prefix), icsFile(events, name, prefixFor), gcalLink
    notes.js                   b64u, mergeNoteText, encodeNotesParam, decodeNotesParam, picksToMap, mapToPicks, mergeState
    crew.js                    projectForCrew, parseJoinHash, memberColour, pickedBy, crewSummary
    reading.js                 readingList(events, picks, extras, briefings), readingMarkdown
    exports.js                 notesMarkdown, picksLink(origin, picks, verdicts), safeDecode, parseImportHash
    labels.js                  ticketBadge (data only), ticketLine, whoPlain, initials, slug, cleanDesc, ytId
  store/
    planner.js                 filters + picks/verdicts/notes/shared + actions; persistence to the htlgi-l26-* keys
    sheet.js                   the sheet stack: open(kind, key), back(), close(), top
    banner.js                  show({text, actions:[{label, primary, onClick}]}), hide()
    cloud.js                   user, accountName, syncFlags {pending, stopped, paused}, crewId, crew, signInBranch
  cloud/                       plain modules, no React; they read and write the stores
    firebase.js                the lazy chunk: initializeApp, initializeFirestore(persistent cache), getAuth
    auth.js                    loadFirebase(auto), onAuth, signInGoogle, emailAction, authText, reauth, signOut, deleteAccount, changeName
    sync.js                    afterSignIn, subscribeUser, applyUserData, syncChange + queue, syncError, stopSync
    crew.js                    subscribeCrew, crewGone, createCrew, renameCrew, leaveCrew, closeCrew, removeMember,
                               readmit, makeOwner, createInvite, revokeInvite, offerJoin, acceptJoin, pending invite
  routing.js                   hash handling: #event=, #join=, #picks=/verdicts=/notes= import (banner + apply)
  ui/
    Masthead.jsx  Toolbar.jsx  Chips.jsx  Status.jsx  Banner.jsx  NowNext.jsx  Footer.jsx
    EventList.jsx  EventGrid.jsx  EventCard.jsx  CrewBadges.jsx
    Sheet.jsx                  the container, back/close, focus management, scrim
    sheets/EventSheet.jsx  SpeakerSheet.jsx  ActSheet.jsx  HubSheet.jsx  StatsSheet.jsx  ReadingSheet.jsx
    event/People.jsx  Media.jsx  Briefing.jsx  Notes.jsx  Verdict.jsx  CrewRow.jsx
    hub/HubCards.jsx  DayList.jsx  AccountCard.jsx  CrewCard.jsx  CrewSection.jsx
  styles/app.css               the template's CSS, moved verbatim, plus the account and crew rules
  sw.js                        the service worker source (injectManifest)
move/index.html, move/main.js  the move page (imports src/core/notes.js)
scripts/build.py               data pipeline only: extract.json → programme.json
firebase/, firebase.json       unchanged, except hosting.public = dist
tests/                         Playwright e2e; Vitest tests sit next to the modules as *.test.js(x)
```

## 4. Stores

```js
// store/planner.js
{
  day: '2026-09-19', view: 'list', groups: [], venue: '', topic: '', picksOnly: false, crewOnly: false, q: '',
  picks: Set<number>, verdicts: {[no]: who}, notes: {[no]: text}, shared: {[no]: true},
  setFilter(patch), clearFilters(), setQuery(q),
  togglePick(no), setVerdict(no, who|null), setNote(no, text), setShared(no, bool),
  importFromLink({picks, verdicts, notes}),          // union / merge, then one sync batch
  replaceFromAccount({picks, verdicts, notes, shared, name, crew}),   // applyUserData's write side
  hydrate()                                          // from localStorage on boot
}
```
Every mutating action persists to localStorage and calls `sync.change(userFields, memberFields)` from `cloud/sync.js`; `sync.change` is a no-op unless the device has an account marker, exactly as today.

```js
// store/sheet.js   { stack: [{kind, key}], open(kind, key), back(), close(), replaceTop() }
// store/banner.js  { banner: null | {text, actions, input?}, show(b), hide() }
// store/cloud.js   { user, accountName, marker, syncPending, syncStopped, syncPaused, signInBranch,
//                    crewId, crew: null | {id, name, createdBy, deleted, members, invites, removed, syncedAt, live} }
```

## 5. Behaviour rules that carry over

- Local-first: the planner store hydrates from localStorage synchronously before the first render; the cloud layer loads only when the marker, the redirect flag or a pending invite says so.
- The sign-in sequence, the change queue, the snapshot apply, removal detection, the invite flow, the batches: as in `CREW-SPEC.md` sections 3 and 6, ported function by function from the current implementation (the reviews and rulings recorded in `.superpowers/sdd/*/progress.md` apply).
- The note being typed wins: `Notes.jsx` keeps a draft while focused and commits on a 250 ms debounce and on blur; store updates from a snapshot do not overwrite a focused draft.
- No `innerHTML` anywhere. Crew-supplied strings render as text.
- The banner is store-driven with real click handlers; "Add them to mine" and "Join" are actions, not data attributes.
- Removed member, closed crew, quota exhaustion, offline first sign-in, account deleted elsewhere: the same banners and card states.

## 6. Build, run, deploy

- `npm run dev` for local development; `npm run build` produces `dist/` (site) and `npm run build:move` produces `dist-move/`; `npm test` runs Vitest; `npm run test:e2e` runs Playwright against `vite preview`; `npm run test:rules` runs the emulator suite; `npm run data` runs `python3 scripts/build.py`.
- `firebase.json`: `hosting.public: "dist"`. The merge workflow: `npm ci`, `npm test`, `npm run test:rules`, deploy rules, `npm run build`, deploy hosting. The PR workflow: `npm ci`, `npm run build`, preview channel. `deploy.yml` publishes `dist-move/` to `gh-pages` once, then goes.
- Cache headers, the canonical `firebaseapp.com` origin, the authorized domains, `data/firebase.json`: as in `CREW-SPEC.md` sections 8 and 9 and the README's Accounts section.

## 7. Migration order

Old and new coexist until parity: the React app is built into `dist/` while `scripts/template.html` and `index.html` stay in the repo untouched. Once the e2e smoke passes on the React build, the old page, `scripts/crew-core.js`, `scripts/test/`, `scripts/assemble-site.sh`, `scripts/move-template.html` and the build's page-filling code are deleted in one commit and the workflows switch to `npm run build`. The remaining Phase 2 features (remove and close, the overlay, the hub crew section, the crew calendar and reading list, docs) are built directly in the React codebase.

## 8. Not in scope

TypeScript; a design refresh; a second Firebase project for previews; Storybook. Each can follow once the structure exists.
