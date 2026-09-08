// The same fake-SDK approach as sync.test.js and auth.test.js: cloud/firebase.js is the single import
// boundary, so mocking it drives every batch, listener and invite branch without touching Firebase.
// writeBatch hands out a fresh recorder each call, which is what lets the closing test prove the chunk
// size — one shared batch object could only ever count commits.
import {test, expect, beforeEach, afterEach, vi} from 'vitest';

const H = vi.hoisted(() => {
  const batches = [];
  const F = {
    // doc(db, ...path) is a path; doc(collectionRef) is the client-generated auto-id of createCrew
    doc: (a, ...p) => (p.length ? p.join('/') : {id: 'NewCrewIdAbcdefghijk'}),
    collection: (db, ...p) => p.join('/'),
    getDoc: vi.fn(async () => ({exists: () => false})),
    getDocFromServer: vi.fn(async () => ({exists: () => false})),
    setDoc: vi.fn(async () => {}),
    updateDoc: vi.fn(async () => {}),
    deleteDoc: vi.fn(async () => {}),
    onSnapshot: vi.fn(() => () => {}),
    writeBatch: vi.fn(() => {
      const b = {set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => {})};
      batches.push(b);
      return b;
    }),
    serverTimestamp: () => 'TS',
    deleteField: () => 'DELETE_FIELD',
    Timestamp: {fromMillis: ms => ({toMillis: () => ms})},
  };
  const A = {onAuthStateChanged: vi.fn(), getRedirectResult: vi.fn(async () => null), signOut: vi.fn(async () => {})};
  return {batches, F, A, fake: {app: {}, auth: {currentUser: null}, db: {}, A, F}, platform: {STANDALONE: false, IOS: false, PHONE: false}};
});

vi.mock('./firebase.js', () => ({init: vi.fn(async () => H.fake)}));
vi.mock('./platform.js', () => H.platform);
// the real data module has no firebase.json in this repo, so CLOUD would be false and the join banners
// would never appear; everything else (byNo, the programme, PUBLIC_URL) stays real
vi.mock('../data/index.js', async orig => ({...await orig(), CLOUD: true, FIREBASE: {apiKey: 'test'}}));

const LS_ACCOUNT = 'htlgi-l26-account', LS_CREW_CACHE = 'htlgi-l26-crew-cache', SS_JOIN = 'htlgi-l26-join';
const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com', providerData: [], metadata: {}};
const future = () => ({toMillis: () => Date.now() + 864e5});
const member = (uid, name, extra = {}) => ({uid, name, joinedAt: 1, picks: {}, verdicts: {}, notes: {}, ...extra});
const inCrew = over => ({id: 'c1', name: 'The Heath Three', createdBy: 'u1', members: [member('u1', 'Are')], invites: [], removed: [], syncedAt: 1, live: true, invitesLive: true, ...over});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  H.batches.length = 0;
  Object.assign(H.platform, {STANDALONE: false, IOS: false, PHONE: false});
  H.F.getDoc.mockReset().mockResolvedValue({exists: () => false});
  H.F.onSnapshot.mockReset().mockImplementation(() => () => {});
  vi.stubGlobal('confirm', vi.fn(() => true));
});
afterEach(() => { vi.unstubAllGlobals(); });

// Imports the freshly-reset module graph. `marker` is what makes sync.change() write rather than queue;
// `loadFb: false` leaves getFb() null, which is the cold-start and offline case.
async function setup({signedIn = true, marker = true, loadFb = true, crew: crewState = null, crewId = null} = {}){
  if (marker) localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  const {useCloud} = await import('../store/cloud.js');
  const {usePlanner} = await import('../store/planner.js');
  const {useBanner} = await import('../store/banner.js');
  const auth = await import('./auth.js');
  const crew = await import('./crew.js');
  if (loadFb) await auth.loadFirebase();
  if (signedIn) useCloud.getState().patch({user: USER, accountName: 'Are'});
  if (crewState || crewId) useCloud.getState().patch({crew: crewState, crewId: crewId || (crewState && crewState.id) || null});
  return {useCloud, usePlanner, useBanner, crew};
}

test('createCrew writes the crew, the creator member document and the pointer in one batch', async () => {
  const {usePlanner, crew} = await setup();
  usePlanner.setState({picks: new Set([3]), verdicts: {6: 'Draw'}, notes: {41: 'private', 6: 'shared one'}, shared: {6: true}});

  crew.createCrew('  The Heath Three  ');

  expect(H.batches).toHaveLength(1);
  const b = H.batches[0];
  expect(b.set).toHaveBeenNthCalledWith(1, 'crews/NewCrewIdAbcdefghijk', {
    name: 'The Heath Three', createdBy: 'u1', deleted: false, createdAt: 'TS', updatedAt: 'TS', v: 1,
  });
  // only notes marked "share with crew" reach the projection — the rules check the keys against users/{uid}.shared
  expect(b.set).toHaveBeenNthCalledWith(2, 'crews/NewCrewIdAbcdefghijk/members/u1', {
    name: 'Are', joinedAt: 'TS', picks: {3: true}, verdicts: {6: 'Draw'}, notes: {6: 'shared one'}, updatedAt: 'TS', v: 1,
  });
  expect(b.update).toHaveBeenCalledWith('users/u1', {crew: 'NewCrewIdAbcdefghijk', updatedAt: 'TS'});
  expect(b.commit).toHaveBeenCalledTimes(1);
});

