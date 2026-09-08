// src/cloud/crew.js — the crew layer: crews/{id}, its members, invites and block records. Ported
// function for function from the crew section of the old single-file page (subscriptions, the cache,
// create, rename, leave, invites, joining) plus the four functions Phase 2's Task 5 planned but never
// applied to that page (removeMember, readmit, makeOwner, closeCrew).
//
// The old page's `crew` and `crewId` globals become useCloud state, so React re-renders when a snapshot
// lands; the only module state left is the listener handles and the `leaving` flag, which are not UI.
// Its innerHTML banners become banner-store entries with real handlers. No React here, and no firebase/*
// import: the SDK arrives through auth.js's getFb().
// The crew's plan (the picks map on the crew document, CREW-SPEC section 3) is read by the crew-document
// listener and written by toggleCrewPick(); it has no local copy beyond the crew cache.
import {useCloud, selectMyUid} from '../store/cloud.js';
import {usePlanner, DEL} from '../store/planner.js';
import {useSheet} from '../store/sheet.js';
import {showBanner, okBanner, hideBanner} from '../store/banner.js';
import {projectForCrew} from '../core/crew.js';
import {CLOUD, PUBLIC_URL, byNo} from '../data/index.js';
import {getFb, authMessage} from './auth.js';
import {IOS, PHONE, STANDALONE} from './platform.js';
import {change, userRef, accountMarker, bump} from './sync.js';

export const LS_CREW_CACHE = 'htlgi-l26-crew-cache';   // the overlay that renders before the SDK loads
export const SS_JOIN = 'htlgi-l26-join';               // the pending invite, for an hour

let crewUnsubs = [], removedUnsub = null, leaving = false, joining = false;
// A create or a join writes the membership and the pointer in one batch, and the pointer is visible from
// the local write long before the batch reaches the server. onPointer() subscribes on that pointer, so the
// rules — which only know the crew as it stands on the server — refuse the listen from an account whose
// member document has not arrived yet. `settling` remembers such a batch so crewError can tell that refusal
// ("not yet") from a real removal, and listen again once the write has landed.
let settling = null;      // {id, done: Promise<boolean>} while a create or join batch is in flight
let relistening = false;  // one re-subscribe for the several listeners that are refused together

const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

const st = () => useCloud.getState();
// Registers a create or join batch as in flight. The returned promise never rejects, so remembering it
// cannot turn a commit failure the caller already handles into an unhandled rejection.
function settle(id, promise){
  const done = promise.then(() => true, () => false);
  settling = {id, done};
  done.then(() => { if (settling && settling.done === done) settling = null; });
  return done;
}
const inFlight = id => !!(settling && settling.id === id);
// Every listener owns a few fields of the same crew object; each patch merges onto whatever the others
// have already put in the store, which is what the old page got for free by mutating one global.
const patchCrew = fields => { const cur = st().crew; if (cur) st().patch({crew: {...cur, ...fields}}); };

const crewRef = id => { const fb = getFb(); return fb.F.doc(fb.db, 'crews', id); };
const memberRef = (id, uid) => { const fb = getFb(); return fb.F.doc(fb.db, 'crews', id, 'members', uid); };

// The card and its actions are on screen from the moment hydrateCrewCache() paints the cached crew, which
// is before the SDK chunk has loaded and, on an offline start, instead of it. Every writer below says this
// rather than throwing on getFb().F; closeCrew says it too, because a cache-only crew has no invite or
// block records to delete and closing on that list would orphan them. auth.js says it as well, for a
// delete that cannot yet tell whether this account owns its crew.
export const NOT_READY = 'Still connecting; try again in a moment.';
// The writes that act on other people's documents all need a crew the server has confirmed, not one
// painted from the cache: `live` says the members list came from a server snapshot. Asked before the
// confirmation dialog, so nobody answers "yes, remove them" and is only then told to try again.
const ready = () => { const {crew} = st(); return !!(getFb() && navigator.onLine && crew && crew.live); };

