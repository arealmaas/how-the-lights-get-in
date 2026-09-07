// src/core/crew.js — crew helpers: projection, join-link parsing, colours and summaries, moved from
// scripts/crew-core.js as ES exports (no IIFE, no module.exports). No DOM, no Firebase.

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
// every event number picked by someone other than me: the Crew chip's set, the crewOnly filter, and the
// union behind the crew calendar and the reading list's Crew tab. A Set, so the callers stay O(1).
export function crewPicked(members, myUid){
  const set = new Set();
  for (const m of members || []) {
    if (m.uid === myUid) continue;
    for (const [no, on] of Object.entries(m.picks || {})) if (on) set.add(+no);
  }
  return set;
}
// who is going to one event, written from my point of view: "you" for my own row, names for the rest.
// myPicks (the live local Set) wins over my own member document, which may lag a snapshot behind.
export const goingNames = (members, myUid, myPicks, no) => (members || [])
  .filter(m => (m.picks && m.picks[no]) || (m.uid === myUid && myPicks.has(no)))
  .map(m => (m.uid === myUid ? 'you' : m.name));
