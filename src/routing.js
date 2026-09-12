// src/routing.js — hash-route handling. #event= opens the event sheet on boot and on hashchange,
// switching the day first if the event isn't on the currently-selected one. #join= stores the invite and
// strips itself. picks=/verdicts=/notes= offers to import whatever this device doesn't already have, via
// a store-driven banner.
import {byNo, CLOUD} from './data/index.js';
import {usePlanner} from './store/planner.js';
import {useSheet} from './store/sheet.js';
import {showBanner, hideBanner} from './store/banner.js';
import {parseImportHash} from './core/exports.js';
import {parseJoinHash} from './core/crew.js';
import {mergeNoteText} from './core/notes.js';
import {loadFirebase} from './cloud/auth.js';
import {offerJoin, SS_JOIN} from './cloud/crew.js';

function applyEventHash(){
  const m = location.hash.match(/(?:^#|&)event=(\d+)(?:&|$)/);
  if (!m) return;
  const no = +m[1];
  const e = byNo.get(no);
  if (!e) return;
  if (usePlanner.getState().day !== e.date) usePlanner.getState().setFilter({day: e.date});
  const top = useSheet.getState().stack.at(-1);
  if (top?.kind !== 'event' || top.key !== no) useSheet.getState().open('event', no);
}

// #join=<crewId>.<token>: keep the invite for an hour (it has to survive a redirect sign-in and a reload
// while an account is being created) and take the token out of the address bar and the history at once.
// Returns true when the hash was a join link, which ends the routing for this hash.
function applyJoinHash(){
  const j = parseJoinHash(location.hash);
  if (!j) return false;
  try { sessionStorage.setItem(SS_JOIN, JSON.stringify({...j, at: Date.now()})); } catch (e) {}
  history.replaceState(history.state, '', location.pathname + location.search);
  // Offered as soon as the SDK is there, signed in or not: a signed-out visitor gets the "sign in to join"
  // banner and the real offer after sign-in (sync.js calls crew.afterSubscribe() once subscribed), while a
  // tab that is already signed in — the link opened in a running app, arriving through hashchange — has no
  // sign-in coming and would otherwise see nothing at all. On boot the subscription offers it a second
  // time; that costs one invite read and no duplicate banner, because showBanner replaces the current one.
  if (CLOUD) loadFirebase().then(() => offerJoin()).catch(() => {});
  return true;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The import half of the old checkHash: picks=/verdicts=/notes= in the hash, offered against what this
// device doesn't already hold. Read and strip the payload before offering a decision so later
// navigation cannot retain private notes or make the decision overwrite a newer event address.
function applyImportHash(){
  const r = parseImportHash(location.hash, byNo);
  if (!r) return;
  // Read once, then strip private payloads before any navigation can copy them into history.
  // Banner callbacks must not rewrite a different event URL opened while the decision was pending.
  const event = location.hash.match(/(?:^#|&)event=(\d+)(?:&|$)/);
  history.replaceState(history.state, '', location.pathname + location.search +
    (event && byNo.has(+event[1]) ? '#event=' + Number(event[1]) : ''));

  const store = usePlanner.getState();
  const fresh = {
    picks: r.picks.filter(n => !store.picks.has(n)),
    verdicts: Object.fromEntries(Object.entries(r.verdicts).filter(([no, who]) => store.verdicts[no] !== who)),
    notes: Object.fromEntries(Object.entries(r.notes).filter(([no, text]) => (store.notes[no] || '').trim() !== text.trim())),
  };

  const incomingTotal = r.picks.length + Object.keys(r.verdicts).length + Object.keys(r.notes).length;
  const freshTotal = fresh.picks.length + Object.keys(fresh.verdicts).length + Object.keys(fresh.notes).length;
  if (!incomingTotal || !freshTotal) return;

  const parts = [];
  if (r.picks.length) parts.push(plural(r.picks.length, 'pick'));
  if (Object.keys(r.verdicts).length) parts.push(plural(Object.keys(r.verdicts).length, 'verdict'));
  if (Object.keys(r.notes).length) parts.push(plural(Object.keys(r.notes).length, 'note'));

  showBanner({
    text: `This link carries ${parts.join(', ')} (${freshTotal} you don’t have yet).`,
    actions: [
      {label: 'Add them to mine', primary: true, onClick: () => {
        usePlanner.getState().importFromLink(fresh, mergeNoteText);
        hideBanner();
      }},
      {label: 'Not now', onClick: hideBanner},
    ],
  });
}

export function boot(){
  if (applyJoinHash()) return;
  applyEventHash();
  applyImportHash();
}

export function onHashChange(){
  if (applyJoinHash()) return;
  applyEventHash();
  applyImportHash();
}
