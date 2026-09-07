// src/routing.js — hash-route handling. #event= opens the event sheet on boot and on hashchange,
// switching the day first if the event isn't on the currently-selected one. picks=/verdicts=/notes=
// offers to import whatever this device doesn't already have, via a store-driven banner. #join= is added
// in a later task (this file grows, not replaces).
import {byNo} from './data/index.js';
import {usePlanner} from './store/planner.js';
import {useSheet} from './store/sheet.js';
import {showBanner, hideBanner} from './store/banner.js';
import {parseImportHash} from './core/exports.js';
import {mergeNoteText} from './core/notes.js';

function applyEventHash(){
  const m = location.hash.match(/event=(\d+)/);
  if (!m) return;
  const no = +m[1];
  const e = byNo.get(no);
  if (!e) return;
  if (usePlanner.getState().day !== e.date) usePlanner.getState().setFilter({day: e.date});
  useSheet.getState().open('event', no);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The import half of the old checkHash: picks=/verdicts=/notes= in the hash, offered against what this
// device doesn't already hold. Accepting, declining or finding nothing fresh all strip the hash — a
// link, once looked at, doesn't linger in the address bar or in history.
function applyImportHash(){
  const r = parseImportHash(location.hash, byNo);
  if (!r) return;

  const store = usePlanner.getState();
  const fresh = {
    picks: r.picks.filter(n => !store.picks.has(n)),
    verdicts: Object.fromEntries(Object.entries(r.verdicts).filter(([no, who]) => store.verdicts[no] !== who)),
    notes: Object.fromEntries(Object.entries(r.notes).filter(([no, text]) => (store.notes[no] || '').trim() !== text.trim())),
  };
  const clear = () => history.replaceState(null, '', location.pathname + location.search);

  const incomingTotal = r.picks.length + Object.keys(r.verdicts).length + Object.keys(r.notes).length;
  const freshTotal = fresh.picks.length + Object.keys(fresh.verdicts).length + Object.keys(fresh.notes).length;
  if (!incomingTotal || !freshTotal) { clear(); return; }

  const parts = [];
  if (r.picks.length) parts.push(plural(r.picks.length, 'pick'));
  if (Object.keys(r.verdicts).length) parts.push(plural(Object.keys(r.verdicts).length, 'verdict'));
  if (Object.keys(r.notes).length) parts.push(plural(Object.keys(r.notes).length, 'note'));

  showBanner({
    text: `This link carries ${parts.join(', ')} (${freshTotal} you don’t have yet).`,
    actions: [
      {label: 'Add them to mine', primary: true, onClick: () => {
        usePlanner.getState().importFromLink(fresh, mergeNoteText);
        clear();
        hideBanner();
      }},
      {label: 'Not now', onClick: () => { clear(); hideBanner(); }},
    ],
  });
}

export function boot(){
  applyEventHash();
  applyImportHash();
}

export function onHashChange(){
  applyEventHash();
  applyImportHash();
}
