// The Firebase SDK is replaced by a fake module: cloud/firebase.js is the single import boundary, so a
// mock of it is enough to drive every branch of the sign-in sequence, the queue and the subscription.
// Each test re-imports the whole cloud graph after vi.resetModules() so module state (the loaded SDK, the
// snapshot unsubscriber, the stores) starts clean — case (g) needs `fb` to be null, which a shared module
// instance could not give us once another test had loaded it.
import {test, expect, beforeEach, vi} from 'vitest';

const H = vi.hoisted(() => {
  const batch = {update: vi.fn(), set: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => {})};
  const F = {
    doc: (db, ...p) => p.join('/'),
    getDocFromServer: vi.fn(),
    setDoc: vi.fn(async () => {}),
    updateDoc: vi.fn(async () => {}),
    onSnapshot: vi.fn(() => () => {}),
    writeBatch: () => batch,
    serverTimestamp: () => 'TS',
    deleteField: () => 'DELETE_FIELD',
    terminate: vi.fn(async () => {}),
    clearIndexedDbPersistence: vi.fn(async () => {}),
  };
  const A = {onAuthStateChanged: vi.fn(), getRedirectResult: vi.fn(async () => null), signOut: vi.fn(async () => {})};
  return {batch, F, A, fake: {app: {}, auth: {currentUser: null}, db: {}, A, F}};
});

vi.mock('./firebase.js', () => ({init: vi.fn(async () => H.fake)}));
vi.mock('./crew.js', () => ({
  onPointer: vi.fn(), crewOwnedByMe: vi.fn(() => false), unsubscribeCrew: vi.fn(),
  offerJoin: vi.fn(), afterSubscribe: vi.fn(), onDenied: vi.fn(), pendingJoin: vi.fn(() => null),
}));
// the real data module has no firebase.json in this repo, so CLOUD would be false and loadFirebase() a
// rejection; everything else (byNo, the programme) stays real
vi.mock('../data/index.js', async orig => ({...await orig(), CLOUD: true, FIREBASE: {apiKey: 'test'}}));

const LS_ACCOUNT = 'htlgi-l26-account', LS_QUEUE = 'htlgi-l26-queue';
const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com', providerData: [], metadata: {}};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  H.F.getDocFromServer.mockReset();
  H.F.setDoc.mockReset().mockResolvedValue(undefined);
  H.F.onSnapshot.mockReset().mockImplementation(() => () => {});
  H.batch.commit.mockReset().mockResolvedValue(undefined);
});

// Imports the freshly-reset module graph; `fb` is loaded unless a test needs it absent.
async function setup({loadFb = true, signedIn = true, local = null} = {}){
  const {useCloud} = await import('../store/cloud.js');
  const {usePlanner} = await import('../store/planner.js');
  const {useBanner} = await import('../store/banner.js');
  const auth = await import('./auth.js');
  const sync = await import('./sync.js');
  const crew = await import('./crew.js');
  if (loadFb) await auth.loadFirebase();
  if (signedIn) useCloud.getState().patch({user: USER, accountName: 'Are'});
  if (local) usePlanner.setState({picks: new Set(), verdicts: {}, notes: {}, shared: {}, ...local});
  return {useCloud, usePlanner, useBanner, auth, sync, crew};
}
const marker = () => JSON.parse(localStorage.getItem(LS_ACCOUNT) || 'null');

test('(a) a matching marker subscribes at once and replays the queued change as one batch', async () => {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  localStorage.setItem(LS_QUEUE, JSON.stringify([{uf: {'picks.3': true, 'verdicts.6': '__DELETE__'}, mf: null}]));
  const {useCloud, sync, crew} = await setup();

  await sync.afterSignIn(USER);

  expect(useCloud.getState().signInBranch).toBe('subscribe');
  expect(H.F.getDocFromServer).not.toHaveBeenCalled();
  expect(H.F.onSnapshot).toHaveBeenCalledTimes(1);
  expect(H.batch.update).toHaveBeenCalledTimes(1);
  expect(H.batch.update).toHaveBeenCalledWith('users/u1', {'picks.3': true, 'verdicts.6': 'DELETE_FIELD', updatedAt: 'TS'});
  expect(H.batch.commit).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(LS_QUEUE)).toBeNull();
  expect(crew.afterSubscribe).toHaveBeenCalled();
  expect(useCloud.getState().stats.writes).toBe(1);
});

test('(b) no document and no marker writes the complete document from local state', async () => {
  const {useCloud, sync} = await setup({local: {picks: new Set([3]), verdicts: {6: 'Draw'}, notes: {41: 'a thought'}}});
  H.F.getDocFromServer.mockResolvedValue({exists: () => false});

  await sync.afterSignIn(USER);

  expect(useCloud.getState().signInBranch).toBe('create-from-local');
  expect(H.F.setDoc).toHaveBeenCalledWith('users/u1', {
    name: 'Are', picks: {3: true}, verdicts: {6: 'Draw'}, notes: {41: 'a thought'}, shared: {}, updatedAt: 'TS', v: 1,
  });
  expect(marker()).toEqual({uid: 'u1'});
  expect(useCloud.getState().marker).toEqual({uid: 'u1'});
  expect(useCloud.getState().syncPending).toBe(false);
});