export function crewOwnedByMe(){ const {crew, user} = st(); return !!(crew && user && crew.createdBy === user.uid); }
// Identity, not session: on a cold or offline start the account marker is who I am (see selectMyUid), so
// the cached crew's members can be told apart before the SDK has produced a `user`.
export function others(){ const s = st(); const uid = selectMyUid(s); return (s.crew && uid) ? s.crew.members.filter(m => m.uid !== uid) : []; }
export function liveInvites(){ const {crew} = st(); return crew ? crew.invites.filter(i => !i.revoked && i.expiresAt && i.expiresAt.toMillis() > Date.now()) : []; }
export function inviteLink(token){ const {crew} = st(); return crew ? PUBLIC_URL + '#join=' + crew.id + '.' + token : ''; }
const validInvite = inv => !!(inv && !inv.revoked && inv.expiresAt && inv.expiresAt.toMillis() > Date.now());

function saveCrewCache(){
  const {crew} = st();
  if (crew) save(LS_CREW_CACHE, {id: crew.id, name: crew.name, createdBy: crew.createdBy, picks: crew.picks || {}, members: crew.members, syncedAt: crew.syncedAt});
}
// Boot overlay (CREW-SPEC section 6, "Failure modes"): a device with an account paints its crew from the
// cache before the SDK is fetched, so the card, the badges and the plan's highlight are there on a cold,
// offline start. A cache written before the plan existed has no picks: that is an empty plan, not a crash.
export function hydrateCrewCache(){
  if (!CLOUD || !accountMarker()) return;
  const c = load(LS_CREW_CACHE, null);
  if (c && c.id) st().patch({crewId: c.id, crew: {...c, picks: c.picks || {}, invites: [], removed: [], live: false, invitesLive: false}});
}

// ---------- subscriptions ----------
// Called after every user-document snapshot: the pointer decides whether we listen to a crew.
export function onPointer(){
  const {user, crewId, crew} = st();
  if (!user || !getFb()) return;
  if (crewId && (!crew || crew.id !== crewId || !crewUnsubs.length)) subscribeCrew(crewId);
  else if (!crewId && crew) {
    unsubscribeCrew();
    st().patch({crew: null});
    localStorage.removeItem(LS_CREW_CACHE);
    usePlanner.getState().setFilter({crewOnly: false});
  }
}

export function unsubscribeCrew(){
  crewUnsubs.forEach(u => u());
  crewUnsubs = [];
  if (removedUnsub) { removedUnsub(); removedUnsub = null; }
}

export function subscribeCrew(id){
  unsubscribeCrew();
  const fb = getFb();
  if (!fb) return;
  const {F} = fb;
  const cached = load(LS_CREW_CACHE, null);
  st().patch({crew: cached && cached.id === id
    ? {...cached, picks: cached.picks || {}, invites: [], removed: [], live: false, invitesLive: false}
    : {id, name: '', createdBy: '', picks: {}, members: [], invites: [], removed: [], syncedAt: null, live: false, invitesLive: false}});
  const opts = {serverTimestamps: 'estimate'};
  // a snapshot that arrives after crewGone() or a re-subscribe belongs to a crew we no longer hold
  const alive = () => { const c = st().crew; return !!c && c.id === id; };

  crewUnsubs.push(F.onSnapshot(crewRef(id), s => {
    bump('snapshots');
    if (!s.exists() || !alive()) return;
    const d = s.data();
    if (d.deleted) { crewGone('The crew was closed.'); return; }
    // the plan rides on the crew document (CREW-SPEC section 4); a crew made before it existed has none
    patchCrew({name: d.name, createdBy: d.createdBy, picks: d.picks || {}});
    // block records are readable by the creator only, so that listener follows the ownership
    if (crewOwnedByMe() && !removedUnsub) {
      removedUnsub = F.onSnapshot(F.collection(fb.db, 'crews', id, 'removed'), r => {
        if (alive()) patchCrew({removed: r.docs.map(x => ({uid: x.id, name: x.data().name || ''}))});
      }, () => {});
    }
    if (!crewOwnedByMe() && removedUnsub) { removedUnsub(); removedUnsub = null; patchCrew({removed: []}); }
    saveCrewCache();
  }, crewError));

  crewUnsubs.push(F.onSnapshot(F.collection(fb.db, 'crews', id, 'members'), s => {
    bump('snapshots');
    if (!alive()) return;
    // updatedAt is what the card's per-member "synced 13:45" reads (CREW-SPEC section 7). It is a server
    // timestamp, so it is null in the snapshot that echoes a member's own pending write; serverTimestamps:
    // 'estimate' fills that in with the local clock rather than showing nothing.
    const ms = s.docs.map(x => {
      const d = x.data(opts);
      return {uid: x.id, name: d.name || '', joinedAt: d.joinedAt ? d.joinedAt.toMillis() : 0, updatedAt: d.updatedAt ? d.updatedAt.toMillis() : 0, picks: d.picks || {}, verdicts: d.verdicts || {}, notes: d.notes || {}};
    }).sort((a, b) => a.joinedAt - b.joinedAt);
    // removal, detected the first way (CREW-SPEC section 3): a server snapshot without your own document
    const {user} = st();
    if (!s.metadata.fromCache && !leaving && !inFlight(id) && user && !ms.some(m => m.uid === user.uid)) { crewGone('You are no longer in this crew.'); return; }
    patchCrew({members: ms, syncedAt: Date.now(), live: !s.metadata.fromCache});
    saveCrewCache();
  }, crewError));

  // invitesLive is what closeCrew waits for: until a server snapshot has listed the invites, the ones this
  // client knows about are whatever the cache held, and closing on that list would leave the rest behind.
  crewUnsubs.push(F.onSnapshot(F.collection(fb.db, 'crews', id, 'invites'), s => {
    bump('snapshots');
    if (alive()) patchCrew({invites: s.docs.map(x => ({token: x.id, ...x.data(opts)})), invitesLive: !s.metadata.fromCache});
  }, e => console.warn('crew invites', e)));
}

