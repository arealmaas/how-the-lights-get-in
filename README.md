# HowTheLightGetsIn London 2026 — unofficial planner

**Live site:** https://htlgi-planner.firebaseapp.com/

A single-page planner for the HowTheLightGetsIn London festival (Kenwood House, Hampstead Heath, 19–20 September 2026): every programmed event with its description, speaker bios, a venue-by-time grid, personal picks that travel by link, and calendar export.

## Disclaimer

This is an **unofficial, fan-made** planner. It is not affiliated with, endorsed by, or connected to HowTheLightGetsIn or the Institute of Art and Ideas (IAI). Event descriptions and speaker biographies are © the IAI and were extracted from [howthelightgetsin.org](https://howthelightgetsin.org/festivals/london/programme) so that festival-goers can plan their weekend. The programme may change before and during the festival — the official programme and ticketing live on the festival's own website. The site publishes start times only; end times in calendar exports are estimates.

## Features

- **List view** grouped by start time, and a **grid view** (venues across, times down) for spotting clashes.
- Filters by day, strand (debates, talks, music & comedy, cinema, Inner Circle, children's), venue and topic, plus free-text search across titles, speakers and descriptions.
- **Picks and My festival**: star events; *My festival* in the header gathers your weekend — picks per day with clash markers, the reading list, calendar export, a link that moves picks and verdicts to another device (`#picks=…`), and the notes export. A link with `#event=<number>` opens one event directly.
- **Calendar export**: each event has *Add to calendar (.ics)* and a *Google Calendar* link; *Export picks to calendar* produces one `.ics` with all picked events. Entries carry the talk summary, venue (with the Kenwood House address), speakers and hosts, ticketing notes, topics, the official event page and a 15-minute reminder. Times are exported in UTC with `Europe/London` as the calendar time zone, so they show correctly wherever you are.
- **Briefings** on every debate, talk and IAI Academy course (69): a *Briefing* tab with the question, the sides' (or the speaker's) strongest arguments and the usual objections, where each speaker is likely to stand (inferred from their published work, hedged), three questions worth asking, and what to read first. Unofficial notes written with Claude; corrections welcome.
- **Notes and verdicts**: a notes field on every event and a "who won?" vote on debates, saved in the browser; *Export notes (.md)* in My festival writes picks, notes and verdicts to Markdown, and the picks link carries verdicts too.
- **Account**: sign in with Google or email + password (My festival → Account) and your picks, verdicts and notes follow you to every device; the planner still works offline and signed out. Signing in stores your email, name and planner data in Firebase (Google, EU region); nobody but you can read them, and *Delete account* removes everything.
- **Photos**: a portrait on every speaker and act sheet, round avatars in each event's speaker list, and the programme image at the top of the event sheet (music and comedy slots use the act's photo). Thumbnails live under `img/` and are precached for offline use; anyone without a photo gets their initials.
- **Speaker extras**: Wikipedia, the festival organiser's IAI TV archive, and a selection of each speaker's books (`data/speakers-extra.json`).
- **Reading list**: built from your picks — up to two books per speaker plus each briefing's suggestions; copy as text or export as Markdown.
- **Stats**: most-booked speakers, busiest start times, events by venue and type, topics, and who appears together (from the foot of My festival).
- **Listen & watch**: Spotify, a YouTube video (embedded on click), Bandcamp and other pages for each music and comedy act, trailers for the DokBox films, and the festival's official playlist.
- **Now & next** on the festival days: what's on and what starts in the next 45 minutes in each tent, a countdown to your next pick, and **clash warnings** when two picks start within 15 minutes of each other (sessions are assumed to last an hour; a half-hour overlap is shown as a quiet note instead). Add `?now=2026-09-19T14:00` to the address to preview it.
- **Works offline** once loaded: a service worker caches the page and fonts, and the web-app manifest lets you add it to your home screen.