test('createCrew ignores an empty name and trims one longer than sixty characters', async () => {
  const {useBanner, crew} = await setup();
  expect(crew.createCrew('   ')).toBe(false);   // false keeps the card's inline form open, with the caret in it
  expect(H.batches).toHaveLength(0);
  expect(useBanner.getState().banner).toBeNull();   // nothing to say: the field is empty and visibly so
  expect(crew.createCrew('x'.repeat(80))).toBe(true);
  expect(H.batches[0].set.mock.calls[0][1].name).toHaveLength(60);
});

test('createCrew before the SDK has arrived says so and keeps the name', async () => {
  const {useBanner, crew} = await setup({loadFb: false});
  expect(crew.createCrew('The Heath Three')).toBe(false);
  expect(useBanner.getState().banner.text).toBe('Still connecting; try again in a moment.');
  expect(H.batches).toHaveLength(0);
});

test('a server members snapshot without your own document is removal: cleared, unsubscribed and said once', async () => {
  const {useCloud, useBanner, usePlanner, crew} = await setup();
  usePlanner.getState().setFilter({crewOnly: true});
  const unsub = vi.fn();
  H.F.onSnapshot.mockImplementation(() => unsub);
  crew.subscribeCrew('c1');
  useCloud.getState().patch({crewId: 'c1'});
  const onMembers = H.F.onSnapshot.mock.calls[1][1];

  onMembers({metadata: {fromCache: false}, docs: [{id: 'u2', data: () => ({name: 'Kari'})}]});

  expect(useCloud.getState().crew).toBeNull();
  expect(useCloud.getState().crewId).toBeNull();
  expect(localStorage.getItem(LS_CREW_CACHE)).toBeNull();
  expect(usePlanner.getState().crewOnly).toBe(false);
  expect(unsub).toHaveBeenCalledTimes(3);
  expect(useBanner.getState().banner.text).toBe('You are no longer in this crew. Your own picks and notes are untouched.');
  // the pointer is cleared on the server too
  expect(H.batches[0].update).toHaveBeenCalledWith('users/u1', {crew: 'DELETE_FIELD', updatedAt: 'TS'});

  // idempotent: the crew document's deleted flag racing the members snapshot must not banner twice
  useBanner.getState().hide();
  crew.crewGone('The crew was closed.');
  expect(useBanner.getState().banner).toBeNull();
});

test('a cached members snapshot without your own document is not removal, and neither is one while leaving', async () => {
  const {useCloud, useBanner, crew} = await setup();
  crew.subscribeCrew('c1');
  useCloud.getState().patch({crewId: 'c1'});
  const onMembers = H.F.onSnapshot.mock.calls[1][1];

  onMembers({metadata: {fromCache: true}, docs: [{id: 'u2', data: () => ({name: 'Kari', picks: {3: true}})}]});

  expect(useCloud.getState().crew).not.toBeNull();
  expect(useCloud.getState().crew.live).toBe(false);
  expect(useCloud.getState().crew.members).toEqual([{uid: 'u2', name: 'Kari', joinedAt: 0, updatedAt: 0, picks: {3: true}, verdicts: {}, notes: {}}]);
  expect(useBanner.getState().banner).toBeNull();
});

test('the crew document going deleted:true is treated as a closed crew', async () => {
  const {useCloud, useBanner, crew} = await setup();
  crew.subscribeCrew('c1');
  useCloud.getState().patch({crewId: 'c1'});
  const onCrew = H.F.onSnapshot.mock.calls[0][1];

  onCrew({exists: () => true, data: () => ({name: 'The Heath Three', createdBy: 'u1', deleted: true})});

  expect(useCloud.getState().crew).toBeNull();
  expect(useBanner.getState().banner.text).toBe('The crew was closed. Your own picks and notes are untouched.');
});

test('a permission-denied on a crew listener is removal too', async () => {
  const {useCloud, useBanner, crew} = await setup({crew: inCrew()});
  crew.subscribeCrew('c1');
  const onError = H.F.onSnapshot.mock.calls[1][2];

  onError({code: 'permission-denied'});

  expect(useCloud.getState().crewId).toBeNull();
  expect(useBanner.getState().banner.text).toMatch(/no longer in this crew/);
});

// The create and join batches write the membership and the pointer together. The pointer is visible from
// the local write at once, so onPointer() subscribes while the batch is still travelling — and the rules,
// which only see the crew as it is on the server, refuse a listen from an account whose member document
// has not landed yet. That refusal is "not yet", not "you were removed": the crew must survive it and the
// listeners must be attached again once the batch is acknowledged.
test('a permission-denied while the crew we just created is still in flight is not a removal', async () => {
  const {useCloud, useBanner, crew} = await setup();
  let land;
  const commit = vi.fn(() => new Promise(res => { land = res; }));
  H.F.writeBatch.mockImplementationOnce(() => { const b = {set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit}; H.batches.push(b); return b; });

  expect(crew.createCrew('The Heath Three')).toBe(true);
  useCloud.getState().patch({crewId: 'NewCrewIdAbcdefghijk'});   // the local write, echoed by the user listener
  crew.subscribeCrew('NewCrewIdAbcdefghijk');                    // what onPointer() does with it
  const attached = H.F.onSnapshot.mock.calls.length;
  H.F.onSnapshot.mock.calls[0][2]({code: 'permission-denied'});  // the server has not got the batch yet

  expect(useCloud.getState().crewId).toBe('NewCrewIdAbcdefghijk');
  expect(useCloud.getState().crew).not.toBeNull();
  expect(useBanner.getState().banner).toBeNull();

  land();
  await vi.waitFor(() => expect(H.F.onSnapshot.mock.calls.length).toBeGreaterThan(attached));   // subscribed again
  expect(useCloud.getState().crewId).toBe('NewCrewIdAbcdefghijk');
});

