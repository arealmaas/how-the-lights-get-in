// src/core/notes.js — notes and picks codecs, moved from the old single-file page's shared core as ES
// exports (no IIFE, no
// module.exports). Shared by the app and the move page. No DOM, no Firebase: plain data in, plain data out.

export const NOTE_LIMIT = 20000;

// base64url without padding, UTF-8 safe, available in browsers and Node 18+
export const b64u = {
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
  .map(([no, t]) => [+no, t.slice(0, NOTE_LIMIT)]));

// A note that differs on both sides keeps both texts, mine first, separated by a rule.
export function mergeNoteText(mine, theirs){
  const m = (mine || '').trim(), t = (theirs || '').trim();
  if (!m) return theirs || '';
  if (!t || m === t) return mine;
  if (m.includes(t)) return mine;
  return m + '\n\n---\n\n' + t;
}

// Notes travel in a URL fragment as base64url JSON (the move page and #notes= links).
// The longest notes are dropped first until the parameter fits in maxChars.
export function encodeNotesParam(notes, maxChars = 30000){
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
export function decodeNotesParam(param){
  try {
    const obj = JSON.parse(b64u.decode(param));
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    return cleanNotes(obj);
  } catch (e) { return {}; }
}

// ---- account state ----
// picks are a Set of event numbers in the page and a map {eventNo: true} in Firestore
export const picksToMap = picks => Object.fromEntries([...(picks || [])].filter(n => Number.isInteger(n)).map(n => [n, true]));
export const mapToPicks = map => new Set(Object.keys(map || {}).filter(isEventKey).map(Number));
// First sync of a device with an account: union of picks, local wins a verdict conflict, both note texts kept.
// `added` counts the picks this device contributed, for the "Merged N picks" line.
export function mergeState(local, remote){
  const l = local || {}, r = remote || {};
  const picks = {...(r.picks || {}), ...(l.picks || {})};
  const verdicts = {...(r.verdicts || {}), ...(l.verdicts || {})};
  const notes = {...(r.notes || {})};
  for (const [no, mine] of Object.entries(l.notes || {})) { if (mine && mine.trim()) notes[no] = mergeNoteText(mine, notes[no]); }
  const shared = {...(r.shared || {}), ...(l.shared || {})};
  const added = Object.keys(picks).filter(no => !(r.picks || {})[no]).length;
  return {picks, verdicts, notes, shared, added};
}
