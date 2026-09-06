# HowTheLightGetsIn London 2026 — unofficial planner

**Live site:** https://arealmaas.github.io/how-the-lights-get-in/

A single-page planner for the HowTheLightGetsIn London festival (Kenwood House, Hampstead Heath, 19–20 September 2026): every programmed event with its description, speaker bios, a venue-by-time grid, personal picks that travel by link, and calendar export.

## Disclaimer

This is an **unofficial, fan-made** planner. It is not affiliated with, endorsed by, or connected to HowTheLightGetsIn or the Institute of Art and Ideas (IAI). Event descriptions and speaker biographies are © the IAI and were extracted from [howthelightgetsin.org](https://howthelightgetsin.org/festivals/london/programme) so that festival-goers can plan their weekend. The programme may change before and during the festival — the official programme and ticketing live on the festival's own website. The site publishes start times only; end times in calendar exports are estimates.

## Features

- **List view** grouped by start time, and a **grid view** (venues across, times down) for spotting clashes.
- Filters by day, strand (debates, talks, music & comedy, cinema, Inner Circle, children's), venue and topic, plus free-text search across titles, speakers and descriptions.
- **Picks**: star events; the list is stored in the browser and can be shared or moved to another device with *Copy link to my picks* (`#picks=…`). A link with `#event=<number>` opens one event directly.
- **Calendar export**: each event has *Add to calendar (.ics)* and a *Google Calendar* link; *Export picks to calendar* produces one `.ics` with all picked events. Entries carry the talk summary, venue (with the Kenwood House address), speakers and hosts, ticketing notes, topics, the official event page and a 15-minute reminder. Times are exported in UTC with `Europe/London` as the calendar time zone, so they show correctly wherever you are.
- On the festival days a **Now** button jumps to what's next.

Everything is one static `index.html` with the data embedded — no build step at runtime, nothing tracked, no cookies.

## Data

- `programme.json` — the normalised dataset (events, speakers, acts, meta). `events[]` has `eventNo`, `title`, `type`, `venue`, `date`, `time` (24h, London), `speakers`, `hosts`, `topics`, `description`, `ticketing` (`fast_pass` | `included` | `separate_ticket` | `sold_out`), prices and the official `url`.
- `data/extract.json` — the raw extraction the build starts from.

## Refreshing the programme

The festival's programme page lazy-loads 40 events at a time from `FullEventListPage_Controller/getevents`, so the extraction runs in your browser, where the requests are same-origin:

1. Open https://howthelightgetsin.org/festivals/london/programme.
2. Open the developer console and paste the contents of `scripts/extract-in-browser.js`. After ~30 seconds it downloads `extract.json` (135 events, ~100 speaker profiles and the music/comedy acts as of September 2026).
3. Save it as `data/extract.json`, then run `python3 scripts/build.py` (Python 3.9+, no dependencies). This rewrites `programme.json` and `index.html`.
4. Commit and push — GitHub Pages serves `index.html` from the `main` branch.

`scripts/build.py` does the normalisation: parses "A, B, C. D hosts" speaker strings (including initials), converts times, links people to their profile pages, attaches artist bios to music and comedy slots that have no programme text, and injects the data into `scripts/template.html`.

## Development

`scripts/template.html` is the whole app (CSS + JS). `python3 scripts/build.py` regenerates `index.html`; open it directly in a browser — no server needed.

## Rights

Programme content: © Institute of Art and Ideas, reproduced for personal, non-commercial festival planning. The code in this repository carries no licence yet — add one (MIT is the usual choice) if you want others to reuse it.