function crewError(e){
  if (!e || e.code !== 'permission-denied') { console.warn('crew', e); return; }
  const s = settling;
  // Our own membership is still on its way to the server: this is the refusal described above, not a
  // removal. Nobody who has just made or joined a crew should be told they are no longer in it.
  if (s && s.id === st().crewId) {
    if (relistening) return;
    relistening = true;
    s.done.then(ok => { relistening = false; if (ok && st().crewId === s.id) subscribeCrew(s.id); });
    return;
  }
  crewGone('You are no longer in this crew.');
}
export function onDenied(){ crewGone('You are no longer in this crew.'); }

// Removed, or the crew was closed: drop the overlay, clear the pointer, keep everything of your own.
// Idempotent — three detections race each other and only the first should speak.
export function crewGone(msg){
  const {crewId, crew} = st();
  if (!crewId && !crew) return;
  unsubscribeCrew();
  st().patch({crew: null, crewId: null});
  localStorage.removeItem(LS_CREW_CACHE);
  usePlanner.getState().setFilter({crewOnly: false});
  change({crew: DEL}, null);
  okBanner(`${msg} Your own picks and notes are untouched.`);
}

// ---------- create, rename, leave, close ----------
// createCrew and renameCrew return whether the card is done with the name it was given: false leaves the
// inline form open with the text still in it, so an empty field or a "try again in a moment" can be
// answered without retyping.
export function createCrew(name){
  const clean = String(name || '').trim().slice(0, 60);
  const fb = getFb();
  const {user, accountName} = st();
  if (!clean) return false;                                   // the placeholder is an example, not a name
  if (!fb || !user) { okBanner(NOT_READY); return false; }
  const {F} = fb;
  const id = F.doc(F.collection(fb.db, 'crews')).id;   // client-generated auto-id: the rules need it in one batch
  const b = F.writeBatch(fb.db);
  // the plan starts empty: what the crew does together is what its members add, not a copy of anyone's picks
  b.set(crewRef(id), {name: clean, createdBy: user.uid, deleted: false, picks: {}, createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp(), v: 1});
  b.set(memberRef(id, user.uid), {name: accountName, joinedAt: F.serverTimestamp(), ...projectForCrew(usePlanner.getState().local()), updatedAt: F.serverTimestamp(), v: 1});
  b.update(userRef(), {crew: id, updatedAt: F.serverTimestamp()});
  const commit = b.commit();
  commit.catch(authMessage);
  settle(id, commit);
  return true;
}

export function renameCrew(name){
  const {crew, user} = st();
  const clean = String(name || '').trim().slice(0, 60);
  if (!crew || !clean) return false;
  if (clean === crew.name) return true;                       // already called that: nothing to write, nothing to retype
  const fb = getFb();
  if (!user || !fb) { okBanner(NOT_READY); return false; }
  const {F} = fb;
  F.updateDoc(crewRef(crew.id), {name: clean, updatedAt: F.serverTimestamp()}).catch(authMessage);
  return true;
}