test('a permission-denied while a join is still in flight is not a removal either', async () => {
  sessionStorage.setItem(SS_JOIN, JSON.stringify({crew: 'c2', token: 'tokentokentokentokent1', at: Date.now()}));
  const {useCloud, useBanner, crew} = await setup();
  H.F.getDoc.mockResolvedValue({exists: () => true, data: () => ({crewName: 'Theirs', createdByName: 'Kari', revoked: false, expiresAt: future()})});
  let land;
  const commit = vi.fn(() => new Promise(res => { land = res; }));
  H.F.writeBatch.mockImplementationOnce(() => { const b = {set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit}; H.batches.push(b); return b; });

  const joined = crew.acceptJoin();
  await vi.waitFor(() => expect(H.batches).toHaveLength(1));
  useCloud.getState().patch({crewId: 'c2'});
  crew.subscribeCrew('c2');
  H.F.onSnapshot.mock.calls[0][2]({code: 'permission-denied'});

  expect(useCloud.getState().crewId).toBe('c2');
  expect(useBanner.getState().banner).toBeNull();
  land();
  await joined;
});

// The genuine case must still be heard: no batch of ours is in flight, so the refusal really is a removal.
test('a permission-denied after the batch has landed is still a removal', async () => {
  const {useCloud, useBanner, crew} = await setup();
  crew.createCrew('The Heath Three');
  useCloud.getState().patch({crewId: 'NewCrewIdAbcdefghijk'});
  await vi.waitFor(() => expect(H.batches[0].commit).toHaveBeenCalled());
  await Promise.resolve();
  crew.subscribeCrew('NewCrewIdAbcdefghijk');
  H.F.onSnapshot.mock.calls[0][2]({code: 'permission-denied'});

  expect(useCloud.getState().crewId).toBeNull();
  expect(useBanner.getState().banner.text).toMatch(/no longer in this crew/);
});

test('acceptJoin stops on a revoked invite before leaving the crew it is in', async () => {
  sessionStorage.setItem(SS_JOIN, JSON.stringify({crew: 'c2', token: 'tokentokentokentokent1', at: Date.now()}));
  const {useCloud, useBanner, crew} = await setup({crew: inCrew({createdBy: 'u9'}), crewId: 'c1'});
  H.F.getDoc.mockResolvedValue({exists: () => true, data: () => ({crewName: 'Theirs', createdByName: 'Kari', revoked: true, expiresAt: future()})});

  await crew.acceptJoin();

  expect(useBanner.getState().banner.text).toBe('This invite link no longer works; ask for a new one.');
  expect(H.batches).toHaveLength(0);                 // nothing left, nothing joined
  expect(useCloud.getState().crewId).toBe('c1');
  expect(sessionStorage.getItem(SS_JOIN)).toBeNull();
});

test('acceptJoin stops the same way when the invite has expired or is gone', async () => {
  sessionStorage.setItem(SS_JOIN, JSON.stringify({crew: 'c2', token: 'tokentokentokentokent1', at: Date.now()}));
  const {useBanner, crew} = await setup({crew: inCrew({createdBy: 'u9'}), crewId: 'c1'});
  H.F.getDoc.mockResolvedValue({exists: () => true, data: () => ({crewName: 'Theirs', revoked: false, expiresAt: {toMillis: () => Date.now() - 1000}})});

  await crew.acceptJoin();
  expect(useBanner.getState().banner.text).toBe('This invite link no longer works; ask for a new one.');
  expect(H.batches).toHaveLength(0);

  sessionStorage.setItem(SS_JOIN, JSON.stringify({crew: 'c2', token: 'tokentokentokentokent1', at: Date.now()}));
  H.F.getDoc.mockResolvedValue({exists: () => false});
  await crew.acceptJoin();
  expect(H.batches).toHaveLength(0);
});

test('acceptJoin with a live invite batches the member and the pointer, then drops the token', async () => {
  sessionStorage.setItem(SS_JOIN, JSON.stringify({crew: 'c2', token: 'tokentokentokentokent1', at: Date.now()}));
  const {useBanner, usePlanner, crew} = await setup();
  usePlanner.setState({picks: new Set([3]), verdicts: {}, notes: {}, shared: {}});
  H.F.getDoc.mockResolvedValue({exists: () => true, data: () => ({crewName: 'Theirs', createdByName: 'Kari', revoked: false, expiresAt: future()})});

  await crew.acceptJoin();

  expect(H.batches).toHaveLength(1);
  const b = H.batches[0];
  expect(b.set).toHaveBeenCalledWith('crews/c2/members/u1', {
    name: 'Are', joinedAt: 'TS', picks: {3: true}, verdicts: {}, notes: {}, invite: 'tokentokentokentokent1', updatedAt: 'TS', v: 1,
  });
  expect(b.update).toHaveBeenCalledWith('users/u1', {crew: 'c2', updatedAt: 'TS'});
  // the follow-up write keeps the token from staying readable by the whole crew
  expect(H.F.updateDoc).toHaveBeenCalledWith('crews/c2/members/u1', {invite: 'DELETE_FIELD', updatedAt: 'TS'});
  expect(sessionStorage.getItem(SS_JOIN)).toBeNull();
  expect(useBanner.getState().banner).toBeNull();
});

