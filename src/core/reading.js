// src/core/reading.js — the reading list built from picked events: up to two books per speaker (from the
// speaker extras), plus each briefing's "read or watch first". extras and briefings are passed in (the UI
// passes EXTRA and BRIEFINGS from src/data).
import {DAYS} from '../data/index.js';

export function readingList(events, pickSet, extras, briefings){
  const evs = events.filter(e => pickSet.has(e.eventNo));
  const items = [];
  const seenBooks = new Set();
  for (const e of evs) {
    const bks = [], reads = [];
    for (const pe of e.people) {
      const x = pe.slug && extras[pe.slug]; if (!x || !x.books) continue;
      for (const b of x.books.slice(0, 2)) { const key = pe.name + '|' + b.title; if (seenBooks.has(key)) continue; seenBooks.add(key); bks.push({who: pe.name, title: b.title, year: b.year}); }
    }
    const br = briefings[e.eventNo];
    if (br && br.reading) for (const r of br.reading) reads.push(r);
    items.push({e, bks, reads});
  }
  return items;
}
export const readingCount = items => items.reduce((n, x) => n + x.bks.length + x.reads.length, 0);
export function readingMarkdown(items){
  const lines = ['# Reading list — HowTheLightGetsIn London 2026', '', 'From your picks in the unofficial planner. Speakers’ books first, then the briefing’s suggestions.', ''];
  for (const {e, bks, reads} of items) {
    lines.push(`## ${DAYS[e.date].slice(0, 3)} ${e.time} · ${e.title}`);
    bks.forEach(b => lines.push(`- ${b.who}: *${b.title}*${b.year ? ` (${b.year})` : ''}`));
    reads.forEach(r => lines.push(`- ${r.title} — ${r.by}${r.note ? `. ${r.note}` : ''}`));
    if (!bks.length && !reads.length) lines.push('- (nothing on file for this event)');
    lines.push('');
  }
  return lines.join('\n');
}