// The crew's plan (CREW-SPEC section 3, "The crew plan"): one field-level write on the crew document,
// `picks.<eventNo>` set to my uid or deleted, with the stamp the rules require. Any member may add or
// remove any entry. The crew-document listener echoes the local write at once (latency compensation), so
// the card, the chip and the sheet follow without any local state of their own; offline, the write waits
// in Firestore's queue and the echo still arrives. Before the SDK has loaded there is no queue to put it
// in, so it says so, like every other crew action. A refusal is reported and nothing more: the listeners
// are what detect a removal (CREW-SPEC section 3), and a write refused for any other reason — rules that
// have not caught up with this client, say — must not clear the pointer and throw the crew away.
export function toggleCrewPick(no){
  const {crew, user} = st();
  if (!crew || !byNo.has(no)) return false;
  const fb = getFb();
  if (!user || !fb) { okBanner(NOT_READY); return false; }
  const {F} = fb;
  const on = !(crew.picks && crew.picks[no]);
  F.updateDoc(crewRef(crew.id), {['picks.' + no]: on ? user.uid : F.deleteField(), updatedAt: F.serverTimestamp()}).catch(authMessage);
  return on;
}

export async function leaveCrew(silent){
  const {crew, user} = st();
  if (!crew) return false;
  if (!user || !getFb()) { okBanner(NOT_READY); return false; }
  if (crewOwnedByMe() && others().length) { okBanner('You created this crew: make someone else the owner, or close the crew, before leaving.'); return false; }
  if (crewOwnedByMe()) return closeCrew(silent);   // alone in the crew: leaving closes it
  if (!silent && !confirm(`Leave ${crew.name}? Your picks and notes stay in your account.`)) return false;
  const fb = getFb(); const {F} = fb; const id = crew.id;
  leaving = true; unsubscribeCrew();
  const b = F.writeBatch(fb.db);
  b.delete(memberRef(id, user.uid));
  b.update(userRef(), {crew: F.deleteField(), updatedAt: F.serverTimestamp()});
  try { await b.commit(); }
  catch (e) { leaving = false; authMessage(e); subscribeCrew(id); return false; }   // still a member: put the listeners back
  leaving = false;
  st().patch({crew: null, crewId: null});
  localStorage.removeItem(LS_CREW_CACHE);
  usePlanner.getState().setFilter({crewOnly: false});
  return true;
}

// Close: other documents in chunks of at most nine (two rule lookups each, twenty allowed per batch),
// then one batch that deletes the own member document, sets the tombstone and clears the pointer.
export async function closeCrew(silent){
  const {crew, user} = st();
  if (!crew || !user) return false;
  if (!navigator.onLine) { okBanner('Closing a crew needs a connection.'); return false; }
  // A crew painted from the cache carries no invites and no block records (hydrateCrewCache stores neither),
  // so closing on that list would tombstone the crew and leave those documents behind, readable by nobody
  // and deletable by nobody. Wait for a server snapshot of the members *and* of the invites: the invites
  // arrive on their own listener, and a members snapshot says nothing about how many invites are out.
  if (!ready() || !crew.invitesLive) { okBanner(NOT_READY); return false; }
  if (!silent && !confirm(`Close ${crew.name} for everyone? Members keep their own picks and notes.`)) return false;
  const fb = getFb(); const {F} = fb; const id = crew.id;
  const docs = [
    ...others().map(m => memberRef(id, m.uid)),
    ...crew.invites.map(i => F.doc(fb.db, 'crews', id, 'invites', i.token)),
    ...crew.removed.map(r => F.doc(fb.db, 'crews', id, 'removed', r.uid)),
  ];
  try {
    for (let i = 0; i < docs.length; i += 9) {
      const b = F.writeBatch(fb.db);
      docs.slice(i, i + 9).forEach(r => b.delete(r));
      await b.commit();
    }
    leaving = true; unsubscribeCrew();
    const b = F.writeBatch(fb.db);
    b.delete(memberRef(id, user.uid));
    b.update(crewRef(id), {deleted: true, updatedAt: F.serverTimestamp()});
    b.update(userRef(), {crew: F.deleteField(), updatedAt: F.serverTimestamp()});
    await b.commit();
    st().patch({crew: null, crewId: null});
    localStorage.removeItem(LS_CREW_CACHE);
    usePlanner.getState().setFilter({crewOnly: false});
    leaving = false;
    return true;
  } catch (e) { leaving = false; authMessage(e); return false; }
}

