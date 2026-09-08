// src/cloud/auth.js — Firebase Authentication: the lazy SDK loader, the auth-state bridge into the cloud
// store, the sign-in methods, the message table, and the account chores (change name, sign out, sign out
// and clear this device, delete account). Ported function for function from the account section of the
// old single-file page; the old globals become store reads and writes and the innerHTML banners
// become banner-store entries. No React here; firebase/* is only ever reached through the dynamic
// import('./firebase.js') below, which is what keeps the SDK in its own chunk.
import {FIREBASE, CLOUD} from '../data/index.js';
import {nameFromEmail} from '../core/labels.js';
import {useCloud} from '../store/cloud.js';
import {usePlanner} from '../store/planner.js';
import {okBanner} from '../store/banner.js';
import {PHONE, STANDALONE} from './platform.js';
import * as sync from './sync.js';
import * as crew from './crew.js';

export const SS_REDIRECT = 'htlgi-l26-redirect';

let fb = null, fbLoading = null;   // {app, auth, db, A, F} once the SDK is loaded
let deleting = false;              // the account is being deleted here: a missing document is expected

export const getFb = () => fb;
export const isDeleting = () => deleting;

// auto=true is the boot path: a device that already has an account should not be shouted at when the SDK
// cannot be fetched — it is offline, and the planner works from localStorage. A manual attempt (someone
// pressed a sign-in button) gets the technical reason. `reported` makes one failure show one banner:
// callers pass the same error to authMessage(), which then stays quiet.
export function loadFirebase(auto){
  if (!CLOUD) return Promise.reject(new Error('cloud features are off'));
  if (fbLoading) return fbLoading;
  fbLoading = import('./firebase.js').then(m => m.init(FIREBASE)).then(inst => {
    fb = inst;
    const {A, auth} = inst;
    A.onAuthStateChanged(auth, onAuth);
    if (sessionStorage.getItem(SS_REDIRECT)) { sessionStorage.removeItem(SS_REDIRECT); A.getRedirectResult(auth).catch(e => authMessage(e)); }
    return inst;
  }).catch(e => {
    fbLoading = null;
    if (!auto) okBanner(`Sign-in is unavailable right now (${e.message}). Your picks stay on this device.`);
    else if (!navigator.onLine) okBanner('You’re offline — your picks are saved on this device and will sync when you are back online.');
    else console.warn('firebase', e);
    e.reported = true;
    throw e;
  });
  return fbLoading;
}

// The boot rule (CREW-SPEC section 6, "Loading"): the SDK is fetched only when this device has an
// account, a redirect sign-in is coming back, or an invite is waiting. Everybody else downloads nothing.
export function bootCloud(){
  if (!CLOUD) return;
  const marker = sync.accountMarker();
  useCloud.getState().patch({marker});
  if (marker || sessionStorage.getItem(SS_REDIRECT) || crew.pendingJoin()) loadFirebase(true).catch(() => {});
}

export function onAuth(u){
  if (u) {
    const {accountName} = useCloud.getState();
    useCloud.getState().patch({user: u, accountName: (u.displayName || accountName || nameFromEmail(u.email) || 'Me').slice(0, 40)});
    sync.afterSignIn(u).catch(e => authMessage(e));
  } else {
    sync.unsubscribeUser();
    useCloud.getState().patch({user: null, accountName: ''});
  }
}

export async function signInGoogle(){
  try {
    const {A, auth} = await loadFirebase();
    const provider = new A.GoogleAuthProvider();
    // the auth domain is the site itself, so a redirect comes back here; popups are unreliable on
    // phones and in the installed app
    if (PHONE || STANDALONE) { sessionStorage.setItem(SS_REDIRECT, '1'); await A.signInWithRedirect(auth, provider); }
    else await A.signInWithPopup(auth, provider);
  } catch (e) { authMessage(e); }
}

// kind: 'signin' | 'create' | 'reset' | 'link'. Answers {text, newHere}: `text` is the line to show under
// the form ('' when there is nothing to say and the auth state change speaks for itself), and `newHere`
// asks the card to offer registration — the name field and a "Create account" button.
//
// `newHere` exists because this project has email enumeration protection switched on, and Firebase then
// returns auth/invalid-credential both for an account that does not exist and for the wrong password
// (fetchSignInMethodsForEmail answers [] as well). Nothing here can tell those apart, so the form asks
// rather than guessing. Guessing by trying to create the account behind the scenes would turn one typo in
// the email into a second, empty account instead of "wrong password", which is a worse answer than a
// question. create is the one call that still distinguishes them, with auth/email-already-in-use.
const said = (text, newHere) => (newHere === undefined ? {text} : {text, newHere});

