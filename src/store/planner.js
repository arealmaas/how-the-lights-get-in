import {create} from 'zustand';
import {byNo} from '../data/index.js';
import {change as syncChange} from '../cloud/sync.js';
import {NOTE_LIMIT} from '../core/notes.js';
import {useCloud} from './cloud.js';

export const LS = {state: 'htlgi-l26-state', picks: 'htlgi-l26-picks', notes: 'htlgi-l26-notes', verdicts: 'htlgi-l26-verdicts', shared: 'htlgi-l26-shared'};
export const DEL = '__DELETE__';
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const clean = (obj, ok) => Object.fromEntries(Object.entries(obj || {}).filter(([k, v]) => byNo.has(+k) && ok(v)));
// Keep the local copy through a pending write or a server rollback after a refusal.
// Each write is tied to its account, so switching accounts cannot retain somebody else's note.
const noteWrites = new Map();

export function hydrate(){
  const f = Object.assign({day: '2026-09-19', view: 'list', groups: [], venue: '', topic: '', picksOnly: false, crewOnly: false}, load(LS.state, {}));
  if (!['2026-09-19', '2026-09-20'].includes(f.day)) f.day = '2026-09-19';
  return {
    ...f, q: '',
    picks: new Set((load(LS.picks, []) || []).filter(n => byNo.has(n))),
    verdicts: clean(load(LS.verdicts, {}), v => typeof v === 'string' && v),
    notes: clean(load(LS.notes, {}), v => typeof v === 'string' && v.trim()),
    shared: clean(load(LS.shared, {}), v => v === true),
  };
}
const persistFilters = s => save(LS.state, {day: s.day, view: s.view, groups: s.groups, venue: s.venue, topic: s.topic, picksOnly: s.picksOnly, crewOnly: s.crewOnly});

export const usePlanner = create((set, get) => ({
  ...hydrate(),
  setFilter(patch){ set(patch); persistFilters(get()); },
  clearFilters(){ set({groups: [], venue: '', topic: '', picksOnly: false, crewOnly: false, q: ''}); persistFilters(get()); },
  setQuery(q){ set({q}); },
  togglePick(no){
    const picks = new Set(get().picks); const on = !picks.has(no);
    if (on) picks.add(no); else picks.delete(no);
    set({picks}); save(LS.picks, [...picks]);
    syncChange({['picks.' + no]: on ? true : DEL}, {['picks.' + no]: on ? true : DEL});
  },
  setVerdict(no, who){
    const verdicts = {...get().verdicts}; if (who) verdicts[no] = who; else delete verdicts[no];
    set({verdicts}); save(LS.verdicts, verdicts);
    syncChange({['verdicts.' + no]: who || DEL}, {['verdicts.' + no]: who || DEL});
  },
  setNote(no, text){
    text = String(text || '').slice(0, NOTE_LIMIT);
    const notes = {...get().notes}; if (text.trim()) notes[no] = text; else delete notes[no];
    const local = save(LS.notes, notes);
    set({notes});
    const cloud = syncChange({['notes.' + no]: notes[no] || DEL}, get().shared[no] ? {['notes.' + no]: notes[no] || DEL} : null);
    if (cloud) {
      const write = {text: notes[no] || '', uid: useCloud.getState().user?.uid};
      noteWrites.set(no, write);
      cloud.then(saved => { if (saved && noteWrites.get(no) === write) noteWrites.delete(no); });
    }
    return {local, cloud};
  },
  setShared(no, on){
    const shared = {...get().shared}; if (on) shared[no] = true; else delete shared[no];
    set({shared}); save(LS.shared, shared);
    const note = get().notes[no];
    syncChange({['shared.' + no]: on ? true : DEL}, {['notes.' + no]: on && note ? note : DEL});
  },
  importFromLink({picks: inc = [], verdicts: inV = {}, notes: inN = {}}, mergeNoteText){
    const s = get(); const picks = new Set(s.picks); inc.forEach(n => picks.add(n));
    const verdicts = {...s.verdicts, ...inV};
    const notes = {...s.notes}; for (const [no, t] of Object.entries(inN)) notes[no] = mergeNoteText(notes[no], t);
    set({picks, verdicts, notes}); save(LS.picks, [...picks]); save(LS.verdicts, verdicts); save(LS.notes, notes);
    const uf = {}, mf = {};
    inc.forEach(n => { uf['picks.' + n] = true; mf['picks.' + n] = true; });
    for (const no of Object.keys(inV)) { uf['verdicts.' + no] = verdicts[no]; mf['verdicts.' + no] = verdicts[no]; }
    for (const no of Object.keys(inN)) { uf['notes.' + no] = notes[no]; if (s.shared[no]) mf['notes.' + no] = notes[no]; }
    if (Object.keys(uf).length) syncChange(uf, mf);
  },
  // the snapshot side of sync: replace the four maps without syncing back; `keepNote` is the note being typed
  replaceFromAccount({picks, verdicts, notes, shared}, keepNote){
    const s = get();
    const nextNotes = clean(notes, v => typeof v === 'string' && v.trim());
    for (const [no, write] of noteWrites) {
      if (write.uid !== useCloud.getState().user?.uid) continue;
      if (write.text) nextNotes[no] = write.text; else delete nextNotes[no];
    }
    if (keepNote != null) { if (s.notes[keepNote]) nextNotes[keepNote] = s.notes[keepNote]; else delete nextNotes[keepNote]; }
    const next = {picks: new Set(Object.keys(picks || {}).map(Number).filter(n => byNo.has(n))), verdicts: clean(verdicts, v => typeof v === 'string'), notes: nextNotes, shared: clean(shared, v => v === true)};
    const same = JSON.stringify([[...s.picks].sort(), s.verdicts, s.notes, s.shared]) === JSON.stringify([[...next.picks].sort(), next.verdicts, next.notes, next.shared]);
    if (same) return false;
    set(next); save(LS.picks, [...next.picks]); save(LS.verdicts, next.verdicts); save(LS.notes, next.notes); save(LS.shared, next.shared);
    return true;
  },
  local(){ const s = get(); return {picks: Object.fromEntries([...s.picks].map(n => [n, true])), verdicts: {...s.verdicts}, notes: {...s.notes}, shared: {...s.shared}}; },
  clearLocal(){ noteWrites.clear(); set({picks: new Set(), verdicts: {}, notes: {}, shared: {}}); Object.values(LS).forEach(k => localStorage.removeItem(k)); },
}));
