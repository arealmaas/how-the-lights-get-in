import {vi, test, expect, beforeEach} from 'vitest';
vi.mock('./cloud/sync.js', () => ({change: vi.fn()}));
// the cloud modules are seams here: routing only has to store the invite, strip the hash and, with a
// Firebase config, hand over to the crew module. cloud/crew.test.js covers what happens next.
vi.mock('./cloud/crew.js', () => ({SS_JOIN: 'htlgi-l26-join', offerJoin: vi.fn()}));
vi.mock('./cloud/auth.js', () => ({loadFirebase: vi.fn(() => Promise.reject(new Error('cloud features are off')))}));
import {boot, onHashChange} from './routing.js';
import {usePlanner} from './store/planner.js';
import {useBanner} from './store/banner.js';
import {useSheet} from './store/sheet.js';
import {loadFirebase} from './cloud/auth.js';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  usePlanner.setState({picks: new Set(), verdicts: {}, notes: {}, shared: {}});
  useBanner.setState({banner: null});
  useSheet.setState({stack: []});
  history.replaceState(null, '', '/');
});

test('an import link banners the pluralised counts of what it carries', () => {
  location.hash = '#picks=3,6&verdicts=6:Draw';
  boot();

  const banner = useBanner.getState().banner;
  expect(banner).not.toBeNull();
  expect(banner.text).toContain('2 picks');
  expect(banner.text).toContain('1 verdict');
});

test('Add them to mine applies the fresh picks/verdicts and clears the hash', () => {
  location.hash = '#picks=3,6&verdicts=6:Draw';
  boot();

  const banner = useBanner.getState().banner;
  const add = banner.actions.find(a => a.label === 'Add them to mine');
  add.onClick();

  expect(usePlanner.getState().picks.has(3)).toBe(true);
  expect(usePlanner.getState().picks.has(6)).toBe(true);
  expect(usePlanner.getState().verdicts[6]).toBe('Draw');
  expect(location.hash).toBe('');
  expect(useBanner.getState().banner).toBeNull();
});

test('Not now dismisses the banner and clears the hash without applying anything', () => {
  location.hash = '#picks=3,6';
  boot();

  const banner = useBanner.getState().banner;
  const notNow = banner.actions.find(a => a.label === 'Not now');
  notNow.onClick();

  expect(usePlanner.getState().picks.size).toBe(0);
  expect(location.hash).toBe('');
  expect(useBanner.getState().banner).toBeNull();
});

test('nothing fresh (everything already owned) clears the hash without a banner', () => {
  usePlanner.setState({picks: new Set([3, 6]), verdicts: {}, notes: {}, shared: {}});
  location.hash = '#picks=3,6';
  boot();

  expect(useBanner.getState().banner).toBeNull();
  expect(location.hash).toBe('');
});

test('a hash with no import data leaves the banner untouched', () => {
  location.hash = '#event=6';
  boot();
  expect(useBanner.getState().banner).toBeNull();
});

test('event parameters require exact boundaries and repeated routing does not duplicate a sheet', () => {
  for (const hash of ['#notanevent=6', '#event=6junk']) {
    history.replaceState(null, '', '/' + hash);
    boot();
    expect(useSheet.getState().stack).toHaveLength(0);
  }
  history.replaceState(null, '', '/#event=6');
  boot();
  onHashChange();
  expect(useSheet.getState().stack).toEqual([{kind: 'event', key: 6}]);
});

test('onHashChange picks up an import link the same way boot does', () => {
  location.hash = '#picks=41';
  onHashChange();

  const banner = useBanner.getState().banner;
  expect(banner.text).toContain('1 pick');
});

// The token must not sit in the address bar, in the history, or in a referrer: it is stripped the moment
// it is read, and kept in sessionStorage so it survives a redirect sign-in and a reload while an account
// is being created. Without data/firebase.json (this repo, and the e2e run) CLOUD is false, so nothing
// else happens at all — no SDK fetch, no banner.
test('a #join= link is stored, stripped from the address, and silent without a Firebase config', () => {
  location.hash = '#join=AbCdEfGhIjKlMnOpQrSt.abcdefghijklmnopqrstu_';
  boot();

  expect(JSON.parse(sessionStorage.getItem('htlgi-l26-join'))).toMatchObject({crew: 'AbCdEfGhIjKlMnOpQrSt', token: 'abcdefghijklmnopqrstu_'});
  expect(JSON.parse(sessionStorage.getItem('htlgi-l26-join')).at).toBeGreaterThan(0);
  expect(location.hash).toBe('');
  expect(useBanner.getState().banner).toBeNull();
  expect(loadFirebase).not.toHaveBeenCalled();
});

test('a malformed join hash is left to the import parser, which finds nothing in it', () => {
  location.hash = '#join=tooshort.abcdefghijklmnopqrstu_';
  boot();

  expect(sessionStorage.getItem('htlgi-l26-join')).toBeNull();
  expect(location.hash).toBe('#join=tooshort.abcdefghijklmnopqrstu_');
});

test('a join link ends the routing: the import half of the same hash is not offered', () => {
  location.hash = '#join=AbCdEfGhIjKlMnOpQrSt.abcdefghijklmnopqrstu_&picks=3,6';
  onHashChange();

  expect(sessionStorage.getItem('htlgi-l26-join')).not.toBeNull();
  expect(useBanner.getState().banner).toBeNull();
  expect(usePlanner.getState().picks.size).toBe(0);
});
