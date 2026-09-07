// src/core/clashes.js — which picks overlap. Returns the two maps instead of assigning globals.
import {minutes, dur} from './time.js';

// Overlap between two picks, in minutes (0 = none). A hard clash is a start within 15 minutes of another pick;
// a smaller overlap (the festival staggers :00 and :30 starts) is shown as a quiet note, not a warning.
export function overlapMin(a, b){
  if (a.date !== b.date) return 0;
  const as = minutes(a.time), ae = as + dur(a), bs = minutes(b.time), be = bs + dur(b);
  return Math.max(0, Math.min(ae, be) - Math.max(as, bs));
}
const HARD = 45;   // overlap of 45+ minutes of a 60-minute session = starts within 15 minutes
export function computeClashes(events, picks){
  const clashes = new Map(), soft = new Map();
  const picked = events.filter(e => picks.has(e.eventNo));
  for (const a of picked) for (const b of picked) {
    if (a === b) continue;
    const o = overlapMin(a, b); if (!o) continue;
    const m = o >= HARD ? clashes : soft;
    if (!m.has(a.eventNo)) m.set(a.eventNo, []);
    m.get(a.eventNo).push({no: b.eventNo, min: o});
  }
  return {clashes, soft};
}