test('(c) no document and a foreign marker starts the account empty', async () => {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'someone-else'}));
  const {useCloud, sync} = await setup({local: {picks: new Set([3]), notes: {41: 'not theirs'}}});
  H.F.getDocFromServer.mockResolvedValue({exists: () => false});

  await sync.afterSignIn(USER);

  expect(useCloud.getState().signInBranch).toBe('create-empty');
  expect(H.F.setDoc).toHaveBeenCalledWith('users/u1', {name: 'Are', picks: {}, verdicts: {}, notes: {}, shared: {}, updatedAt: 'TS', v: 1});
  expect(marker()).toEqual({uid: 'u1'});
});

test('(d) a document and no marker merges, writes the merge up and says how many picks it took', async () => {
  const {useCloud, useBanner, sync} = await setup({local: {picks: new Set([3])}});
  H.F.getDocFromServer.mockResolvedValue({exists: () => true, data: () => ({name: 'Remote name', picks: {41: true}, verdicts: {}, notes: {}, shared: {}})});

  await sync.afterSignIn(USER);

  expect(useCloud.getState().signInBranch).toBe('merge');
  expect(H.F.setDoc.mock.calls[0][1]).toMatchObject({name: 'Remote name', picks: {3: true, 41: true}, v: 1});
  expect(useCloud.getState().accountName).toBe('Remote name');
  expect(useBanner.getState().banner.text).toBe('Merged 1 pick from this device into your account.');
});

test('(e) a document and a foreign marker replaces: nothing is written up, the snapshot decides', async () => {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'someone-else'}));
  const {useCloud, sync} = await setup({local: {picks: new Set([3])}});
  H.F.getDocFromServer.mockResolvedValue({exists: () => true, data: () => ({name: 'Remote', picks: {41: true}})});

  await sync.afterSignIn(USER);

  expect(useCloud.getState().signInBranch).toBe('replace');
  expect(H.F.setDoc).not.toHaveBeenCalled();
  expect(marker()).toEqual({uid: 'u1'});
  expect(H.F.onSnapshot).toHaveBeenCalledTimes(1);
});

test('(f) a first sign-in without a connection leaves the device local and un-markered', async () => {
  const {useCloud, useBanner, sync} = await setup();
  H.F.getDocFromServer.mockRejectedValue(new Error('offline'));

  await sync.afterSignIn(USER);

  expect(useCloud.getState().syncPending).toBe(true);
  expect(useBanner.getState().banner.text).toContain('needs a connection');
  expect(localStorage.getItem(LS_ACCOUNT)).toBeNull();
  expect(H.F.onSnapshot).not.toHaveBeenCalled();
});

test('(g) a change made before the SDK is ready is queued, not written', async () => {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  const {sync} = await setup({loadFb: false});

  sync.change({'picks.3': true}, {'picks.3': true});

  expect(JSON.parse(localStorage.getItem(LS_QUEUE))).toEqual([{uf: {'picks.3': true}, mf: {'picks.3': true}}]);
  expect(H.batch.update).not.toHaveBeenCalled();
});

test('(h) a snapshot that says the document is gone stops sync and drops the marker', async () => {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  const {useCloud, useBanner, sync} = await setup();

  await sync.afterSignIn(USER);
  const onNext = H.F.onSnapshot.mock.calls[0][1];
  onNext({exists: () => false});

  expect(useCloud.getState().syncStopped).toBe(true);
  expect(localStorage.getItem(LS_ACCOUNT)).toBeNull();
  expect(useBanner.getState().banner.text).toContain('deleted on another device');
});

test('(i) the quota banner is shown once, then sync stays quiet', async () => {
  const {useCloud, useBanner, sync} = await setup();

  sync.syncError({code: 'resource-exhausted'});
  expect(useCloud.getState().syncPaused).toBe(true);
  expect(useBanner.getState().banner.text).toContain('paused until tomorrow');

  useBanner.getState().hide();
  sync.syncError({code: 'resource-exhausted'});
  expect(useBanner.getState().banner).toBeNull();
});

test('a snapshot applies picks, name and the crew pointer, and keeps the note being typed', async () => {
  const {useCloud, usePlanner, sync, crew} = await setup({local: {notes: {6: 'mid-sentence'}}});
  const ta = document.createElement('textarea');
  ta.dataset.note = '6';
  document.body.append(ta);
  ta.focus();

  sync.applyUserData({name: 'Renamed', crew: 'crew1', picks: {3: true}, verdicts: {}, notes: {6: 'the server copy'}, shared: {}});

  expect([...usePlanner.getState().picks]).toEqual([3]);
  expect(usePlanner.getState().notes[6]).toBe('mid-sentence');
  expect(useCloud.getState().accountName).toBe('Renamed');
  expect(useCloud.getState().crewId).toBe('crew1');
  expect(crew.onPointer).toHaveBeenCalled();
  ta.remove();
});

test('a change while in a crew writes the member projection in the same batch', async () => {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  const {useCloud, sync} = await setup();
  useCloud.getState().patch({crewId: 'c1'});

  sync.change({'notes.6': 'mine', 'shared.6': '__DELETE__'}, {'notes.6': '__DELETE__'});

  expect(H.batch.update).toHaveBeenNthCalledWith(1, 'users/u1', {'notes.6': 'mine', 'shared.6': 'DELETE_FIELD', updatedAt: 'TS'});
  expect(H.batch.update).toHaveBeenNthCalledWith(2, 'crews/c1/members/u1', {'notes.6': 'DELETE_FIELD', updatedAt: 'TS'});
  expect(H.batch.commit).toHaveBeenCalledTimes(1);
});