export async function emailAction(kind, {email = '', password = '', name = ''} = {}){
  const mail = String(email || '').trim();
  const who = String(name || '').trim().slice(0, 40);
  try {
    const {A, auth} = await loadFirebase();
    if (kind === 'reset') {
      if (!mail) return said('Enter your email first.');
      await A.sendPasswordResetEmail(auth, mail);
      return said('Password reset email sent. Check your inbox.');
    }
    if (!mail || password.length < 8) return said('Enter your email and a password of 8 or more characters.');
    if (kind === 'signin') { await A.signInWithEmailAndPassword(auth, mail, password); return said(''); }
    if (kind === 'create') {
      // The name is the point of this step: a crew that cannot tell its members apart is no use, and the
      // account is the only moment anyone is asked. Refused before the account exists, not after.
      if (!who) return said('Add your name, so your crew knows who you are.', true);
      // the typed name is in place before onAuth fires, so the first document written carries it
      useCloud.getState().patch({accountName: who});
      const cred = await A.createUserWithEmailAndPassword(auth, mail, password);
      await A.updateProfile(cred.user, {displayName: who});
      return said('');
    }
    if (kind === 'link') {
      await A.linkWithCredential(auth.currentUser, A.EmailAuthProvider.credential(mail, password));
      okBanner('Password added: you can now sign in with email and password too.');
      return said('');
    }
    return said('');
  } catch (e) {
    const code = (e && e.code) || '';
    if (kind === 'link' && code === 'auth/email-already-in-use') return said('That email already belongs to another account.');
    // The sign-in failed in the one way that might mean there is no account yet: offer to make one.
    if (kind === 'signin' && (code === 'auth/invalid-credential' || code === 'auth/user-not-found')) {
      return said('Wrong email or password. If you are new here, add your name and we will create your account.', true);
    }
    // ...and this is the answer that proves there is one, so the form goes back to signing in.
    if (kind === 'create' && code === 'auth/email-already-in-use') {
      // the name typed for an account we are not making must not linger as this device's account name
      useCloud.getState().patch({accountName: ''});
      return said('That email already has an account. Check your password, or sign in with Google if that is how you made it.', false);
    }
    if (kind === 'create') { useCloud.getState().patch({accountName: ''}); return said(authText(e), true); }
    return said(authText(e));
  }
}

export function authText(e){
  const c = (e && e.code) || '';
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found') return 'Wrong email or password.';
  if (c === 'auth/email-already-in-use') return 'That email already has an account. Sign in with Google, then add a password from the Account card.';
  if (c === 'auth/weak-password') return 'Use a longer password (8 or more characters).';
  if (c === 'auth/popup-blocked') return 'The sign-in window was blocked. Allow pop-ups for this site, or use email and password.';
  if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return 'Sign-in was cancelled.';
  if (c === 'auth/network-request-failed') return 'No connection. Try again when you are online.';
  if (c === 'auth/requires-recent-login') return (e.message && /Sign out/.test(e.message)) ? e.message : 'Please sign in again first.';
  if (c === 'auth/invalid-email') return 'That does not look like an email address.';
  return (e && e.message) || 'Something went wrong.';
}

export function authMessage(e){ if (e && e.reported) return; okBanner(authText(e)); }

// Local data stays by default. "Sign out and clear this device" is for a borrowed phone: every htlgi-l26-*
// key, the session storage, and the Firestore offline cache. The reload is not cosmetic — the stores hold
// filters and a sheet stack that would otherwise survive the wipe.
export async function signOutUser(clearDevice){
  sync.unsubscribeUser();
  crew.unsubscribeCrew();
  sync.setMarker(null);   // the session marker goes; htlgi-l26-last-uid stays, so another account signing in here replaces this state instead of merging it
  localStorage.removeItem(sync.LS_QUEUE);
  useCloud.getState().patch({syncStopped: false, syncPending: false});
  try { await fb.A.signOut(fb.auth); } catch (e) {}
  if (clearDevice) {
    usePlanner.getState().clearLocal();
    Object.keys(localStorage).filter(k => k.startsWith('htlgi-l26-')).forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();
    try { await fb.F.terminate(fb.db); await fb.F.clearIndexedDbPersistence(fb.db); }
    catch (e) { alert('Your picks and notes were removed from this device, but the offline cache could not be cleared because another planner tab is open. Close the other tabs and use “Sign out and clear this device” once more.'); }
    location.reload();
    return;
  }
  useCloud.getState().patch({crewId: null, crew: null});
  crew.onPointer();
}

