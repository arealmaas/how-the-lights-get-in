// src/cloud/sync.js — the account document: the sign-in sequence, the live subscription, the snapshot
// apply, the field-level write batches and the offline queue. Ported function for function from the
// account section of the old single-file page (afterSignIn, subscribeUser, stopSync, applyUserData,
// syncError, queueChange/replayQueue/syncChange). The old page's globals become store reads and writes;
// its innerHTML banners become banner-store entries. No React here, and no firebase/* import: the SDK
// arrives through auth.js's getFb().
import {useCloud} from '../store/cloud.js';
import {usePlanner, DEL} from '../store/planner.js';
import {okBanner} from '../store/banner.js';
import {mergeState} from '../core/notes.js';
import {projectForCrew} from '../core/crew.js';
import {CLOUD} from '../data/index.js';
import {getFb, isDeleting, authMessage} from './auth.js';
import * as crew from './crew.js';

export const LS_ACCOUNT = 'htlgi-l26-account';   // {uid}: this device has a live account session (the next boot loads the SDK; changes queue)
export const LS_LAST_UID = 'htlgi-l26-last-uid';   // the uid this device last synced with; a plain sign-out keeps it (spec section 6, steps 2 and 4)
export const LS_QUEUE = 'htlgi-l26-queue';

const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

export const accountMarker = () => load(LS_ACCOUNT, null);
export const lastUid = () => localStorage.getItem(LS_LAST_UID) || null;
// The marker is also mirrored into the cloud store: the Account card's sync sentence reads it, and
// localStorage on its own does not re-render anything.
export function setMarker(m){
  if (m) { save(LS_ACCOUNT, m); if (m.uid) localStorage.setItem(LS_LAST_UID, m.uid); } else localStorage.removeItem(LS_ACCOUNT);
  useCloud.getState().patch({marker: m || null});
}
// spec section 10, quota sanity: two counters, in the store instead of the old window.htlgiSyncStats.
// crew.js counts its own three listeners through this, so "snapshots" is every snapshot the app receives.
export function bump(k){ const s = useCloud.getState().stats || {writes: 0, snapshots: 0}; useCloud.getState().patch({stats: {...s, [k]: s[k] + 1}}); }

export const userRef = () => { const fb = getFb(); return fb.F.doc(fb.db, 'users', useCloud.getState().user.uid); };

// ---------- the sign-in sequence (CREW-SPEC section 6, "Signing in") ----------
// Create from local, merge once per device and account, or replace when the device belonged to a
// different account; only then subscribe.
export async function afterSignIn(u){
  const marker = accountMarker();
  // "Last synced with a different uid" (steps 2 and 4) must survive a plain sign-out, or the next account to
  // sign in on a shared browser would merge the previous person's picks, notes and share flags into its own.
  const last = lastUid() || (marker && marker.uid) || null;
  const foreign = !!last && last !== u.uid;
  if (marker && marker.uid === u.uid) {
    useCloud.getState().patch({signInBranch: 'subscribe'});
    subscribeUser();
    replayQueue();
    crew.afterSubscribe();
    return;
  }
  const fb = getFb(); const {F} = fb; const ref = userRef();
  let snap;
  try { snap = await F.getDocFromServer(ref); }
  catch (e) {
    useCloud.getState().patch({syncPending: true});
    okBanner('Signing in for the first time on this device needs a connection. Your picks stay on this device until you are back online.');
    window.addEventListener('online', () => {
      const {syncPending, user} = useCloud.getState();
      if (syncPending && user) afterSignIn(user).catch(err => authMessage(err));
    }, {once: true});
    return;
  }
  const local = usePlanner.getState().local();
  let name = useCloud.getState().accountName;
  if (!snap.exists()) {
    // a device that last synced with another account does not seed a new account with that account's data
    const fresh = foreign ? {picks: {}, verdicts: {}, notes: {}, shared: {}} : local;
    useCloud.getState().patch({signInBranch: foreign ? 'create-empty' : 'create-from-local'});
    await F.setDoc(ref, {name, ...fresh, updatedAt: F.serverTimestamp(), v: 1});
  } else if (!foreign) {
    useCloud.getState().patch({signInBranch: 'merge'});
    const remote = snap.data();
    const m = mergeState(local, remote);
    name = (remote.name || name).slice(0, 40);
    useCloud.getState().patch({accountName: name});
    await F.setDoc(ref, {name, ...(remote.crew ? {crew: remote.crew} : {}), picks: m.picks, verdicts: m.verdicts, notes: m.notes, shared: m.shared, updatedAt: F.serverTimestamp(), v: 1});
    // The merge only wrote the account. While the account is in a crew, the member projection is a copy of
    // it (CREW-SPEC section 6, "Writes") and would otherwise stay at whatever the crew last saw until the
    // next toggle — this device's picks would be missing from the crew view. Written after the setDoc has
    // landed, never in the same batch: the member rule checks the note keys against `shared` on the user
    // document with getAfter(), which has to be the merged map by then. A removal while we were away makes
    // this write fail, and that is all it should do: onPointer() clears the pointer from the next snapshot.
    if (typeof remote.crew === 'string') {
      F.updateDoc(F.doc(fb.db, 'crews', remote.crew, 'members', u.uid), {
        name, ...projectForCrew({picks: m.picks, verdicts: m.verdicts, notes: m.notes, shared: m.shared}), updatedAt: F.serverTimestamp(),
      }).catch(() => {});
    }
    if (m.added) okBanner(`Merged ${m.added} pick${m.added === 1 ? '' : 's'} from this device into your account.`);
  } else {
    // this device synced with a different account before: the first snapshot replaces local state
    useCloud.getState().patch({signInBranch: 'replace'});
  }
  localStorage.removeItem(LS_QUEUE);
  setMarker({uid: u.uid});
  useCloud.getState().patch({syncPending: false});
  subscribeUser();
  crew.afterSubscribe();
}

