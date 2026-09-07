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

import {boot} from './routing.js';
import {useCloud} from './store/cloud.js';
import {useBanner} from './store/banner.js';
import {loadFirebase} from './cloud/auth.js';
import {offerJoin} from './cloud/crew.js';

const JOIN = '#join=AbCdEfGhIjKlMnOpQrSt.abcdefghijklmnopqrstu_';

beforeEach(() => {
  vi.clearAllMocks();
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

// Someone already signed in is on the sync path: cloud/sync.js calls crew.afterSubscribe() once the crew
// listeners are up, and that offers the join against a subscription rather than a bare session.
test('a signed-in visitor loads the SDK but is left to the crew subscription', async () => {
  useCloud.setState({user: {uid: 'u1'}});
  location.hash = JOIN;
  boot();

  await loadFirebase.mock.results[0].value;
  await Promise.resolve();
  expect(loadFirebase).toHaveBeenCalledTimes(1);
  expect(offerJoin).not.toHaveBeenCalled();
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
