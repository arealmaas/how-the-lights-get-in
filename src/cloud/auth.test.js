// Same fake-SDK approach as sync.test.js: cloud/firebase.js is mocked, so nothing here touches the real
// Firebase modules. cloud/platform.js is mocked as a mutable object because the sign-in method and the
// re-auth rules differ on phones and in the installed app, and both branches need covering.
import {test, expect, beforeEach, afterEach, vi} from 'vitest';

const H = vi.hoisted(() => {
  const batch = {update: vi.fn(), set: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => {})};
  const F = {
    doc: (db, ...p) => p.join('/'),
    getDocFromServer: vi.fn(async () => ({exists: () => false})),
    setDoc: vi.fn(async () => {}),
    onSnapshot: vi.fn(() => () => {}),
    writeBatch: () => batch,
    serverTimestamp: () => 'TS',
    deleteField: () => 'DELETE_FIELD',
    terminate: vi.fn(async () => {}),
    clearIndexedDbPersistence: vi.fn(async () => {}),
  };
  const A = {
    onAuthStateChanged: vi.fn(), getRedirectResult: vi.fn(async () => null), signOut: vi.fn(async () => {}),
    updateProfile: vi.fn(async () => {}), deleteUser: vi.fn(async () => {}),
    signInWithPopup: vi.fn(async () => {}), signInWithRedirect: vi.fn(async () => {}),
    signInWithEmailAndPassword: vi.fn(async () => {}), createUserWithEmailAndPassword: vi.fn(async () => ({user: {uid: 'u1'}})),
    sendPasswordResetEmail: vi.fn(async () => {}), linkWithCredential: vi.fn(async () => {}),
    reauthenticateWithPopup: vi.fn(async () => {}), reauthenticateWithCredential: vi.fn(async () => {}),
    GoogleAuthProvider: class GoogleAuthProvider {},
    EmailAuthProvider: {credential: (email, password) => ({email, password})},
  };
  const state = {fail: false};
  const fake = {app: {}, auth: {currentUser: {uid: 'u1'}}, db: {}, A, F};
  const init = vi.fn(async () => { if (state.fail) throw new Error('boom'); return fake; });
  return {batch, F, A, fake, init, state, platform: {STANDALONE: false, IOS: false, PHONE: false}};
});

vi.mock('./firebase.js', () => ({init: H.init}));
vi.mock('./platform.js', () => H.platform);
vi.mock('./crew.js', () => ({
  onPointer: vi.fn(), crewOwnedByMe: vi.fn(() => false), unsubscribeCrew: vi.fn(),
  offerJoin: vi.fn(), afterSubscribe: vi.fn(), onDenied: vi.fn(), pendingJoin: vi.fn(() => null),
  NOT_READY: 'Still connecting; try again in a moment.',
}));
vi.mock('../data/index.js', async orig => ({...await orig(), CLOUD: true, FIREBASE: {apiKey: 'test'}}));

const LS_ACCOUNT = 'htlgi-l26-account', SS_REDIRECT = 'htlgi-l26-redirect';
const password = (extra = {}) => ({uid: 'u1', displayName: 'Are', email: 'are@example.com', providerData: [{providerId: 'password'}], metadata: {lastSignInTime: new Date().toUTCString()}, ...extra});
const stale = new Date(Date.now() - 10 * 60e3).toUTCString();

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  H.state.fail = false;
  Object.assign(H.platform, {STANDALONE: false, IOS: false, PHONE: false});
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('prompt', vi.fn(() => 'a password'));
});
afterEach(() => { vi.unstubAllGlobals(); });

async function setup({loadFb = true, user = null} = {}){
  const {useCloud} = await import('../store/cloud.js');
  const {useBanner} = await import('../store/banner.js');
  const auth = await import('./auth.js');
  const sync = await import('./sync.js');
  const crew = await import('./crew.js');
  if (loadFb) await auth.loadFirebase();
  if (user) useCloud.getState().patch({user, accountName: user.displayName || ''});
  return {useCloud, useBanner, auth, sync, crew};
}

