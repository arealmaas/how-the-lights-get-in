# Roadmap

Ideas for the planner, to be done one at a time. Everything here works on a static GitHub Pages site — no backend, nothing tracked. Status: ✅ done · 🔨 in progress · ⬜ planned.

## Batch 1 (done 6 September 2026)

- ✅ **Debate briefings.** One per debate (31): the question in one line, the sides with their strongest arguments, where each speaker is likely to stand based on their published work (hedged, linked to their bio), the usual objections to each side, three questions worth asking at the Q&A, and things to read or watch beforehand. Stored in `data/briefings.json`, shown as a *Briefing* section in the event sheet, clearly labelled as unofficial AI-written notes. Talks (33) and IAI Academy courses (5) follow later.
- ✅ **Media links.** For each music and comedy act: Spotify artist, a YouTube video (embedded, click to load), Bandcamp/Instagram where they exist, plus the festival's official Spotify playlist as *Listen before you go*. For the DokBox films: trailer and film pages where they could be found. Stored in `data/media.json`; search-page links as a fallback where no verified link exists.
- ✅ **Works offline.** Service worker + web-app manifest so the planner installs to the home screen and works on the Heath with no signal.
- ✅ **Now & next.** On festival days: what's on and what starts in the next 45 minutes in each tent, a countdown to the next pick, and **clash warnings** when two picks start within 15 minutes of each other (all sessions assumed to last an hour; a half-hour overlap is a quiet note, not a warning). `?now=2026-09-19T14:00` previews festival-day mode.

## Batch 2 (done 6 September 2026)

- ✅ **Notes and verdicts.** A notes field on every event and a "who won?" vote on debates, saved in the browser; exported with picks as Markdown (*Export notes*), and verdicts travel in the picks link.
- ✅ **Talk and Academy briefings.** The 33 talks and 5 courses now have briefings too: the argument, the strongest objections, where the speaker comes from, questions, reading, terms (`data/briefings/talks-*.json`).
- ✅ **Speaker extras.** Wikipedia (79 verified articles), the IAI TV archive search, and selected books (164) in every speaker sheet (`data/speakers-extra.json`).
- ✅ **Reading list generator.** From your picks: up to two books per speaker plus each briefing's "read or watch first"; copy as text or export as Markdown.
- ✅ **Speaker stats.** Most-booked speakers, busiest start times, events by venue and type, topics, who appears together — the *Stats* button in the header.

## Batch 3 (done 6 September 2026)

- ✅ **Photos.** Portraits from the festival site on every speaker and act sheet, avatars in the event's speaker list, the programme image at the top of each event sheet (act photos for music and comedy). 240 WebP thumbnails under `img/`, precached for offline use, embedded as data URIs in the artifact copy. `scripts/fetch-images.js` + `scripts/unpack-images.py` refresh them.

## Batch 4 (done 6 September 2026)

- ✅ **Cleaner top.** A masthead with the wordmark, one quiet line (venue, dates, unofficial, about) and a strand-colour hairline; two prominent buttons with live counts — *My festival* and *Reading list*; a sticky toolbar with day, view, search and one filter strip; the status line only appears while a filter is active. Share and export links moved out of the toolbar.
- ✅ **My festival hub.** Picks per day with clash and note markers, a highlighted reading-list card, calendar export, an inline share link, notes export, and links to stats and the disclaimer.
- ✅ **Pull-request previews.** GitHub Actions publish `main` to `gh-pages` and every PR to `gh-pages/pr-preview/pr-N/` with a link in a PR comment (`.github/workflows/`); preview builds carry a ribbon and `noindex`.

## Batch 5 (in progress, September 2026)

- 🔨 **Accounts and crews.** Firebase Authentication (Google, email + password) keeps picks, verdicts and notes on every device; crews share picks, verdicts and chosen notes by invite link. Spec: `CREW-SPEC.md`. Hosting moved to Firebase Hosting (`https://htlgi-planner.firebaseapp.com/`), with a move page left on GitHub Pages.

## Skipped (decided 6 September 2026)

Free-slot finder, weather and travel notes, bingo, "surprise me", share card — not needed.

## Done

- ✅ Full programme extraction with a repeatable browser script and build (`scripts/`).
- ✅ List and venue-grid views, filters, search, deep links (`#event=`), picks shareable by link (`#picks=`).
- ✅ Calendar export: per-event `.ics` and Google Calendar links, bulk export of picks, with summaries, venue address, ticket notes and reminders.
- ✅ Non-affiliation disclaimer in the page and README.
