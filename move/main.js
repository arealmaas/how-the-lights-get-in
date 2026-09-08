import {encodeNotesParam, decodeNotesParam} from '../src/core/notes.js';
import {mergeCarry, parseVerdicts, encodeVerdicts} from '../src/core/carry.js';

(function(){
  // this origin is retired: drop its service worker and caches so an offline load can never resurrect the old planner
  if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
  if (window.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {});
  const NEW = 'https://how-the-light-gets-in.firebaseapp.com/';
  const a = document.getElementById('new'); a.href = NEW; a.textContent = NEW.replace(/^https:\/\//, '').replace(/\/$/, '');
  const load = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const picks = (load('htlgi-l26-picks') || []).filter(n => Number.isInteger(n));
  const verdicts = load('htlgi-l26-verdicts') || {};
  const notes = load('htlgi-l26-notes') || {};
  const hasState = picks.length || Object.keys(verdicts).length || Object.values(notes).some(t => t && t.trim());
  // With no local state, go straight through with the fragment intact; old #event= and #picks= links keep working.
  if (!hasState) { location.replace(NEW + location.hash); return; }
  // Someone with local state who arrived via a link: carry this browser's state and keep what the link
  // asked for as well. Picks are the union; a verdict the link carries fills only an event this browser
  // has no verdict for; notes the link carries are merged as the app merges an import (a friend's note
  // opened here must not be lost on the way over). src/core/carry.js has the rules and the tests.
  const inc = location.hash.match(/picks=([\d,]*)/);
  const incV = location.hash.match(/verdicts=([^&]+)/);
  const incN = location.hash.match(/notes=([^&]+)/);
  const ev = location.hash.match(/event=(\d+)/);
  const carried = mergeCarry({picks, verdicts, notes}, {picks: inc ? inc[1].split(',') : [], verdicts: incV ? parseVerdicts(incV[1]) : {}, notes: incN ? decodeNotesParam(incN[1]) : {}});
  const {param: p, dropped: droppedList, shortened} = encodeNotesParam(carried.notes, 30000);
  const dropped = droppedList.length;
  const MAX_NOTE = 20000;
  const v = encodeVerdicts(carried.verdicts);
  const link = NEW + '#picks=' + carried.picks.join(',') + (v ? '&verdicts=' + v : '') + (p ? '&notes=' + p : '') + (ev ? '&event=' + ev[1] : '');
  document.getElementById('carry').hidden = false; document.getElementById('go').hidden = false;
  const problems = [];
  if (dropped) problems.push(dropped + ' long note' + (dropped === 1 ? '' : 's') + ' will not fit in the link');
  if (shortened) problems.push(shortened + ' very long note' + (shortened === 1 ? '' : 's') + ' will be shortened to ' + MAX_NOTE + ' characters');
  if (problems.length) { const w = document.getElementById('warn'); w.hidden = false; w.textContent = problems.join('; ') + '; export your notes (.md) from the old planner first if you need them in full.'; }
  document.getElementById('btn').addEventListener('click', () => { location.href = link; });
})();