// The name is copied into the crew's member document, so both are written in one batch.
export async function changeName(name){
  const next = String(name || '').trim().slice(0, 40);
  const {accountName, user} = useCloud.getState();
  if (!next || next === accountName) return;
  useCloud.getState().patch({accountName: next});
  try { await fb.A.updateProfile(user, {displayName: next}); } catch (e) {}
  sync.change({name: next}, {name: next});
}

export async function reauth(){
  const {A} = fb;
  const {user} = useCloud.getState();
  if (user.providerData.some(p => p.providerId === 'google.com')) {
    // a Google re-auth needs a popup, which phones and the installed app do not give us reliably
    if (PHONE || STANDALONE) throw Object.assign(new Error('Sign out, sign in again with Google, and then delete the account.'), {code: 'auth/requires-recent-login', reported: false});
    await A.reauthenticateWithPopup(user, new A.GoogleAuthProvider());
    return;
  }
  // The one window.prompt() left in the app (the Crew and Account cards use the inline NamePrompt form).
  // It stays: this is the cloud layer, which has no React and must not grow any, and the alternative is a
  // real modal — a password field the rest of the page cannot be typed into while Firebase waits for the
  // credential. Worth building if the delete flow ever grows; not worth a component tree for two lines.
  const pw = prompt('Confirm your password to continue');
  if (!pw) throw new Error('Cancelled.');
  await A.reauthenticateWithCredential(user, A.EmailAuthProvider.credential(user.email, pw));
}

const OWNS_CREW = 'You created your crew: hand it over or close it before deleting your account.';

export async function deleteAccount(){
  let {crewId, user} = useCloud.getState();
  if (crewId && crew.crewOwnedByMe()) { okBanner(OWNS_CREW); return; }
  if (!confirm('Delete your account and everything stored in it? Picks and notes stay on this device only.')) return;
  if (!confirm('This cannot be undone. Delete the account?')) return;
  const signedInAt = user.metadata && user.metadata.lastSignInTime ? Date.parse(user.metadata.lastSignInTime) : 0;
  if (Date.now() - signedInAt > 4 * 60e3) {   // Firebase demands a recent sign-in for deletion: do it before touching any data
    try { await reauth(); } catch (e) { authMessage(e); return; }
  }
  // Two confirmations, and possibly a popup or a password prompt, have stood open: a snapshot or a sign-out
  // may have moved the pointer or the session underneath us. Delete what is in the store now, not what was.
  const state = useCloud.getState();
  ({crewId, user} = state);
  if (!user) return;
  // The same snapshot may have handed the crew *to* us. The refusal is re-run rather than assumed, whether
  // or not a re-auth happened, or the owner's member document would go without the tombstone and leave the
  // crew unclosable by anyone.
  if (crewId && crew.crewOwnedByMe()) { okBanner(OWNS_CREW); return; }
  // crewOwnedByMe() reads createdBy off the crew document, so before that document has landed — a cold or
  // offline start painting the cache, or the second between the pointer and the first snapshot — its "no"
  // means "not known yet", and deleting on it risks exactly the unclosable crew above. Say so instead.
  if (crewId && (!state.crew || !state.crew.live || !state.crew.createdBy)) { okBanner(crew.NOT_READY); return; }
  const {A, F} = fb;
  if (deleting) return;
  deleting = true;
  sync.unsubscribeUser();
  crew.unsubscribeCrew();
  let dataGone = false;
  try {
    const b = F.writeBatch(fb.db);
    if (crewId) b.delete(F.doc(fb.db, 'crews', crewId, 'members', user.uid));
    b.delete(sync.userRef());
    await b.commit();
    dataGone = true;
    localStorage.removeItem(sync.LS_QUEUE);
    sync.setMarker(null);   // the data is gone: never sync this device to it again
    useCloud.getState().patch({crewId: null, crew: null});
    crew.onPointer();
    try { await A.deleteUser(user); }
    catch (e) { if (e.code !== 'auth/requires-recent-login') throw e; await reauth(); await A.deleteUser(user); }
    okBanner('Account deleted. This device keeps its local copy of your picks and notes.');
  } catch (e) {
    if (dataGone) okBanner(`Your data was deleted, but the sign-in itself could not be removed (${authText(e)}). Sign in again and use “Delete account” once more to finish.`);
    else authMessage(e);
  }
  deleting = false;
}