// ---------- the creator's powers ----------
export function removeMember(uid){
  const {crew} = st();
  const m = crew && crew.members.find(x => x.uid === uid);
  if (!m) return;
  if (!ready()) { okBanner(NOT_READY); return; }
  if (!confirm(`Remove ${m.name} from ${crew.name}? Their invite links stop working; you can re-admit them later.`)) return;
  const fb = getFb(); const {F} = fb;
  const b = F.writeBatch(fb.db);
  b.delete(memberRef(crew.id, uid));
  b.set(F.doc(fb.db, 'crews', crew.id, 'removed', uid), {name: m.name, removedAt: F.serverTimestamp(), v: 1});
  b.commit().catch(authMessage);
}

export function readmit(uid){
  const {crew} = st();
  if (!crew) return;
  const fb = getFb();
  if (!fb) { okBanner(NOT_READY); return; }
  const {F} = fb;
  F.deleteDoc(F.doc(fb.db, 'crews', crew.id, 'removed', uid)).catch(authMessage);
}

export function makeOwner(uid){
  const {crew} = st();
  const m = crew && crew.members.find(x => x.uid === uid);
  if (!m) return;
  if (!ready()) { okBanner(NOT_READY); return; }
  if (!confirm(`Make ${m.name} the owner of ${crew.name}? You stay a member.`)) return;
  const fb = getFb(); const {F} = fb;
  F.updateDoc(crewRef(crew.id), {createdBy: uid, updatedAt: F.serverTimestamp()}).catch(authMessage);
}

