import {vi, test, expect, beforeEach} from 'vitest';
vi.mock('./cloud/sync.js', () => ({change: vi.fn()}));
import {boot, onHashChange} from './routing.js';
import {usePlanner} from './store/planner.js';
import {useBanner} from './store/banner.js';
import {useSheet} from './store/sheet.js';

beforeEach(() => {
  localStorage.clear();
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

test('onHashChange picks up an import link the same way boot does', () => {
  location.hash = '#picks=41';
  onHashChange();

  const banner = useBanner.getState().banner;
  expect(banner.text).toContain('1 pick');
});