// The rules' verdict on the invite (revoked between the read and the write, a block record, a crew closed
// in the meantime) is final: the pending join goes. Every other failure is worth trying again.
test('acceptJoin drops the invite when the rules refuse it, and keeps it when the connection does', async () => {
  const pend = () => sessionStorage.setItem(SS_JOIN, JSON.stringify({crew: 'c2', token: 'tokentokentokentokent1', at: Date.now()}));
  pend();
  const {useBanner, crew} = await setup();
  H.F.getDoc.mockResolvedValue({exists: () => true, data: () => ({crewName: 'Theirs', createdByName: 'Kari', revoked: false, expiresAt: future()})});
  H.F.writeBatch.mockImplementationOnce(() => ({set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => { throw {code: 'permission-denied'}; })}));

  await crew.acceptJoin();

  expect(useBanner.getState().banner.text).toBe('This invite link no longer works; ask for a new one.');
  expect(sessionStorage.getItem(SS_JOIN)).toBeNull();

  pend();
  H.F.writeBatch.mockImplementationOnce(() => ({set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => { throw {code: 'unavailable'}; })}));

  await crew.acceptJoin();

  expect(useBanner.getState().banner.text).toBe('Couldn’t join right now; try again when you’re online.');
  expect(sessionStorage.getItem(SS_JOIN)).not.toBeNull();   // the same tap will work later
});

test('offerJoin asks the signed-out visitor to sign in, and says so when the invite is for the crew you are in', async () => {
  sessionStorage.setItem(SS_JOIN, JSON.stringify({crew: 'c1', token: 'tokentokentokentokent1', at: Date.now()}));
  const {useCloud, useBanner, crew} = await setup({signedIn: false});

  await crew.offerJoin();
  expect(useBanner.getState().banner.text).toMatch(/Sign in or create an account to join/);
  expect(H.F.getDoc).not.toHaveBeenCalled();   // reading the invite needs a session

  useCloud.getState().patch({user: USER, accountName: 'Are', crewId: 'c1', crew: inCrew()});
  await crew.offerJoin();
  expect(useBanner.getState().banner.text).toBe('You’re already in The Heath Three.');
  expect(sessionStorage.getItem(SS_JOIN)).toBeNull();
});

test('offerJoin from another crew offers the swap, and Join leaves the old crew and joins the new one', async () => {
  sessionStorage.setItem(SS_JOIN, JSON.stringify({crew: 'c2', token: 'tokentokentokentokent1', at: Date.now()}));
  const {useBanner, crew} = await setup({crew: inCrew({createdBy: 'u9', members: [member('u9', 'Kari'), member('u1', 'Are')]}), crewId: 'c1'});
  H.F.getDoc.mockResolvedValue({exists: () => true, data: () => ({crewName: 'Theirs', createdByName: 'Kari', revoked: false, expiresAt: future()})});

  await crew.offerJoin();

  expect(useBanner.getState().banner.text).toBe('Leave The Heath Three and join Theirs? Invited by Kari.');
  expect(useBanner.getState().banner.actions.map(a => a.label)).toEqual(['Join', 'Not now']);

  useBanner.getState().banner.actions.find(a => a.label === 'Join').onClick();
  await vi.waitFor(() => expect(H.batches).toHaveLength(2));

  expect(H.batches[0].delete).toHaveBeenCalledWith('crews/c1/members/u1');      // left the old crew first
  expect(H.batches[1].set).toHaveBeenCalledWith('crews/c2/members/u1', expect.objectContaining({name: 'Are', invite: 'tokentokentokentokent1'}));
  expect(H.batches[1].update).toHaveBeenCalledWith('users/u1', {crew: 'c2', updatedAt: 'TS'});
  expect(sessionStorage.getItem(SS_JOIN)).toBeNull();
  expect(useBanner.getState().banner).toBeNull();
});

// The join survives a removal landing while the invite is being read: the pointer is re-read after the
// round trip, so acceptJoin does not try to leave a crew it is no longer in (that would fail and abort).
test('a removal during the invite round trip does not abort the join', async () => {
  sessionStorage.setItem(SS_JOIN, JSON.stringify({crew: 'c2', token: 'tokentokentokentokent1', at: Date.now()}));
  const {useCloud, crew} = await setup({crew: inCrew({createdBy: 'u9', members: [member('u9', 'Kari'), member('u1', 'Are')]}), crewId: 'c1'});
  H.F.getDoc.mockImplementation(async () => {
    useCloud.getState().patch({crew: null, crewId: null});   // crewGone(), mid-flight
    return {exists: () => true, data: () => ({crewName: 'Theirs', createdByName: 'Kari', revoked: false, expiresAt: future()})};
  });

  await crew.acceptJoin();

  expect(H.batches).toHaveLength(1);                                            // no leave batch: nothing to leave
  expect(H.batches[0].set).toHaveBeenCalledWith('crews/c2/members/u1', expect.objectContaining({name: 'Are'}));
  expect(H.batches[0].update).toHaveBeenCalledWith('users/u1', {crew: 'c2', updatedAt: 'TS'});
});

