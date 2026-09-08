// src/core/carry.js — what the move page carries across the origin boundary (CREW-SPEC section 8). The
// old GitHub Pages address cannot read the new site's localStorage, so the button there builds a
// #picks=…&verdicts=…&notes=… link out of this browser's own state plus whatever the link that brought
// someone here was already asking for.
//
// Deliberately light: move/main.js is built into one small file (vite.move.config.js), and importing
// src/core/exports.js for safeDecode would drag the whole programme in with it. The one import is
// src/core/notes.js, which is as pure as this file. Pure data in, pure data out — no DOM, no storage,
// no Firebase.
import {mergeNoteText} from './notes.js';

// picks arrive as numbers from localStorage and as strings from the hash. Only digit runs are events:
// `''.split(',')` is `['']`, and Number('') is 0, which would otherwise carry a pick for event zero.
const nums = list => (list || []).map(n => String(n).trim()).filter(s => /^\d+$/.test(s)).map(Number);
const dec = s => { try { return decodeURIComponent(s); } catch (e) { return ''; } };

// `no:who;no:who`, `who` percent-encoded — the shape #verdicts= uses in both directions. Unlike
// exports.js's parseImportHash this cannot check the event numbers against the programme; the new site
// does that when it reads the link back.
export function parseVerdicts(param){
  return Object.fromEntries(String(param || '').split(';').map(pair => {
    const i = pair.indexOf(':');
    return i < 0 ? null : [pair.slice(0, i).trim(), pair.slice(i + 1)];
  }).filter(p => p && /^\d+$/.test(p[0]) && p[1]).map(([no, who]) => [+no, dec(who)]).filter(([, who]) => who));
}
export const encodeVerdicts = verdicts =>
  Object.entries(verdicts || {}).map(([no, who]) => no + ':' + encodeURIComponent(who)).join(';');

// Picks are the union. Verdicts are the union too, but a verdict this browser already holds is never
// overwritten: the link is an invitation, and what you voted here is what you meant. Order is stable —
// this device's own picks first, then whatever the link added. Notes the link carries are merged the way
// the app merges a #notes= import: a note held here is kept, a different incoming text is appended under
// a rule, a new one is added.
export function mergeCarry(local, incoming){
  const picks = [...new Set([...nums(local && local.picks), ...nums(incoming && incoming.picks)])];
  const verdicts = {...((incoming && incoming.verdicts) || {}), ...((local && local.verdicts) || {})};
  const notes = {...((local && local.notes) || {})};
  for (const [no, t] of Object.entries((incoming && incoming.notes) || {})) notes[no] = mergeNoteText(notes[no], t);
  return {picks, verdicts, notes};
}
