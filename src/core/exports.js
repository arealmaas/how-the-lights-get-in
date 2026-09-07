// src/core/exports.js — the notes/verdicts Markdown export, the shareable picks link, and the parsing half
// of the old page's checkHash (picks=/verdicts=/notes= import). The banner and history bookkeeping that used
// to sit alongside this stay in the UI/routing layer.
import {DAYS, PUBLIC_URL} from '../data/index.js';
import {whoPlain} from './labels.js';
import {decodeNotesParam} from './notes.js';

export function notesMarkdown(events, picks, notes, verdicts){
  const hasNote = no => !!(notes[no] && notes[no].trim()) || !!verdicts[no];
  const involved = events.filter(e => picks.has(e.eventNo) || hasNote(e.eventNo));
  const lines = ['# HowTheLightGetsIn London 2026 — my picks and notes', '', `Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} from the unofficial planner (${PUBLIC_URL}).`, ''];
  for (const date of Object.keys(DAYS)) {
    const evs = involved.filter(e => e.date === date);
    if (!evs.length) continue;
    lines.push(`## ${DAYS[date]} ${date}`, '');
    for (const e of evs) {
      lines.push(`### ${e.time} · ${e.title}${picks.has(e.eventNo) ? ' ★' : ''}`);
      lines.push(`${e.type} · ${e.venue}${whoPlain(e) ? ' · ' + whoPlain(e) : ''}`);
      if (verdicts[e.eventNo]) lines.push(`Verdict: **${verdicts[e.eventNo]}**`);
      if (notes[e.eventNo] && notes[e.eventNo].trim()) lines.push('', notes[e.eventNo].trim());
      lines.push('');
    }
  }
  return lines.join('\n');
}
// the shareable "my festival" link: sorted picks and any verdicts, carried in the hash
export function picksLink(origin, picks, verdicts){
  const v = Object.entries(verdicts).map(([no, who]) => `${no}:${encodeURIComponent(who)}`).join(';');
  return origin + '#picks=' + [...picks].sort((a, b) => a - b).join(',') + (v ? '&verdicts=' + v : '');
}
export const safeDecode = s => { try { return decodeURIComponent(s); } catch (e) { return ''; } };
// the parsing half of the old checkHash: picks=/verdicts=/notes= → plain data, garbage and unknown events dropped.
// null means the hash carries none of these three (the caller then has nothing to import).
export function parseImportHash(hash, byNo){
  if (!/(?:^#|&)(picks|verdicts|notes)=/.test(hash)) return null;
  const pm = hash.match(/picks=([\d,]*)/);
  const picks = pm ? pm[1].split(',').map(Number).filter(n => byNo.has(n)) : [];
  const vm = hash.match(/verdicts=([^&]+)/);
  const verdicts = vm ? Object.fromEntries(vm[1].split(';').map(x => x.split(':')).filter(([no, who]) => byNo.has(+no) && who).map(([no, who]) => [+no, safeDecode(who || '')])) : {};
  const nm = hash.match(/notes=([A-Za-z0-9_-]+)/);
  const notes = nm ? Object.fromEntries(Object.entries(decodeNotesParam(nm[1])).filter(([no]) => byNo.has(+no))) : {};
  return {picks, verdicts, notes};
}