Everything is one static `index.html` with the data embedded — no build step at runtime, no analytics, no cookies set by the site (Google sign-in opens Google's pages, which do). Signed-in state lives in Firestore under rules that only let the owner read it (`firebase/firestore.rules`).

## Data

- `programme.json` — the normalised dataset (events, speakers, acts, meta). `events[]` has `eventNo`, `title`, `type`, `venue`, `date`, `time` (24h, London), `speakers`, `hosts`, `topics`, `description`, `ticketing` (`fast_pass` | `included` | `separate_ticket` | `sold_out`), prices and the official `url`.
- `data/extract.json` — the raw extraction the build starts from.
- `data/briefings.json` — the briefings (merged from `data/briefings/*.json`: `debates-*.json` and `talks-*.json`).
- `data/speakers-extra.json` — Wikipedia and IAI TV links and selected books per speaker (generated by `scripts/speakers-extra.py`).
- `data/media.json` — Spotify / YouTube / Bandcamp links for acts, trailers and pages for films, and the official playlist.
- `img/speakers/`, `img/acts/`, `img/events/` — WebP thumbnails (portraits 240×300, heroes 640×360, about 3.5 MB in total) made from the festival site's images by `scripts/fetch-images.js` + `scripts/unpack-images.py`. `programme.json` keeps the original image URL in `image` and the local path in `photo`.

## Refreshing the programme

The festival's programme page lazy-loads 40 events at a time from `FullEventListPage_Controller/getevents`, so the extraction runs in your browser, where the requests are same-origin:

1. Open https://howthelightgetsin.org/festivals/london/programme.
2. Open the developer console and paste the contents of `scripts/extract-in-browser.js`. After ~30 seconds it downloads `extract.json` (135 events, ~100 speaker profiles and the music/comedy acts as of September 2026).
3. Save it as `data/extract.json`, then run `python3 scripts/build.py` (Python 3.9+, no dependencies). This rewrites `programme.json`, `index.html`, `sw.js` (with a new cache version) and `manifest.webmanifest`. Briefings, media links and photos are keyed by event number and speaker/act slug, so they survive a refresh unless the festival renumbers events.
4. For new speakers or changed photos, paste `scripts/fetch-images.js` into the console on the festival site (it downloads `images.json`), then `python3 scripts/unpack-images.py ~/Downloads/images.json` and build again.
5. Commit and push — the Firebase Hosting workflow publishes it on merge to main (see below).

`scripts/build.py` does the normalisation: parses "A, B, C. D hosts" speaker strings (including initials), converts times, links people to their profile pages, attaches artist bios to music and comedy slots that have no programme text, and injects the data into `scripts/template.html`.

## Development

`scripts/template.html` is the whole app (CSS + JS). `python3 scripts/build.py` regenerates `index.html`; open it directly in a browser — no server needed.

## Deployment and pull-request previews

Merging to `main` is the deploy: `firebase-hosting-merge.yml` publishes the site and the rules, and `deploy.yml` (one last run) replaces the old GitHub Pages site with the move page. So before the hosting branch merges, the Firebase project must exist, the repository secret `FIREBASE_SERVICE_ACCOUNT_HTLGI_PLANNER` must be set (created by `firebase init hosting:github`), and its service account must hold the *Firebase Rules Admin* role. The project id `htlgi-planner` appears in `README.md`, `ROADMAP.md`, `scripts/move-template.html`, `scripts/template.html`, `.firebaserc` and both `firebase-hosting-*.yml`; a different id is a search-and-replace across those seven files.

The site is served by Firebase Hosting (`firebase.json`; Spark plan). Two workflows do the publishing:

- `firebase-hosting-merge.yml` runs on every push to `main`: it first runs the rules tests in the emulator, then publishes `firebase/firestore.rules`, then builds (`scripts/assemble-site.sh _site`) and deploys the site to the live channel.
- `firebase-hosting-pull-request.yml` builds every pull request from this repository with `--preview "PR #N"` (a red ribbon and a `noindex` tag) and deploys it to a preview channel; the action leaves a comment on the PR with the URL. Previews expire after seven days and use the real Firestore project, so do not change the document schema on a preview. Google sign-in does not work on a preview channel (its domain is not an authorised auth domain); test sign-in on localhost and the live site.

Both need the repository secret created by `firebase init hosting:github`, and the deploy service account needs the *Firebase Rules Admin* role. The old GitHub Pages address serves a "moved" page (`move/index.html`, generated from `scripts/move-template.html` by the build) that carries a visitor's picks, verdicts and notes to the new origin.

Tests: `node --test scripts/test/*.test.mjs` for the pure helpers and the service worker; `cd firebase/test && npm test` for the Firestore rules (needs `firebase-tools` and a JDK for the emulator). On macOS with a Homebrew JDK, put it on the path first: `export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"`.

## Rights

Programme content: © Institute of Art and Ideas, reproduced for personal, non-commercial festival planning. Speaker, act and event photographs under `img/` are © the IAI and the respective photographers and publicists; they are reproduced at thumbnail size purely to identify who is on stage, and will be removed on request. The code in this repository carries no licence yet — add one (MIT is the usual choice) if you want others to reuse it.