test('authText turns Firebase codes into sentences a festival-goer can act on', async () => {
  const {auth} = await setup({loadFb: false});
  expect(auth.authText({code: 'auth/invalid-credential'})).toMatch(/Wrong email or password/);
  expect(auth.authText({code: 'auth/user-not-found'})).toMatch(/Wrong email or password/);
  expect(auth.authText({code: 'auth/email-already-in-use'})).toMatch(/Sign in with Google, then add a password/);
  expect(auth.authText({code: 'auth/weak-password'})).toBe('Use a longer password (8 or more characters).');
  expect(auth.authText({code: 'auth/popup-blocked'})).toMatch(/pop-ups/);
  expect(auth.authText({code: 'auth/popup-closed-by-user'})).toBe('Sign-in was cancelled.');
  expect(auth.authText({code: 'auth/network-request-failed'})).toBe('No connection. Try again when you are online.');
  expect(auth.authText({code: 'auth/requires-recent-login'})).toBe('Please sign in again first.');
  expect(auth.authText({code: 'auth/requires-recent-login', message: 'Sign out, sign in again with Google, and then delete the account.'})).toMatch(/^Sign out/);
  expect(auth.authText({code: 'auth/invalid-email'})).toBe('That does not look like an email address.');
  expect(auth.authText(new Error('something odd'))).toBe('something odd');
  expect(auth.authText(null)).toBe('Something went wrong.');
});

test('signInGoogle uses a popup on desktop and a redirect (with the flag) on a phone', async () => {
  const {auth} = await setup();
  await auth.signInGoogle();
  expect(H.A.signInWithPopup).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(SS_REDIRECT)).toBeNull();

  H.platform.PHONE = true;
  await auth.signInGoogle();
  expect(H.A.signInWithRedirect).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(SS_REDIRECT)).toBe('1');
});

test('a returning redirect is consumed once, and the flag is cleared before the result is read', async () => {
  sessionStorage.setItem(SS_REDIRECT, '1');
  await setup();
  expect(H.A.getRedirectResult).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(SS_REDIRECT)).toBeNull();
});

test('a failing SDK load is quiet on boot, explains itself when asked for, and says "offline" when it is', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  H.state.fail = true;
  const {useBanner, auth} = await setup({loadFb: false});

  await auth.loadFirebase(true).catch(e => expect(e.reported).toBe(true));
  expect(useBanner.getState().banner).toBeNull();
  expect(warn).toHaveBeenCalled();

  await auth.loadFirebase(false).catch(() => {});
  expect(useBanner.getState().banner.text).toContain('Sign-in is unavailable right now (boom)');

  useBanner.getState().hide();
  const online = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
  Object.defineProperty(navigator, 'onLine', {configurable: true, get: () => false});
  await auth.loadFirebase(true).catch(() => {});
  expect(useBanner.getState().banner.text).toContain('You’re offline');
  delete navigator.onLine;
  if (online) Object.defineProperty(Navigator.prototype, 'onLine', online);
  warn.mockRestore();
});

test('bootCloud loads the SDK only when this device has an account, and mirrors the marker into the store', async () => {
  const bare = await setup({loadFb: false});
  bare.auth.bootCloud();
  expect(H.init).not.toHaveBeenCalled();
  expect(bare.useCloud.getState().marker).toBeNull();

  vi.resetModules();
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  const withAccount = await setup({loadFb: false});
  withAccount.auth.bootCloud();
  expect(withAccount.useCloud.getState().marker).toEqual({uid: 'u1'});
  await vi.waitFor(() => expect(H.init).toHaveBeenCalledTimes(1));   // the SDK arrives through a dynamic import
});

test('emailAction reports what the form should say, and creates an account with the typed name', async () => {
  const {useCloud, auth} = await setup();
  expect(await auth.emailAction('reset', {email: ' '})).toBe('Enter your email first.');
  expect(await auth.emailAction('reset', {email: 'are@example.com'})).toBe('Password reset email sent. Check your inbox.');
  expect(await auth.emailAction('signin', {email: 'are@example.com', password: 'short'})).toBe('Enter your email and a password of 8 or more characters.');
  expect(await auth.emailAction('signin', {email: 'are@example.com', password: 'long enough'})).toBe('');
  expect(H.A.signInWithEmailAndPassword).toHaveBeenCalledWith(H.fake.auth, 'are@example.com', 'long enough');

  expect(await auth.emailAction('create', {email: 'are@example.com', password: 'long enough', name: 'Are'})).toBe('');
  expect(useCloud.getState().accountName).toBe('Are');
  expect(H.A.updateProfile).toHaveBeenCalledWith({uid: 'u1'}, {displayName: 'Are'});

  H.A.signInWithEmailAndPassword.mockRejectedValueOnce({code: 'auth/invalid-credential'});
  expect(await auth.emailAction('signin', {email: 'are@example.com', password: 'long enough'})).toMatch(/Wrong email or password/);
  H.A.linkWithCredential.mockRejectedValueOnce({code: 'auth/email-already-in-use'});
  expect(await auth.emailAction('link', {email: 'other@example.com', password: 'long enough'})).toBe('That email already belongs to another account.');
});

