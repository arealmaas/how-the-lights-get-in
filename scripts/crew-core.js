// crew-core.js — pure helpers shared by the page (inlined by scripts/build.py at the CORE placeholder) and the
// Node tests in scripts/test/. No DOM, no Firebase: everything here takes plain data and returns plain data.
const CrewCore = (() => {
  'use strict';

  // base64url without padding, UTF-8 safe, available in browsers and Node 18+
  const b64u = {
    encode(str){
      const bytes = new TextEncoder().encode(String(str));
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    decode(param){
      const bin = atob(String(param).replace(/-/g, '+').replace(/_/g, '/'));
      return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
    }
  };

  const isEventKey = k => /^\d+$/.test(k);
  const cleanNotes = obj => Object.fromEntries(Object.entries(obj || {})
    .filter(([no, t]) => isEventKey(no) && typeof t === 'string' && t.trim())
    .map(([no, t]) => [+no, t.slice(0, 20000)]));

  // A note that differs on both sides keeps both texts, mine first, separated by a rule.
  function mergeNoteText(mine, theirs){
    const m = (mine || '').trim(), t = (theirs || '').trim();
    if (!m) return theirs || '';
    if (!t || m === t) return mine;
    if (m.includes(t)) return mine;
    return m + '\n\n---\n\n' + t;
  }

  // Notes travel in a URL fragment as base64url JSON (the move page and #notes= links).
  // The longest notes are dropped first until the parameter fits in maxChars.
  function encodeNotesParam(notes, maxChars = 30000){
    const shortened = Object.values(notes || {}).filter(t => typeof t === 'string' && t.length > 20000).length;
    const entries = Object.entries(cleanNotes(notes)).sort((a, b) => a[1].length - b[1].length);
    const dropped = [];
    while (entries.length) {
      const param = b64u.encode(JSON.stringify(Object.fromEntries(entries)));
      if (param.length <= maxChars) return {param, dropped, shortened};
      dropped.push(+entries.pop()[0]);
    }
    return {param: '', dropped, shortened};
  }
  function decodeNotesParam(param){
    try {
      const obj = JSON.parse(b64u.decode(param));
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
      return cleanNotes(obj);
    } catch (e) { return {}; }
  }

  // ---- account state ----
  // picks are a Set of event numbers in the page and a map {eventNo: true} in Firestore
  const picksToMap = picks => Object.fromEntries([...(picks || [])].filter(n => Number.isInteger(n)).map(n => [n, true]));
  const mapToPicks = map => new Set(Object.keys(map || {}).filter(isEventKey).map(Number));
  // First sync of a device with an account: union of picks, local wins a verdict conflict, both note texts kept.
  // `added` counts the picks this device contributed, for the "Merged N picks" line.
  function mergeState(local, remote){
    const l = local || {}, r = remote || {};
    const picks = {...(r.picks || {}), ...(l.picks || {})};
    const verdicts = {...(r.verdicts || {}), ...(l.verdicts || {})};
    const notes = {...(r.notes || {})};
    for (const [no, mine] of Object.entries(l.notes || {})) { if (mine && mine.trim()) notes[no] = mergeNoteText(mine, notes[no]); }
    const shared = {...(r.shared || {}), ...(l.shared || {})};
    const added = Object.keys(picks).filter(no => !(r.picks || {})[no]).length;
    return {picks, verdicts, notes, shared, added};
  }

  // ---- crews ----
  // the crew-visible projection of an account: picks, verdicts, and only the notes marked shared
  function projectForCrew(s){
    const shared = (s && s.shared) || {};
    return {
      picks: {...((s && s.picks) || {})},
      verdicts: {...((s && s.verdicts) || {})},
      notes: Object.fromEntries(Object.entries((s && s.notes) || {}).filter(([no, t]) => shared[no] && typeof t === 'string' && t.trim())),
    };
  }
  // #join=<crewId>.<token>: a 20-character auto-id and a 22-character base64url token
  function parseJoinHash(hash){
    const m = String(hash || '').match(/(?:^#|&)join=([A-Za-z0-9]{20})\.([A-Za-z0-9_-]{22})(?:&|$)/);
    return m ? {crew: m[1], token: m[2]} : null;
  }
  const COLOURS = ['debates', 'talks', 'music', 'cinema', 'inner', 'kids'];   // the strand colours, defined for light and dark
  const memberColour = i => COLOURS[((i % COLOURS.length) + COLOURS.length) % COLOURS.length];
  // members other than me who picked an event
  const pickedBy = (members, myUid, no) => (members || []).filter(m => m.uid !== myUid && m.picks && m.picks[no]);
  // members: [{uid, name, picks}] in join order; events: the programme. Returns event lists for the hub section.
  function crewSummary(members, myUid, events){
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

  return {b64u, mergeNoteText, encodeNotesParam, decodeNotesParam, picksToMap, mapToPicks, mergeState, projectForCrew, parseJoinHash, memberColour, pickedBy, crewSummary};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CrewCore;