// ---------- invites ----------
const newToken = () => {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export async function createInvite(){
  const {crew, user, accountName} = st();
  if (!crew) return null;
  if (!navigator.onLine) { okBanner('Invite links need a connection.'); return null; }
  const fb = getFb();
  if (!user || !fb) { okBanner(NOT_READY); return null; }
  const {F} = fb; const token = newToken();
  try {
    await F.setDoc(F.doc(fb.db, 'crews', crew.id, 'invites', token), {
      crewName: crew.name, createdBy: user.uid, createdByName: accountName,
      createdAt: F.serverTimestamp(), expiresAt: F.Timestamp.fromMillis(Date.now() + 14 * 864e5), revoked: false, v: 1,
    });
    shareLink(inviteLink(token));
    return token;
  } catch (e) { authMessage(e); return null; }
}

export function revokeInvite(token){
  const {crew} = st();
  if (!crew) return;
  const fb = getFb();
  if (!fb) { okBanner(NOT_READY); return; }
  const {F} = fb;
  F.updateDoc(F.doc(fb.db, 'crews', crew.id, 'invites', token), {revoked: true}).catch(authMessage);   // the rules allow this field only
}

export function shareLink(url){
  const {crew} = st();
  const name = crew ? crew.name : 'my crew';
  const banner = () => showBanner({
    text: 'Invite link — anyone with it can join until you revoke it:',
    input: url,
    actions: [
      {label: 'Copy', primary: true, onClick: () => { try { navigator.clipboard.writeText(url).catch(() => {}); } catch (e) {} }},
      {label: 'Close', onClick: hideBanner},
    ],
  });
  // The invite is already written by the time we get here, so a share sheet that fails or is dismissed —
  // iOS rejects with NotAllowedError when the gesture has expired, which the await before this makes
  // likely — must not leave the link nowhere. Fall through to the copy banner, which is also the whole
  // non-phone path.
  if (navigator.share && PHONE) { navigator.share({title: `Join ${name}`, text: `Join my crew “${name}” in the HowTheLightGetsIn planner:`, url}).catch(() => banner()); return; }
  banner();
}

// ---------- joining ----------
// The pending invite survives the redirect sign-in round trip and a reload while creating an account, for an hour.
export function pendingJoin(){
  try {
    const j = JSON.parse(sessionStorage.getItem(SS_JOIN) || 'null');
    return j && j.crew && j.token && Date.now() - j.at < 36e5 ? j : null;
  } catch (e) { return null; }
}
export function clearJoin(){ sessionStorage.removeItem(SS_JOIN); }

export function afterSubscribe(){ offerJoin(); }

export async function offerJoin(){
  const j = pendingJoin();
  if (!j || !CLOUD) return;
  const {user, crewId, crew} = st();
  if (!user) {
    showBanner({text: 'You’ve been invited to a crew. Sign in or create an account to join.', actions: [
      {label: 'Sign in', primary: true, onClick: () => { hideBanner(); useSheet.getState().open('hub'); }},
      {label: 'Not now', onClick: () => { clearJoin(); hideBanner(); }},
    ]});
    return;
  }
  if (crewId === j.crew) { clearJoin(); okBanner(`You’re already in ${crew ? crew.name : 'this crew'}.`); return; }
  let inv = null;
  try { const fb = getFb(); const s = await fb.F.getDoc(fb.F.doc(fb.db, 'crews', j.crew, 'invites', j.token)); inv = s.exists() ? s.data() : null; }
  catch (e) { inv = null; }
  if (!validInvite(inv)) { clearJoin(); okBanner('This invite link no longer works; ask for a new one.'); return; }
  const lead = crewId ? `Leave ${crew ? crew.name : 'your crew'} and join ` : 'Join ';
  const ios = IOS && !STANDALONE ? ' On iPhone, join here in Safari; the installed app picks it up when you sign in there.' : '';
  showBanner({text: `${lead}${inv.crewName}? Invited by ${inv.createdByName}.${ios}`, actions: [
    {label: 'Join', primary: true, onClick: () => { hideBanner(); acceptJoin(); }},
    {label: 'Not now', onClick: () => { clearJoin(); hideBanner(); }},
  ]});
}

// One join at a time. The banner goes as Join is tapped, but the tap can land twice before React has
// taken it off the screen, and a second run would write its own member document: a set() carrying a
// fresh joinedAt, which the rules refuse as an update to a member who already exists. That rejected
// commit would take the live one's place in `settling`, and crewError would read it as a join that
// failed and never listen to the crew again. Released however the join ends, so a later invite joins.
export async function acceptJoin(){
  if (joining) return;
  joining = true;
  try { await join(); } finally { joining = false; }
}

async function join(){
  const j = pendingJoin();
  if (!j || !st().user) return;
  if (!navigator.onLine) { okBanner('Joining needs a connection.'); return; }
  const fb = getFb();
  if (!fb) { okBanner(NOT_READY); return; }
  const {F} = fb;
  // Leave-then-join is two batches, so the invite is re-read here and not only when the banner was built:
  // a token revoked in between would otherwise leave someone in no crew at all.
  let inv = null;
  try { const s = await F.getDoc(F.doc(fb.db, 'crews', j.crew, 'invites', j.token)); inv = s.exists() ? s.data() : null; }
  catch (e) { inv = null; }
  if (!validInvite(inv)) { clearJoin(); okBanner('This invite link no longer works; ask for a new one.'); return; }
  // The store is read after that round trip, not before it: a removal landing while the invite was being
  // fetched clears the pointer, and leaving a crew we are no longer in fails and would abort the join. The
  // name is read late for the same reason — the member document should carry whatever it is now.
  const {user, accountName, crewId} = st();
  if (!user) return;
  if (crewId) { const left = await leaveCrew(true); if (!left) return; }
  const mref = memberRef(j.crew, user.uid);
  const b = F.writeBatch(fb.db);
  b.set(mref, {name: accountName, joinedAt: F.serverTimestamp(), ...projectForCrew(usePlanner.getState().local()), invite: j.token, updatedAt: F.serverTimestamp(), v: 1});
  b.update(userRef(), {crew: j.crew, updatedAt: F.serverTimestamp()});
  try {
    const commit = b.commit();
    settle(j.crew, commit);
    await commit;
    clearJoin();
    hideBanner();
    F.updateDoc(mref, {invite: F.deleteField(), updatedAt: F.serverTimestamp()}).catch(() => {});   // the token need not stay readable by the crew
  } catch (e) {
    // Only the rules can say the invite is spent (revoked between the read and the write, a block record,
    // a crew closed in between): that verdict will not change, so the pending join goes with it. Any other
    // failure — the connection dropped mid-batch, a server error — leaves the invite where it is, because
    // the same tap will work later. Someone who left a crew to join this one is now in no crew, which is
    // what the account says and what the card shows; the offer comes back on the next load.
    if (e && e.code === 'permission-denied') { clearJoin(); okBanner('This invite link no longer works; ask for a new one.'); }
    else okBanner('Couldn’t join right now; try again when you’re online.');
  }
}