test('a pending invite older than an hour is not pending any more', async () => {
  sessionStorage.setItem(SS_JOIN, JSON.stringify({crew: 'c2', token: 'tokentokentokentokent1', at: Date.now() - 2 * 36e5}));
  const {crew} = await setup();
  expect(crew.pendingJoin()).toBeNull();
});

test('removeMember deletes the member and writes a block record carrying their name', async () => {
  const {crew} = await setup({crew: inCrew({members: [member('u1', 'Are'), member('u2', 'Kari')]})});

  crew.removeMember('u2');

  expect(H.batches).toHaveLength(1);
  expect(H.batches[0].delete).toHaveBeenCalledWith('crews/c1/members/u2');
  expect(H.batches[0].set).toHaveBeenCalledWith('crews/c1/removed/u2', {name: 'Kari', removedAt: 'TS', v: 1});
  expect(H.batches[0].commit).toHaveBeenCalledTimes(1);
});

test('a declined confirmation writes nothing, for removing, handing over and closing', async () => {
  vi.stubGlobal('confirm', vi.fn(() => false));
  const {crew} = await setup({crew: inCrew({members: [member('u1', 'Are'), member('u2', 'Kari')]})});

  crew.removeMember('u2');
  crew.makeOwner('u2');
  expect(await crew.closeCrew(false)).toBe(false);

  expect(H.batches).toHaveLength(0);
  expect(H.F.updateDoc).not.toHaveBeenCalled();
});

test('readmit deletes the block record and makeOwner moves createdBy', async () => {
  const {crew} = await setup({crew: inCrew({members: [member('u1', 'Are'), member('u2', 'Kari')], removed: [{uid: 'u3', name: 'Morten'}]})});

  crew.readmit('u3');
  expect(H.F.deleteDoc).toHaveBeenCalledWith('crews/c1/removed/u3');

  crew.makeOwner('u2');
  expect(H.F.updateDoc).toHaveBeenCalledWith('crews/c1', {createdBy: 'u2', updatedAt: 'TS'});
});

test('closeCrew deletes the other documents in chunks of at most nine, then tombstones in one batch', async () => {
  const members = [member('u1', 'Are'), ...Array.from({length: 10}, (_, i) => member('m' + i, 'Member ' + i))];
  const invites = [{token: 'a'.repeat(22)}, {token: 'b'.repeat(22)}];
  const {useCloud, usePlanner, crew} = await setup({crew: inCrew({members, invites, removed: [{uid: 'r1', name: 'Gone'}]})});
  usePlanner.getState().setFilter({crewOnly: true});

  const closed = await crew.closeCrew(true);

  expect(closed).toBe(true);
  // 10 members + 2 invites + 1 block record = 13 documents → 9 + 4, then the tombstone batch
  expect(H.batches).toHaveLength(3);
  expect(H.batches[0].delete).toHaveBeenCalledTimes(9);
  expect(H.batches[1].delete).toHaveBeenCalledTimes(4);
  expect(H.batches[1].delete).toHaveBeenCalledWith('crews/c1/invites/' + 'b'.repeat(22));
  expect(H.batches[1].delete).toHaveBeenCalledWith('crews/c1/removed/r1');
  const last = H.batches[2];
  expect(last.delete).toHaveBeenCalledWith('crews/c1/members/u1');
  expect(last.update).toHaveBeenCalledWith('crews/c1', {deleted: true, updatedAt: 'TS'});
  expect(last.update).toHaveBeenCalledWith('users/u1', {crew: 'DELETE_FIELD', updatedAt: 'TS'});
  expect(useCloud.getState().crew).toBeNull();
  expect(useCloud.getState().crewId).toBeNull();
  expect(usePlanner.getState().crewOnly).toBe(false);
  expect(localStorage.getItem(LS_CREW_CACHE)).toBeNull();
});

// A cache-only crew (hydrateCrewCache paints one without invites or block records) must not be closed:
// the tombstone would go up and those documents would stay behind, readable and deletable by nobody.
test('closeCrew refuses on a crew that is only the cache, and closes once a server snapshot has landed', async () => {
  const {useCloud, useBanner, crew} = await setup({crew: inCrew({live: false, invites: [{token: 'a'.repeat(22)}]})});

  expect(await crew.closeCrew(true)).toBe(false);
  expect(useBanner.getState().banner.text).toBe('Still connecting; try again in a moment.');
  expect(H.batches).toHaveLength(0);
  expect(useCloud.getState().crew).not.toBeNull();

  useCloud.getState().patch({crew: inCrew({live: true, invites: [{token: 'a'.repeat(22)}]})});
  expect(await crew.closeCrew(true)).toBe(true);
  expect(H.batches[0].delete).toHaveBeenCalledWith('crews/c1/invites/' + 'a'.repeat(22));
});

