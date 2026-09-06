# Roadmap

Ideas for the planner, to be done one at a time. Everything here works on a static GitHub Pages site — no backend, nothing tracked. Status: ✅ done · 🔨 in progress · ⬜ planned.

## Batch 1 (done 6 September 2026)

- ✅ **Debate briefings.** One per debate (31): the question in one line, the sides with their strongest arguments, where each speaker is likely to stand based on their published work (hedged, linked to their bio), the usual objections to each side, three questions worth asking at the Q&A, and things to read or watch beforehand. Stored in `data/briefings.json`, shown as a *Briefing* section in the event sheet, clearly labelled as unofficial AI-written notes. Talks (33) and IAI Academy courses (5) follow later.
- ✅ **Media links.** For each music and comedy act: Spotify artist, a YouTube video (embedded, click to load), Bandcamp/Instagram where they exist, plus the festival's official Spotify playlist as *Listen before you go*. For the DokBox films: trailer and film pages where they could be found. Stored in `data/media.json`; search-page links as a fallback where no verified link exists.
- ✅ **Works offline.** Service worker + web-app manifest so the planner installs to the home screen and works on the Heath with no signal.
- ✅ **Now & next.** On festival days: what's on and what starts in the next 45 minutes in each tent, a countdown to the next pick, and **clash warnings** when two picks overlap (using the same estimated durations as the calendar export). `?now=2026-09-19T14:00` previews festival-day mode.

## Batch 2 — practical

- ⬜ **Free-slot finder.** Given your picks, show the gaps and what's on in each.
- ⬜ **Notes and verdicts.** A local notes field per event; for debates a "who won?" vote; exported with your picks as Markdown and shareable by link like picks.
- ⬜ **Weather and getting there.** Hampstead Heath forecast from Open-Meteo (free, no key, client-side) on the festival days; Overground/bus/walking notes for Kenwood House; the festival site map if one is published.

## Batch 3 — deeper content

- ⬜ **Talk and Academy briefings.** The same format as the debate briefings for the 33 talks and 5 courses: the argument, the strongest objections, where the speaker comes from, what to read first.
- ⬜ **Speaker extras.** Wikipedia, latest book, and a link to their past IAI TV debates (the festival's own archive) — a "follow this person" view; Hilary Lawson is in 6 events, Adam Frank, Frank Furedi, Sally Haslanger and Catherine Liu in 4 each.
- ⬜ **Reading list generator.** From your picks, a list of the speakers' books.

## Batch 4 — fun

- ⬜ **Philosophy-festival bingo.** A card generated per person ("someone says 'define your terms'", "a physicist admits nobody knows"), tappable, shareable.
- ⬜ **Surprise me.** Fills your next free slot with a random event that fits.
- ⬜ **Share card.** "My HTLGI weekend" drawn on canvas as an image, for sending to friends.
- ⬜ **Speaker stats.** Most-booked speakers, busiest slots (16:00 both days and 19:00 Saturday have five events at once), which speakers appear together.

## Done

- ✅ Full programme extraction with a repeatable browser script and build (`scripts/`).
- ✅ List and venue-grid views, filters, search, deep links (`#event=`), picks shareable by link (`#picks=`).
- ✅ Calendar export: per-event `.ics` and Google Calendar links, bulk export of picks, with summaries, venue address, ticket notes and reminders.
- ✅ Non-affiliation disclaimer in the page and README.