test('onAuth puts the account in the store on the way in and empties it on the way out', async () => {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  const {useCloud, auth} = await setup();

  auth.onAuth(password());
  expect(useCloud.getState().user.uid).toBe('u1');
  expect(useCloud.getState().accountName).toBe('Are');

  auth.onAuth(null);
  expect(useCloud.getState().user).toBeNull();
  expect(useCloud.getState().accountName).toBe('');
});

test('changeName writes the name to the profile and to both documents', async () => {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  const user = password();
  const {useCloud, auth} = await setup({user});

  await auth.changeName('  A new name  ');
  expect(useCloud.getState().accountName).toBe('A new name');
  expect(H.A.updateProfile).toHaveBeenCalledWith(user, {displayName: 'A new name'});
  expect(H.batch.update).toHaveBeenCalledWith('users/u1', {name: 'A new name', updatedAt: 'TS'});

  H.batch.update.mockClear();
  await auth.changeName('   ');
  await auth.changeName('A new name');
  expect(H.batch.update).not.toHaveBeenCalled();
});

test('a plain sign out drops the marker and the queue but leaves the picks alone', async () => {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  localStorage.setItem('htlgi-l26-queue', '[]');
  localStorage.setItem('htlgi-l26-picks', '[3]');
  const {useCloud, auth} = await setup({user: password()});
  useCloud.getState().patch({syncStopped: true});

  await auth.signOutUser(false);

  expect(H.A.signOut).toHaveBeenCalled();
  expect(localStorage.getItem(LS_ACCOUNT)).toBeNull();
  expect(localStorage.getItem('htlgi-l26-queue')).toBeNull();
  expect(localStorage.getItem('htlgi-l26-picks')).toBe('[3]');
  expect(useCloud.getState().syncStopped).toBe(false);
  expect(useCloud.getState().crewId).toBeNull();
});

// "Sign out and clear this device" is for a borrowed phone: everything of ours goes, including the
// Firestore offline cache, and the page reloads because the stores still hold filters and a sheet stack.
test('sign out and clear this device wipes the keys, the caches and reloads', async () => {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  localStorage.setItem('htlgi-l26-picks', '[3]');
  localStorage.setItem('htlgi-l26-crew-cache', '{"id":"c1"}');
  localStorage.setItem('somebody-elses-key', 'kept');
  sessionStorage.setItem('htlgi-l26-join', '{}');
  const reload = vi.fn();
  vi.stubGlobal('location', {reload, pathname: '/', search: '', hash: '', href: 'http://localhost/'});
  const {auth} = await setup({user: password()});
  const {usePlanner} = await import('../store/planner.js');
  usePlanner.setState({picks: new Set([3]), verdicts: {}, notes: {}, shared: {}});
  const cleared = vi.spyOn(usePlanner.getState(), 'clearLocal');

  await auth.signOutUser(true);

  expect(cleared).toHaveBeenCalled();
  expect(localStorage.getItem('htlgi-l26-picks')).toBeNull();
  expect(localStorage.getItem('htlgi-l26-crew-cache')).toBeNull();
  expect(localStorage.getItem(LS_ACCOUNT)).toBeNull();
  expect(localStorage.getItem('somebody-elses-key')).toBe('kept');
  expect(sessionStorage.getItem('htlgi-l26-join')).toBeNull();
  expect(H.F.terminate).toHaveBeenCalledWith(H.fake.db);
  expect(H.F.clearIndexedDbPersistence).toHaveBeenCalledWith(H.fake.db);
  expect(reload).toHaveBeenCalledTimes(1);
});

test('deleteAccount refuses while you still own a crew', async () => {
  const {useCloud, useBanner, auth, crew} = await setup({user: password()});
  useCloud.getState().patch({crewId: 'c1'});
  crew.crewOwnedByMe.mockReturnValue(true);

  await auth.deleteAccount();

  expect(useBanner.getState().banner.text).toMatch(/hand it over or close it/);
  expect(confirm).not.toHaveBeenCalled();
  expect(H.batch.delete).not.toHaveBeenCalled();
});

test('deleteAccount re-authenticates first when the last sign-in is older than four minutes', async () => {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  const user = password({metadata: {lastSignInTime: stale}});
  const {useBanner, auth} = await setup({user});

  await auth.deleteAccount();

  expect(prompt).toHaveBeenCalled();
  expect(H.A.reauthenticateWithCredential).toHaveBeenCalledWith(user, {email: 'are@example.com', password: 'a password'});
  expect(H.batch.delete).toHaveBeenCalledWith('users/u1');
  expect(H.A.deleteUser).toHaveBeenCalledWith(user);
  expect(localStorage.getItem(LS_ACCOUNT)).toBeNull();
  expect(useBanner.getState().banner.text).toMatch(/^Account deleted/);
});