// The invites arrive on their own listener, so a members snapshot says nothing about how many invites are
// out: closing before the invites have been listed by the server would leave the ones it never saw behind.
test('closeCrew waits for the invites listener’s first server snapshot as well', async () => {
  const {useCloud, useBanner, crew} = await setup({crew: inCrew({live: true, invitesLive: false})});

  expect(await crew.closeCrew(true)).toBe(false);
  expect(useBanner.getState().banner.text).toBe('Still connecting; try again in a moment.');
  expect(H.batches).toHaveLength(0);

  crew.subscribeCrew('c1');
  useCloud.getState().patch({crewId: 'c1'});
  const onInvites = H.F.onSnapshot.mock.calls[2][1];
  onInvites({metadata: {fromCache: true}, docs: []});
  expect(useCloud.getState().crew.invitesLive).toBe(false);
  onInvites({metadata: {fromCache: false}, docs: [{id: 'a'.repeat(22), data: () => ({revoked: false})}]});
  expect(useCloud.getState().crew.invitesLive).toBe(true);

  useCloud.getState().patch({crew: {...useCloud.getState().crew, live: true, createdBy: 'u1', members: [member('u1', 'Are')]}});
  expect(await crew.closeCrew(true)).toBe(true);
  expect(H.batches[0].delete).toHaveBeenCalledWith('crews/c1/invites/' + 'a'.repeat(22));
});

// Nobody should answer "yes, remove them" and only then be told to try again in a moment: the readiness
// check comes before the confirmation, as it does for leaving.
test('the destructive actions check they can write before they ask', async () => {
  vi.stubGlobal('confirm', vi.fn(() => true));
  const {useBanner, crew} = await setup({loadFb: false, crew: inCrew({members: [member('u1', 'Are'), member('u2', 'Kari')]})});

  crew.removeMember('u2');
  crew.makeOwner('u2');
  expect(await crew.closeCrew(false)).toBe(false);

  expect(confirm).not.toHaveBeenCalled();
  expect(useBanner.getState().banner.text).toBe('Still connecting; try again in a moment.');
  expect(H.batches).toHaveLength(0);
  expect(H.F.updateDoc).not.toHaveBeenCalled();
});

test('a crew painted from the cache is not one to remove people from either', async () => {
  const {useBanner, crew} = await setup({crew: inCrew({live: false, members: [member('u1', 'Are'), member('u2', 'Kari')]})});

  crew.removeMember('u2');
  expect(confirm).not.toHaveBeenCalled();
  expect(useBanner.getState().banner.text).toBe('Still connecting; try again in a moment.');
  expect(H.batches).toHaveLength(0);
});

test('the three crew listeners count their snapshots, and members carry their last sync time', async () => {
  const {useCloud, crew} = await setup();
  crew.subscribeCrew('c1');
  useCloud.getState().patch({crewId: 'c1'});
  const [onCrew, onMembers, onInvites] = [0, 1, 2].map(i => H.F.onSnapshot.mock.calls[i][1]);

  onCrew({exists: () => true, data: () => ({name: 'The Heath Three', createdBy: 'u1', deleted: false})});
  onMembers({metadata: {fromCache: false}, docs: [{id: 'u1', data: () => ({name: 'Are', picks: {3: true}, updatedAt: {toMillis: () => 1758288300000}})}]});
  onInvites({metadata: {fromCache: false}, docs: []});

  expect(useCloud.getState().stats.snapshots).toBe(3);
  expect(useCloud.getState().crew.members[0].updatedAt).toBe(1758288300000);
});

test('an invites listener error is logged rather than swallowed', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const {crew} = await setup();
  crew.subscribeCrew('c1');

  H.F.onSnapshot.mock.calls[2][2]({code: 'unavailable'});

  expect(warn).toHaveBeenCalledWith('crew invites', {code: 'unavailable'});
  warn.mockRestore();
});

// The invite is already written by the time the share sheet opens, so a sheet that fails or is dismissed
// must not leave the link nowhere: it falls through to the copy banner.
test('shareLink falls back to the copy banner when the share sheet rejects', async () => {
  H.platform.PHONE = true;
  const share = vi.fn(async () => { throw new Error('NotAllowedError'); });
  vi.stubGlobal('navigator', {...navigator, share, onLine: true});
  const {useBanner, crew} = await setup({crew: inCrew()});

  crew.shareLink('https://example.test/#join=c1.' + 'a'.repeat(22));
  await vi.waitFor(() => expect(useBanner.getState().banner).not.toBeNull());

  expect(share).toHaveBeenCalled();
  expect(useBanner.getState().banner.input).toBe('https://example.test/#join=c1.' + 'a'.repeat(22));
  expect(useBanner.getState().banner.actions.map(a => a.label)).toEqual(['Copy', 'Close']);
});

test('a share sheet that works says nothing more', async () => {
  H.platform.PHONE = true;
  const share = vi.fn(async () => {});
  vi.stubGlobal('navigator', {...navigator, share, onLine: true});
  const {useBanner, crew} = await setup({crew: inCrew()});

  crew.shareLink('https://example.test/#join=c1.' + 'a'.repeat(22));
  await Promise.resolve();
  await Promise.resolve();

  expect(share).toHaveBeenCalled();
  expect(useBanner.getState().banner).toBeNull();
});

