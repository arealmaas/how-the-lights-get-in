// The other half of routing.test.js. CLOUD is decided by a module-level mock of ./data/index.js (the same
// way src/cloud/crew.test.js does it), and a module-level mock cannot differ between tests in one file:
// routing.test.js runs against the real data module — this repo has no data/firebase.json, so CLOUD is
// false and nothing is fetched — and this file mocks it true to cover the hand-off a #join= link makes to
// the cloud layer, loadFirebase() → offerJoin().
import {vi, test, expect, beforeEach} from 'vitest';

vi.mock('./data/index.js', async orig => ({...await orig(), CLOUD: true, FIREBASE: {apiKey: 'test'}}));
vi.mock('./cloud/sync.js', () => ({change: vi.fn()}));
vi.mock('./cloud/crew.js', () => ({SS_JOIN: 'htlgi-l26-join', offerJoin: vi.fn()}));
vi.mock('./cloud/auth.js', () => ({loadFirebase: vi.fn(async () => ({}))}));

import {boot, onHashChange} from './routing.js';
import {useCloud} from './store/cloud.js';
import {useBanner, showBanner} from './store/banner.js';
import {loadFirebase} from './cloud/auth.js';
import {offerJoin} from './cloud/crew.js';

const JOIN = '#join=AbCdEfGhIjKlMnOpQrSt.abcdefghijklmnopqrstu_';

beforeEach(() => {
  vi.clearAllMocks();
  offerJoin.mockReset();   // clearAllMocks keeps implementations; one test gives offerJoin a banner to show
  loadFirebase.mockResolvedValue({});
  sessionStorage.clear();
  useCloud.setState({user: null});
  useBanner.setState({banner: null});
  history.replaceState(null, '', '/');
});

test('a signed-out visitor gets the SDK fetched and the join offered once it is there', async () => {
  location.hash = JOIN;
  boot();

  expect(loadFirebase).toHaveBeenCalledTimes(1);
  expect(offerJoin).not.toHaveBeenCalled();   // not before the SDK: reading the invite needs a session
  await vi.waitFor(() => expect(offerJoin).toHaveBeenCalledTimes(1));
  expect(location.hash).toBe('');
  expect(JSON.parse(sessionStorage.getItem('htlgi-l26-join')).crew).toBe('AbCdEfGhIjKlMnOpQrSt');
});

// A tab that is already signed in when the link arrives — pasted into the address bar of a running app, so
// hashchange rather than boot — has no sign-in coming and so no afterSubscribe() to offer the join. The
// offer is unconditional for that reason.
test('a #join= arriving by hashchange in a signed-in tab is offered', async () => {
  useCloud.setState({user: {uid: 'u1'}});
  location.hash = JOIN;
  onHashChange();

  expect(loadFirebase).toHaveBeenCalledTimes(1);
  await vi.waitFor(() => expect(offerJoin).toHaveBeenCalledTimes(1));
  expect(location.hash).toBe('');
  expect(JSON.parse(sessionStorage.getItem('htlgi-l26-join')).crew).toBe('AbCdEfGhIjKlMnOpQrSt');
});

// On boot a signed-in visitor is now offered the join twice: here, and again from cloud/sync.js when the
// crew listeners are up (crew.afterSubscribe()). That is one extra invite read and no second banner — the
// banner store holds one banner, and showBanner replaces it.
test('a signed-in visitor on boot is offered the join, and the subscription’s later offer replaces it', async () => {
  offerJoin.mockImplementation(() => showBanner({text: 'Join Theirs? Invited by Kari.', actions: []}));
  useCloud.setState({user: {uid: 'u1'}});
  location.hash = JOIN;
  boot();

  await vi.waitFor(() => expect(offerJoin).toHaveBeenCalledTimes(1));
  const first = useBanner.getState().banner;
  offerJoin();   // what afterSubscribe() does a moment later
  expect(offerJoin).toHaveBeenCalledTimes(2);
  // the store holds one banner and showBanner replaced it: two offers, one thing on screen
  expect(useBanner.getState().banner).not.toBe(first);
  expect(useBanner.getState().banner.text).toBe('Join Theirs? Invited by Kari.');
});

test('an SDK that cannot be fetched is not an unhandled rejection, and says nothing here', async () => {
  loadFirebase.mockRejectedValue(Object.assign(new Error('offline'), {reported: true}));
  location.hash = JOIN;

  expect(() => boot()).not.toThrow();
  await vi.waitFor(() => expect(loadFirebase).toHaveBeenCalledTimes(1));
  await Promise.resolve();
  expect(offerJoin).not.toHaveBeenCalled();
  expect(useBanner.getState().banner).toBeNull();   // loadFirebase has already said it, once
  expect(sessionStorage.getItem('htlgi-l26-join')).not.toBeNull();   // the invite waits for the next try
});