// ---------- the live user document ----------
let unsubUser = null;
// The one honest thing to say when the account is not there any more, whichever way we find out: a snapshot
// of a missing document, or a listener refused because there is nothing left to read (CREW-SPEC line 273).
const GONE = 'Your account was deleted on another device. This device keeps its local copy.';

export function subscribeUser(){
  const fb = getFb();
  unsubscribeUser();
  unsubUser = fb.F.onSnapshot(userRef(), snap => {
    bump('snapshots');
    if (!snap.exists()) { if (!isDeleting()) stopSync(GONE); return; }
    applyUserData(snap.data());
  }, err => userError(err));
}
export function unsubscribeUser(){ if (unsubUser) { unsubUser(); unsubUser = null; } }

export function stopSync(msg){
  useCloud.getState().patch({syncStopped: true});
  unsubscribeUser();
  setMarker(null);
  if (msg) okBanner(msg);
}

// The note being typed wins: replaceFromAccount keeps the local text of the focused note. Nothing is
// rebuilt underneath a focused textarea either — Notes.jsx only follows the store while unfocused, so
// the old page's flushNote()/refreshSheet() dance is not needed here.
const focusedNote = () => {
  const el = document.activeElement;
  return el && el.matches && el.matches('textarea[data-note]') ? +el.dataset.note : null;
};

export function applyUserData(d){
  usePlanner.getState().replaceFromAccount(d || {}, focusedNote());
  const st = useCloud.getState();
  st.patch({
    accountName: ((d && d.name) || st.accountName || '').slice(0, 40),
    crewId: d && typeof d.crew === 'string' ? d.crew : null,
  });
  crew.onPointer();
}

// The user document's own listener. `permission-denied` here is not a crew matter: the rules let the owner
// read their own document and nobody else's, so the only way to be refused is that the account is gone
// (CREW-SPEC section 6, "Failure modes": "On the user document: cannot happen with these rules unless the
// account is gone; treat as 'account deleted elsewhere'"). Saying "you are no longer in this crew" here
// would be a guess, and a wrong one. Only the write path — change()'s commits and the queue replay — can
// be denied for a crew reason, and that is what routes to crew.onDenied().
export function userError(e){
  if (e && e.code === 'permission-denied') { if (!isDeleting()) stopSync(GONE); return; }
  syncError(e);
}

export function syncError(e){
  const code = (e && e.code) || '';
  if (code === 'resource-exhausted') {
    if (!useCloud.getState().syncPaused) {
      useCloud.getState().patch({syncPaused: true});
      okBanner('Sync is paused until tomorrow: the free daily limit is used up. Your planner keeps working on this device.');
    }
    return;
  }
  if (code === 'permission-denied' && useCloud.getState().crewId) { crew.onDenied(); return; }
  console.warn('sync', e);
}

// ---------- writes ----------
// One batch per change: the user document, plus (while in a crew) the member projection. When the SDK or
// the session is not ready on a device that has an account, the change is queued and replayed after the
// next subscribe.
const withSentinels = o => {
  const {F} = getFb();
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === DEL ? F.deleteField() : v]));
};
function queueChange(userFields, memberFields){
  const q = load(LS_QUEUE, []) || [];
  q.push({uf: userFields, mf: memberFields || null});
  save(LS_QUEUE, q.slice(-500));
}
export function replayQueue(){
  const q = load(LS_QUEUE, []) || [];
  localStorage.removeItem(LS_QUEUE);
  q.forEach(x => change(x.uf, x.mf));
}
export function change(userFields, memberFields){
  const fb = getFb(); const {user, crewId} = useCloud.getState();
  if (!fb || !user || !accountMarker()) { if (CLOUD && accountMarker()) queueChange(userFields, memberFields); return; }
  const {F} = fb; const b = F.writeBatch(fb.db);
  const coupled = !!(crewId && memberFields);
  const ref = userRef();   // captured now: the session may be gone by the time a rejection arrives
  b.update(ref, {...withSentinels(userFields), updatedAt: F.serverTimestamp()});
  if (coupled) b.update(F.doc(fb.db, 'crews', crewId, 'members', user.uid), {...withSentinels(memberFields), updatedAt: F.serverTimestamp()});
  bump('writes');
  // Resolve only after the server acknowledges the write. Offline commits remain pending
  // in Firestore's persistent queue, so a local save is never mistaken for an account save.
  return b.commit().then(() => true, async e => {
    // A batch is all or nothing, so a member write the rules refuse takes the account write down with it:
    // a pick made offline after a removal, or a queued change replayed against a crew this account has
    // left, would be lost from the account too. The account half is always allowed — write it on its own,
    // then let the original error be handled (crew.onDenied() clears the pointer, which stops the coupling
    // from happening again).
    const code = (e && e.code) || '';
    if (coupled && (code === 'permission-denied' || code === 'not-found')) {
      const retry = F.updateDoc(ref, {...withSentinels(userFields), updatedAt: F.serverTimestamp()});
      syncError(e);
      try { await retry; return true; }
      catch (error) { syncError(error); return false; }
    }
    syncError(e);
    return false;
  });
}