// Every write is offered from the first paint (the card no longer waits for `user`), so each one has to
// answer for itself when the SDK chunk has not arrived — offline, or in the second before it loads.
test('the crew actions say so instead of throwing when the SDK is not loaded', async () => {
  const {useBanner, crew} = await setup({loadFb: false, crew: inCrew({members: [member('u1', 'Are'), member('u2', 'Kari')], invites: [{token: 'a'.repeat(22)}], removed: [{uid: 'u3', name: 'Morten'}]})});

  for (const run of [
    () => crew.renameCrew('The Heath Four'),
    () => crew.removeMember('u2'),
    () => crew.makeOwner('u2'),
    () => crew.readmit('u3'),
    () => crew.revokeInvite('a'.repeat(22)),
  ]) {
    useBanner.getState().hide();
    expect(run).not.toThrow();
    expect(useBanner.getState().banner.text).toBe('Still connecting; try again in a moment.');
  }
  expect(H.F.updateDoc).not.toHaveBeenCalled();
  expect(H.F.deleteDoc).not.toHaveBeenCalled();
  expect(H.batches).toHaveLength(0);

  for (const run of [() => crew.createInvite(), () => crew.leaveCrew(false), () => crew.closeCrew(true)]) {
    useBanner.getState().hide();
    expect(await run()).toBeFalsy();
    expect(useBanner.getState().banner.text).toBe('Still connecting; try again in a moment.');
  }
  expect(H.F.setDoc).not.toHaveBeenCalled();
  expect(H.batches).toHaveLength(0);
});

test('leaveCrew batches the member delete and the pointer removal after detaching the listeners', async () => {
  const {useCloud, crew} = await setup({crew: inCrew({createdBy: 'u9', members: [member('u9', 'Kari'), member('u1', 'Are')]})});
  const unsub = vi.fn();
  H.F.onSnapshot.mockImplementation(() => unsub);
  crew.subscribeCrew('c1');

  const left = await crew.leaveCrew(true);

  expect(left).toBe(true);
  expect(unsub).toHaveBeenCalledTimes(3);
  expect(H.batches[0].delete).toHaveBeenCalledWith('crews/c1/members/u1');
  expect(H.batches[0].update).toHaveBeenCalledWith('users/u1', {crew: 'DELETE_FIELD', updatedAt: 'TS'});
  expect(useCloud.getState().crew).toBeNull();
});

test('the creator cannot leave a crew that still has members, and leaving alone closes it', async () => {
  const {useBanner, useCloud, crew} = await setup({crew: inCrew({members: [member('u1', 'Are'), member('u2', 'Kari')]})});

  expect(await crew.leaveCrew(true)).toBe(false);
  expect(useBanner.getState().banner.text).toMatch(/make someone else the owner, or close the crew/);
  expect(H.batches).toHaveLength(0);

  useCloud.getState().patch({crew: inCrew()});   // alone now
  expect(await crew.leaveCrew(true)).toBe(true);
  expect(H.batches[0].update).toHaveBeenCalledWith('crews/c1', {deleted: true, updatedAt: 'TS'});
});

test('a failed leave keeps the crew and puts the listeners back', async () => {
  const {useCloud, useBanner, crew} = await setup({crew: inCrew({createdBy: 'u9', members: [member('u9', 'Kari'), member('u1', 'Are')]})});
  H.F.writeBatch.mockImplementationOnce(() => ({set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => { throw new Error('offline'); })}));

  expect(await crew.leaveCrew(true)).toBe(false);

  expect(useCloud.getState().crew).not.toBeNull();
  expect(useBanner.getState().banner.text).toBe('offline');
  expect(H.F.onSnapshot).toHaveBeenCalledTimes(3);   // re-subscribed
});

test('createInvite writes a fourteen-day token of twenty-two characters and offers the link', async () => {
  const {useBanner, crew} = await setup({crew: inCrew()});
  const before = Date.now();

  const token = await crew.createInvite();

  expect(token).toHaveLength(22);
  expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
  const [ref, data] = H.F.setDoc.mock.calls[0];
  expect(ref).toBe('crews/c1/invites/' + token);
  // exact equality, not a subset: the rules reject an invite carrying any field they do not name, so an
  // extra key here would be a write that always fails
  expect(data).toEqual({
    crewName: 'The Heath Three', createdBy: 'u1', createdByName: 'Are',
    createdAt: 'TS', expiresAt: expect.any(Object), revoked: false, v: 1,
  });
  const days = (data.expiresAt.toMillis() - before) / 864e5;
  expect(days).toBeGreaterThan(13.9);
  expect(days).toBeLessThan(14.1);
  expect(useBanner.getState().banner.input).toBe('https://how-the-light-gets-in.firebaseapp.com/#join=c1.' + token);
});

test('revokeInvite touches only the revoked field, and liveInvites hides what it revoked', async () => {
  const live = {token: 'a'.repeat(22), revoked: false, expiresAt: future(), createdByName: 'Are'};
  const dead = {token: 'b'.repeat(22), revoked: true, expiresAt: future(), createdByName: 'Are'};
  const old = {token: 'c'.repeat(22), revoked: false, expiresAt: {toMillis: () => Date.now() - 1}, createdByName: 'Are'};
  const {crew} = await setup({crew: inCrew({invites: [live, dead, old]})});

  expect(crew.liveInvites()).toEqual([live]);
  crew.revokeInvite(live.token);
  expect(H.F.updateDoc).toHaveBeenCalledWith('crews/c1/invites/' + live.token, {revoked: true});
});

