# HowTheLightGetsIn London 2026 — unofficial planner

**Live site:** https://how-the-light-gets-in.firebaseapp.com/

A single-page planner for the HowTheLightGetsIn London festival (Kenwood House, Hampstead Heath, 19–20 September 2026): every programmed event with its description, speaker bios, a venue-by-time grid, personal picks that travel by link, and calendar export.

## Disclaimer

This is an **unofficial, fan-made** planner. It is not affiliated with, endorsed by, or connected to HowTheLightGetsIn or the Institute of Art and Ideas (IAI). Event descriptions and speaker biographies are © the IAI and were extracted from [howthelightgetsin.org](https://howthelightgetsin.org/festivals/london/programme) so that festival-goers can plan their weekend. The programme may change before and during the festival — the official programme and ticketing live on the festival's own website. The site publishes start times only; end times in calendar exports are estimates.

## Features

- **Mobile event details**: expand any event or speaker sheet with *Full screen*, return with *Compact view*, and close it without losing your place in the programme. Larger touch controls and full-width mobile cards make it easier to browse; event picks are at the top of the details.
- **Festival map**: *Show on map* beside an event’s venue opens the official 2025 area map, with zoom controls and Back to the event. It shows the grounds and nearby transport, not individual tents; the 2026 layout may differ. The original IAI map is credited and linked, and the local WebP is cached for offline use.
- **List view** grouped by start time, and a **grid view** (venues across, times down) for spotting clashes.
- Filters by day, strand (debates, talks, music & comedy, cinema, Inner Circle, children's), venue and topic, plus free-text search across titles, speakers and descriptions.
- **Picks and My festival**: star events; *My festival* in the header gathers your weekend — picks per day with clash markers, the reading list, calendar export, a link that moves picks and verdicts to another device (`#picks=…`), and the notes export. A link with `#event=<number>` opens one event directly.
- **Calendar export**: each event has *Add to calendar (.ics)* and a *Google Calendar* link; *Export picks to calendar* produces one `.ics` with all picked events. Entries carry the talk summary, venue (with the Kenwood House address), speakers and hosts, ticketing notes, topics, the official event page and a 15-minute reminder. Times are exported in UTC with `Europe/London` as the calendar time zone, so they show correctly wherever you are.
- **Briefings** on every debate, talk and IAI Academy course (69): a *Briefing* tab with the question, the sides' (or the speaker's) strongest arguments and the usual objections, where each speaker is likely to stand (inferred from their published work, hedged), three questions worth asking, and what to read first. Unofficial notes written with Claude; corrections welcome.
- **Notes and verdicts**: every event has a *Notes* tab with a full-text reading view, an *Edit note* button and a mobile editor that grows with your writing. Notes autosave, and *Save note* (or Ctrl/Cmd+Enter) returns to reading. Save status distinguishes this device from a confirmed account save, with a retry if sync fails. *My festival → My notes* shows every note in full, including events you haven't picked, with search, editing and *Export notes (.md)*. Debates have a "who won?" vote in the Notes tab; exports include picks and verdicts, and the picks link carries verdicts too.
- **Account**: sign in with Google or email + password (My festival → Account) and your picks, verdicts and notes follow you to every device; the planner still works offline and signed out. Signing in stores your email, name and planner data in Firebase (Google, EU region); nobody but you can read them, and *Delete account* removes everything.
- **Photos**: a portrait on every speaker and act sheet, round avatars in each event's speaker list, and the programme image at the top of the event sheet (music and comedy slots use the act's photo). Thumbnails live under `img/` and are precached for offline use; anyone without a photo gets their initials.
- **Speaker extras**: Wikipedia, the festival organiser's IAI TV archive, and a selection of each speaker's books (`data/speakers-extra.json`).
- **Reading list**: built from your picks — up to two books per speaker plus each briefing's suggestions; copy as text or export as Markdown.
- **Stats**: most-booked speakers, busiest start times, events by venue and type, topics, and who appears together (from the foot of My festival).
- **Listen & watch**: Spotify, a YouTube video (embedded on click), Bandcamp and other pages for each music and comedy act, trailers for the DokBox films, and the festival's official playlist.
- **Now & next** on the festival days: what's on and what starts in the next 45 minutes in each tent, a countdown to your next pick, and **clash warnings** when two picks start within 15 minutes of each other (sessions are assumed to last an hour; a half-hour overlap is shown as a quiet note instead). Add `?now=2026-09-19T14:00` to the address to preview it.
- **Works offline** once loaded: a service worker caches the page and fonts, and the web-app manifest lets you add it to your home screen.

