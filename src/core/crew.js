// src/core/crew.js — crew helpers: projection, join-link parsing, colours and summaries, moved from
// the old single-file page's shared core as ES exports (no IIFE, no module.exports). No DOM, no Firebase.

// the crew-visible projection of an account: picks, verdicts, and only the notes marked shared
export function projectForCrew(s){
  const shared = (s && s.shared) || {};
  return {
    picks: {...((s && s.picks) || {})},
    verdicts: {...((s && s.verdicts) || {})},
    notes: Object.fromEntries(Object.entries((s && s.notes) || {}).filter(([no, t]) => shared[no] && typeof t === 'string' && t.trim())),
  };
}
// #join=<crewId>.<token>: a 20-character auto-id and a 22-character base64url token
export function parseJoinHash(hash){
  const m = String(hash || '').match(/(?:^#|&)join=([A-Za-z0-9]{20})\.([A-Za-z0-9_-]{22})(?:&|$)/);
  return m ? {crew: m[1], token: m[2]} : null;
}
const COLOURS = ['debates', 'talks', 'music', 'cinema', 'inner', 'kids'];   // the strand colours, defined for light and dark
export const memberColour = i => COLOURS[((i % COLOURS.length) + COLOURS.length) % COLOURS.length];
// members other than me who picked an event
export const pickedBy = (members, myUid, no) => (members || []).filter(m => m.uid !== myUid && m.picks && m.picks[no]);
// members: [{uid, name, picks}] in join order; events: the programme. Returns event lists for the hub section.
export function crewSummary(members, myUid, events){
  const has = (m, no) => !!(m.picks && m.picks[no]);
  const me = members.find(m => m.uid === myUid) || null;
  const others = members.filter(m => m.uid !== myUid);
  const sorted = [...events].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const all = members.length > 1 ? sorted.filter(e => members.every(m => has(m, e.eventNo))) : [];
  const onlyMe = sorted.filter(e => me && has(me, e.eventNo) && !others.some(m => has(m, e.eventNo)));
  const onlyThem = sorted.filter(e => !(me && has(me, e.eventNo)) && others.some(m => has(m, e.eventNo)));
  const slots = new Map();
  for (const e of sorted) for (const m of members) {
    if (!has(m, e.eventNo)) continue;
    const k = e.date + ' ' + e.time;
    if (!slots.has(k)) slots.set(k, new Map());
    const s = slots.get(k);
    if (!s.has(e.eventNo)) s.set(e.eventNo, []);
    s.get(e.eventNo).push(m.name);
  }
  const split = [...slots].filter(([, s]) => s.size > 1).map(([slot, s]) => ({slot, choices: [...s].map(([no, names]) => ({no, names}))}));
  return {all, split, onlyMe, onlyThem};
}
// The crew's plan: the map on the crew document, eventNo → uid of whoever added it (CREW-SPEC section 3,
// "The crew plan"). It backs the Crew chip's count, the crewOnly filter, the card and tile highlight, the
// crew calendar and the reading list's Crew tab. A Set, so the callers stay O(1); a false or missing
// value is not in the plan, whatever key it sits under.
export function crewPlan(picks){
  const set = new Set();
  for (const [no, by] of Object.entries(picks || {})) if (by) set.add(+no);
  return set;
}
// Who put an event into the crew's plan, by name, for the event sheet's "added by Kari". The value is a
// uid; someone who has since left the crew is nobody we can name, so that reads as null, not as "".
export function planAddedBy(members, picks, no){
  const by = picks && picks[no];
  if (!by) return null;
  const m = (members || []).find(x => x.uid === by);
  return m && m.name ? m.name : null;
}
// Who is going to one event, me first (CREW-SPEC section 7: "Going: Are, Kari"), then the other members
// in join order. myName is how I am written — the account name in the event sheet's Going row, the
// default "you" in the crew calendar and the crew reading list, where it also marks my own picks.
// myPicks (the live local Set) wins over my own member document, which may lag a snapshot behind.
export function goingNames(members, myUid, myPicks, no, myName = 'you'){
  const me = (members || []).find(m => m.uid === myUid);
  const mine = !!me && (myPicks.has(no) || !!(me.picks && me.picks[no]));
  const rest = (members || []).filter(m => m.uid !== myUid && m.picks && m.picks[no]).map(m => m.name);
  return mine ? [myName, ...rest] : rest;
}