// A re-auth is a popup or a prompt and can stand open for a while. If the crew is handed to you in that
// time, deleting now would take the owner's member document out without setting the tombstone, and the
// crew could never be closed by anyone. The refusal is re-run rather than assumed to still hold.
test('deleteAccount refuses again when the crew is handed over during the re-authentication', async () => {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  const {useCloud, useBanner, auth, crew} = await setup({user: password({metadata: {lastSignInTime: stale}})});
  useCloud.getState().patch({crewId: 'c1'});
  crew.crewOwnedByMe.mockReturnValue(false);                                                                          // a member when the button is pressed
  H.A.reauthenticateWithCredential.mockImplementationOnce(async () => { crew.crewOwnedByMe.mockReturnValue(true); });  // handed over while the prompt is open

  await auth.deleteAccount();

  expect(H.A.reauthenticateWithCredential).toHaveBeenCalled();
  expect(useBanner.getState().banner.text).toMatch(/hand it over or close it/);
  expect(H.batch.delete).not.toHaveBeenCalled();
  expect(H.A.deleteUser).not.toHaveBeenCalled();
  expect(localStorage.getItem(LS_ACCOUNT)).not.toBeNull();
});

// The crew can be handed over while the two confirmations stand open, with no re-authentication anywhere
// near: the refusal runs immediately before the batch, not only on the re-auth path.
test('deleteAccount refuses when the crew is handed over during the confirmations', async () => {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  const {useCloud, useBanner, auth, crew} = await setup({user: password()});   // signed in a moment ago: no re-auth
  useCloud.getState().patch({crewId: 'c1', crew: {id: 'c1', createdBy: 'u9', live: true}});
  confirm.mockImplementationOnce(() => true).mockImplementationOnce(() => {
    crew.crewOwnedByMe.mockReturnValue(true);
    useCloud.getState().patch({crew: {id: 'c1', createdBy: 'u1', live: true}});
    return true;
  });

  await auth.deleteAccount();

  expect(H.A.reauthenticateWithCredential).not.toHaveBeenCalled();
  expect(useBanner.getState().banner.text).toMatch(/hand it over or close it/);
  expect(H.batch.delete).not.toHaveBeenCalled();
  expect(H.A.deleteUser).not.toHaveBeenCalled();
  expect(localStorage.getItem(LS_ACCOUNT)).not.toBeNull();
});

// crewOwnedByMe() reads createdBy off the crew document. Before that document has landed its "no" means
// "not known yet", and deleting on it could take the owner's member document out without the tombstone.
test('deleteAccount waits for the crew document rather than guessing at the ownership', async () => {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  const {useCloud, useBanner, auth, crew} = await setup({user: password()});
  crew.crewOwnedByMe.mockReturnValue(false);   // a member, as far as anything can tell

  for (const crewState of [null, {id: 'c1', createdBy: 'u9', live: false}, {id: 'c1', createdBy: '', live: true}]) {
    useCloud.getState().patch({crewId: 'c1', crew: crewState});
    await auth.deleteAccount();
    expect(useBanner.getState().banner.text).toBe('Still connecting; try again in a moment.');
    expect(H.batch.delete).not.toHaveBeenCalled();
    expect(H.A.deleteUser).not.toHaveBeenCalled();
    expect(localStorage.getItem(LS_ACCOUNT)).not.toBeNull();
  }

  useCloud.getState().patch({crew: {id: 'c1', createdBy: 'u9', live: true}});   // a member of a crew we can see
  await auth.deleteAccount();
  expect(H.batch.delete).toHaveBeenCalledWith('crews/c1/members/u1');
  expect(H.batch.delete).toHaveBeenCalledWith('users/u1');
});

test('deleteAccount on a phone tells a Google user to sign in again, and deletes nothing', async () => {
  H.platform.PHONE = true;
  const user = password({providerData: [{providerId: 'google.com'}], metadata: {lastSignInTime: stale}});
  const {useBanner, auth} = await setup({user});

  await auth.deleteAccount();

  expect(useBanner.getState().banner.text).toBe('Sign out, sign in again with Google, and then delete the account.');
  expect(H.batch.delete).not.toHaveBeenCalled();
  expect(H.A.deleteUser).not.toHaveBeenCalled();
});

test('deleteAccount that loses the sign-in after the data is gone says so honestly', async () => {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  const {useBanner, auth} = await setup({user: password()});
  H.A.deleteUser.mockRejectedValueOnce({code: 'auth/internal-error', message: 'no'});

  await auth.deleteAccount();

  expect(H.batch.commit).toHaveBeenCalled();
  expect(useBanner.getState().banner.text).toMatch(/Your data was deleted, but the sign-in itself could not be removed/);
  expect(localStorage.getItem(LS_ACCOUNT)).toBeNull();
});