The site is a Vite + React app built to static files (`npm run build` → `dist/`), with the programme bundled in at build time: nothing is fetched at runtime, there is no analytics, and the site sets no cookies (Google sign-in opens Google's pages, which do). Signed-in state lives in Firestore under rules that only let the owner read it (`firebase/firestore.rules`).

## Data

- `programme.json` — the normalised dataset (events, speakers, acts, meta). `events[]` has `eventNo`, `title`, `type`, `venue`, `date`, `time` (24h, London), `speakers`, `hosts`, `topics`, `description`, `ticketing` (`fast_pass` | `included` | `separate_ticket` | `sold_out`), prices and the official `url`.
- `data/extract.json` — the raw extraction the build starts from.
- `data/briefings.json` — the briefings (merged from `data/briefings/*.json`: `debates-*.json` and `talks-*.json`).
- `data/speakers-extra.json` — Wikipedia and IAI TV links and selected books per speaker (generated by `scripts/speakers-extra.py`).
- `data/media.json` — Spotify / YouTube / Bandcamp links for acts, trailers and pages for films, and the official playlist.
- `public/img/speakers/`, `public/img/acts/`, `public/img/events/` — WebP thumbnails (portraits 240×300, heroes 640×360, about 3.5 MB in total) made from the festival site's images by `scripts/fetch-images.js` + `scripts/unpack-images.py`. `public/` is copied to the root of `dist/`, so the site requests them as `img/…`, which is the path `programme.json` records in `photo`; `image` keeps the original URL.

## Accounts

Sign-in and sync are switched on by `data/firebase.json`, the public web config from the Firebase console (`apiKey`, `authDomain`, `projectId`, `appId`); without it the build hides the Account and Crew UI. Before the first real sign-in (details in `CREW-SPEC.md` section 9): create the project with Firestore in `europe-west2` or `eur3` and publish `firebase/firestore.rules`; enable the *Email/Password* and *Google* sign-in methods and leave email enumeration protection on; keep the site on `https://how-the-light-gets-in.firebaseapp.com/` (the same origin as `authDomain`, which the redirect sign-in needs). `src/data/index.js` reads the file with `import.meta.glob`, so `npm run build` succeeds either way: with it, `CLOUD` is true and the Account and Crew cards appear; without it they stay hidden. To check, `npm run dev` and look for *Account* in *My festival*. The unit tests and the e2e build set `VITE_CLOUD=off`, which builds without accounts even though the file is committed, so neither ever touches the real project.

A crew has a plan of its own — the events any member adds with the crew button next to the star — which the *Crew* chip, the crew calendar and the crew reading list are built from; own picks stay personal, and the cards show both (an amber bar for a pick, a ring in the crew colour for the plan). `CREW-SPEC.md` section 3 has the model.

Signed-in state lives in Firestore; signed-out state lives in this browser only, and Safari deletes a site's storage after seven days of Safari use without a visit (home-screen apps are exempt), so signing in is also what protects your picks between planning and the festival.

The notes UI uses the existing `notes` map (event number → text) and `shared` flags in the account and crew member documents. Existing notes remain readable and editable without a Firestore migration, new indexes or a rules change. New notes have a visible 20,000-character limit; longer legacy notes are displayed in full and must be shortened before saving an edit, so they are never silently cut off by the editor.

The crew flows cannot run against the emulator (nothing can sign a browser in there), so `npm run test:live` drives them against the live project: it builds, puts two test accounts back to "no crew" (`tests/live/reset.mjs`), then two headless browsers sign in as them and go through the crew plan end to end (`tests/live/crew-plan.mjs`: create a crew, add to the plan from a card, invite and join, watch the plan arrive on the other account, add from the sheet, remove the other person's entry, the hub's plan list, the Crew filter, the cached ring on a reload, close the crew). It writes to the live project — a crew called "Plan test crew" is created and closed — and needs the rules deployed. The accounts come from `.env.local` (gitignored; the names are in `.env.example`): two email + password accounts made for this, never real people's. Conductor copies `.env*` files from the repository root into new workspaces. `npm run test:live:state` prints what the project holds for the two accounts; a run that stops part-way leaves a crew behind, and the next `npm run test:live` clears it. Screenshots land in `test-results/live/`.

Before the festival, walk `CREW-SPEC.md` section 10's manual matrix once: desktop Chrome (popup sign-in), Safari on iPhone and the installed iOS app (redirect), Android Chrome, airplane mode and reconnect, a second device, a removal, an invite opened while signed out, a preview channel, and the old GitHub Pages address. The automated suites (`npm test`, `npm run test:e2e`, `npm run test:rules`) cover everything that can be checked without a real Firebase project; `npm run test:live` covers the crew plan against it.

## Refreshing the programme

The festival's programme page lazy-loads 40 events at a time from `FullEventListPage_Controller/getevents`, so the extraction runs in your browser, where the requests are same-origin:

1. Open https://howthelightgetsin.org/festivals/london/programme.
2. Open the developer console and paste the contents of `scripts/extract-in-browser.js`. After ~30 seconds it downloads `extract.json` (135 events, ~100 speaker profiles and the music/comedy acts as of September 2026).
3. Save it as `data/extract.json`, then run `npm run data` (`python3 scripts/build.py`; Python 3.9+, no dependencies). It rewrites `programme.json`, which `src/data/index.js` imports, so the next `npm run build` carries it. Briefings, media links and photos are keyed by event number and speaker/act slug, so they survive a refresh unless the festival renumbers events.
4. For new speakers or changed photos, paste `scripts/fetch-images.js` into the console on the festival site (it downloads `images.json`), then `python3 scripts/unpack-images.py ~/Downloads/images.json` — it writes into `public/img/` — and run `npm run data` again so the new files are recorded.
5. Commit and push — `firebase-hosting-merge.yml` builds and publishes it on merge to `main` (see below).

`scripts/build.py` does the normalisation and nothing else: it parses "A, B, C. D hosts" speaker strings (including initials), converts times, links people to their profile pages, attaches artist bios to music and comedy slots that have no programme text, and records which thumbnails exist. Its only output is `programme.json`; the page itself is built by Vite.

## Development

`npm install`, then `npm run dev` for a live-reloading dev server, `npm run build` for `dist/`, `npm test` for the unit and component tests, `npm run test:e2e` for the browser smoke (`npx playwright install chromium webkit` once), `npm run test:rules` for the Firestore rules. `npm run data` (`python3 scripts/build.py`) regenerates `programme.json` from `data/extract.json`, and `npm run build:move` produces `dist-move/`, the single-file "moved" page for the old GitHub Pages address.

The code is a Vite 8 + React 19 app; `docs/superpowers/specs/2026-09-07-react-restructure-design.md` is the map. In short:

- `src/data/index.js` — the JSON imports (`programme.json`, briefings, media, speaker extras, the optional `data/firebase.json`) and every lookup derived from them, including `PUBLIC_URL`.
- `src/core/` — pure functions with no DOM, no React and no Firebase: times, filters, clashes, calendar export, the notes and picks codecs, crew projections, the reading list, labels. Unit-tested next to the source.
- `src/store/` — four small Zustand stores: `planner` (filters, picks, verdicts, notes, and their localStorage persistence), `sheet` (the sheet stack), `banner`, `cloud` (session, sync flags, crew).
- `src/cloud/` — the Firebase layer, no React: `firebase.js` is the only file that imports `firebase/*`, and it is loaded lazily into its own chunk; `auth.js`, `sync.js` and `crew.js` read and write the stores.
- `src/ui/` — the components: the masthead and toolbar, the list and grid, the sheets under `sheets/`, the event-sheet parts under `event/`, the *My festival* cards under `hub/`.
- `src/App.jsx` the shell, `src/main.jsx` the boot sequence, `src/routing.js` the hash routes (`#event=`, `#picks=…`, `#join=`), `src/sw.js` the service-worker source that `vite-plugin-pwa` injects the precache list into, `src/styles/app.css` the whole stylesheet.
- `tests/e2e/` — Playwright; `tests/live/` — the crew plan against the live project, with two test accounts from `.env.local`; `firebase/test/` — the Firestore rules suite (needs a JDK).

## Deployment and pull-request previews

Merging to `main` is the deploy: `firebase-hosting-merge.yml` publishes the site and the rules, and `deploy.yml` publishes the old GitHub Pages address. So before the hosting branch merges, the Firebase project must exist with Firestore created and **Hosting started** (console → Build → Hosting → *Get started*; without it the deploy action has no site to publish to — `CREW-SPEC.md` section 9, step 4), the repository secret `FIREBASE_SERVICE_ACCOUNT_HOW_THE_LIGHT_GETS_IN` must hold a key of a service account with the *Firebase Hosting Admin*, *Firebase Rules Admin*, *Cloud Run Viewer*, *API Keys Viewer*, *Firebase Authentication Admin* and *Service Usage Viewer* roles (today: `github-action-deploy@how-the-light-gets-in.iam.gserviceaccount.com`; `firebase init hosting:github` creates an equivalent one, minus the two roles the rules deploy needs). The project id `how-the-light-gets-in` appears in `README.md`, `ROADMAP.md`, `.firebaserc`, `src/data/index.js` (`PUBLIC_URL`), `move/index.html`, `move/main.js` and both `firebase-hosting-*.yml`; a different id is a search-and-replace across those eight files, plus `src/data/index.test.js`, `src/cloud/crew.test.js` and `src/core/move-page.test.js`, which assert the URL and fail until you do.

The site is served by Firebase Hosting (`firebase.json`; Spark plan). Two workflows do the publishing:

- `firebase-hosting-merge.yml` runs on every push to `main`: `npm ci`, `npm test`, the rules tests in the emulator, the rules deploy, then `npm run build` and a deploy of `dist/` to the live channel. Rules go out tested, and before the site.
- `firebase-hosting-pull-request.yml` builds every pull request from this repository with `VITE_PREVIEW="PR #N"` — which puts a red ribbon and a `noindex` tag on the page (`src/App.jsx`) — and deploys it to a preview channel; the action leaves a comment on the PR with the URL. Previews expire after seven days and use the real Firestore project, so do not change the document schema on a preview. The deploy adds each preview domain to the Auth authorised domains, so popup sign-in (desktop) works on a preview; the redirect flow (phones, installed app) does not, because `authDomain` is the live origin. Test the phone flows on localhost and the live site.

Both read the service-account key from that repository secret.

The old address, `https://arealmaas.github.io/how-the-lights-get-in/`, serves a page that points at the new one — `move/index.html` and `move/main.js`, built by `npm run build:move` into a single file in `dist-move/` and published to `gh-pages` by `deploy.yml` (which runs only when the move page or the two `src/core/` modules it imports change). **GitHub Pages must be set to serve that branch**: repository Settings → Pages → *Deploy from a branch*, `gh-pages` / `(root)`. Pointed at `main` / `(root)` instead — which is where it was until this was fixed — Pages serves the repository's Vite entry `index.html`, whose `/src/main.jsx` exists only in the source tree and not as a built file, so the address loads as a blank page with a console error and nothing on gh-pages is ever seen.

A bare visit to the old address gets the page. A link that points at something specific — `#event=`, `#picks=`, a crew invite — is forwarded to the new origin with the fragment intact, so shared links keep working. If the browser has picks, verdicts or notes saved from when the planner lived there, the page says so and its link carries them across; it shares the codec with the app by importing `src/core/notes.js`, so the link it makes is one the live site understands. `src/core/move-page.test.js` covers all three paths.

Cache headers are in `firebase.json`: a year, immutable, for the hashed bundles under `/assets/**` and for `/img/**`; `no-cache` for `/`, `/index.html`, `/sw.js` and `/manifest.webmanifest`, so a deploy is picked up on the next online load.

Photos are held by the service worker in a cache of their own, `htlgi-img-v1` (`IMG_CACHE` in `src/sw.js`), which survives a deploy so a rebuild does not re-download 3.5 MB of thumbnails. Replacing a photo file *without* changing its name therefore needs the `-v1` suffix bumped, or the old picture stays on every device that has already been there.

Tests before a deploy: `npm test` for the unit and component suites, `npm run test:e2e` for the browser smoke, and `npm run test:rules` for the Firestore rules (needs `firebase-tools` and a JDK for the emulator). On macOS with a Homebrew JDK, put it on the path first: `export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"`.

## Rights

Programme content: © Institute of Art and Ideas, reproduced for personal, non-commercial festival planning. Speaker, act and event photographs under `public/img/` are © the IAI and the respective photographers and publicists; they are reproduced at thumbnail size purely to identify who is on stage, and will be removed on request. The code in this repository carries no licence yet — add one (MIT is the usual choice) if you want others to reuse it.