test('hydrateCrewCache paints the cached crew on boot, but only for a device with an account', async () => {
  const cached = {id: 'c1', name: 'The Heath Three', createdBy: 'u1', members: [member('u1', 'Are')], syncedAt: 1234};
  localStorage.setItem(LS_CREW_CACHE, JSON.stringify(cached));
  const {useCloud, crew} = await setup({marker: false});

  crew.hydrateCrewCache();
  expect(useCloud.getState().crew).toBeNull();

  localStorage.setItem(LS_ACCOUNT, JSON.stringify({uid: 'u1'}));
  crew.hydrateCrewCache();
  expect(useCloud.getState().crewId).toBe('c1');
  expect(useCloud.getState().crew).toEqual({...cached, invites: [], removed: [], live: false, invitesLive: false});
});

// The overlay and the card work from the cached crew before the SDK produces a `user`; the account marker
// is the identity in the meantime (store/cloud.js, selectMyUid), so "who are the others" works there too.
test('others() tells the rest of the crew apart from the account marker alone', async () => {
  const {useCloud, crew} = await setup({signedIn: false, loadFb: false, crew: inCrew({members: [member('u1', 'Are'), member('u2', 'Kari')]})});

  expect(crew.others()).toEqual([]);                                     // no identity at all yet
  useCloud.getState().patch({marker: {uid: 'u1'}});
  expect(crew.others().map(m => m.uid)).toEqual(['u2']);
});

test('a members snapshot writes the cache the next cold start reads, and the pointer going away clears it', async () => {
  const {useCloud, crew} = await setup();
  crew.subscribeCrew('c1');
  useCloud.getState().patch({crewId: 'c1'});
  const onCrew = H.F.onSnapshot.mock.calls[0][1];
  const onMembers = H.F.onSnapshot.mock.calls[1][1];

  onCrew({exists: () => true, data: () => ({name: 'The Heath Three', createdBy: 'u1', deleted: false})});
  onMembers({metadata: {fromCache: false}, docs: [{id: 'u1', data: () => ({name: 'Are', picks: {3: true}})}]});

  const cached = JSON.parse(localStorage.getItem(LS_CREW_CACHE));
  expect(cached.id).toBe('c1');
  expect(cached.name).toBe('The Heath Three');
  expect(cached.members[0].uid).toBe('u1');

  useCloud.getState().patch({crewId: null});
  crew.onPointer();
  expect(useCloud.getState().crew).toBeNull();
  expect(localStorage.getItem(LS_CREW_CACHE)).toBeNull();
});

test('the creator listens to block records; a member does not', async () => {
  const {useCloud, crew} = await setup();
  crew.subscribeCrew('c1');
  useCloud.getState().patch({crewId: 'c1'});
  const onCrew = H.F.onSnapshot.mock.calls[0][1];

  onCrew({exists: () => true, data: () => ({name: 'Crew', createdBy: 'u1', deleted: false})});
  expect(H.F.onSnapshot).toHaveBeenCalledTimes(4);   // three plus the removed collection
  const onRemoved = H.F.onSnapshot.mock.calls[3][1];
  onRemoved({docs: [{id: 'u2', data: () => ({name: 'Kari'})}]});
  expect(useCloud.getState().crew.removed).toEqual([{uid: 'u2', name: 'Kari'}]);

  onCrew({exists: () => true, data: () => ({name: 'Crew', createdBy: 'u2', deleted: false})});   // handed over
  expect(useCloud.getState().crew.removed).toEqual([]);
  expect(crew.crewOwnedByMe()).toBe(false);
});

test('onPointer subscribes when the pointer names a crew we are not listening to', async () => {
  const {useCloud, crew} = await setup();
  useCloud.getState().patch({crewId: 'c1'});

  crew.onPointer();
  expect(H.F.onSnapshot).toHaveBeenCalledTimes(3);
  expect(useCloud.getState().crew.id).toBe('c1');

  crew.onPointer();   // already listening: no second set of listeners
  expect(H.F.onSnapshot).toHaveBeenCalledTimes(3);
});

// The return value is what the Crew card's inline form reads: true closes it, false leaves what was typed
// where it is, so an empty field or a "try again in a moment" costs no retyping.
test('renameCrew writes only the name and ignores an unchanged or empty one; onDenied is removal', async () => {
  const {useCloud, useBanner, crew} = await setup({crew: inCrew()});

  expect(crew.renameCrew('  The Heath Four  ')).toBe(true);
  expect(H.F.updateDoc).toHaveBeenCalledWith('crews/c1', {name: 'The Heath Four', updatedAt: 'TS'});

  H.F.updateDoc.mockClear();
  expect(crew.renameCrew('The Heath Three')).toBe(true);   // already called that: done, nothing written
  expect(crew.renameCrew('   ')).toBe(false);              // nothing typed: the form stays
  expect(H.F.updateDoc).not.toHaveBeenCalled();

  crew.onDenied();
  expect(useCloud.getState().crewId).toBeNull();
  expect(useBanner.getState().banner.text).toMatch(/no longer in this crew/);
});
