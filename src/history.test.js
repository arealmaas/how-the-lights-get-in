import {afterEach, beforeEach, expect, test, vi} from 'vitest';
import {HISTORY_KEY, startSheetHistory} from './history.js';
import {useSheet} from './store/sheet.js';
import {usePlanner} from './store/planner.js';
import {useBanner} from './store/banner.js';
import {boot} from './routing.js';
import {byNo} from './data/index.js';

vi.mock('./cloud/auth.js', () => ({loadFirebase: vi.fn(() => Promise.reject(new Error('cloud features are off')))}));
vi.mock('./cloud/crew.js', () => ({SS_JOIN: 'htlgi-l26-join', offerJoin: vi.fn()}));
vi.mock('./cloud/sync.js', () => ({change: vi.fn()}));

let stop;
beforeEach(() => {
  history.replaceState(null, '', '/');
  localStorage.clear();
  sessionStorage.clear();
  useSheet.setState({stack: []});
  usePlanner.setState({day: '2026-09-19', picks: new Set(), notes: {}, verdicts: {}, shared: {}});
  useBanner.setState({banner: null});
});
afterEach(() => { stop?.(); stop = null; vi.restoreAllMocks(); });

test('replaceTop updates the current visit without adding a duplicate Back step', async () => {
  stop = startSheetHistory(boot);
  useSheet.getState().open('hub');
  const hub = useSheet.getState().stack[0];
  useSheet.getState().open('reading');
  const length = history.length;
  useSheet.getState().replaceTop('reading', undefined, 'crew');
  expect(history.length).toBe(length);
  expect(history.state[HISTORY_KEY].index).toBe(2);
  expect(useSheet.getState().stack.at(-1).mode).toBe('crew');
  history.back();
  await vi.waitFor(() => expect(history.state[HISTORY_KEY].index).toBe(1));
  expect(useSheet.getState().stack).toEqual([hub]);
  expect(useSheet.getState().stack[0]).toBe(hub);
});

test('reload restores nested public descriptors without growing history', () => {
  stop = startSheetHistory(boot);
  useSheet.getState().open('event', 6);
  const person = byNo.get(6).people.find(p => p.slug);
  useSheet.getState().open('speaker', person.slug);
  const length = history.length;
  stop();
  useSheet.setState({stack: []});
  stop = startSheetHistory(boot);
  expect(history.length).toBe(length);
  expect(useSheet.getState().stack).toEqual([{kind: 'event', key: 6}, {kind: 'speaker', key: person.slug}]);
  expect(location.hash).toBe('#event=6');
});

test('rapid Close does not overshoot and a new action waits for the base traversal', () => {
  stop = startSheetHistory(boot);
  const base = history.state;
  useSheet.getState().open('event', 6);
  useSheet.getState().open('reading');
  const go = vi.spyOn(history, 'go').mockImplementation(() => {});
  useSheet.getState().close();
  useSheet.getState().close();
  useSheet.getState().back();
  expect(go).toHaveBeenCalledExactlyOnceWith(-2);
  expect(useSheet.getState().stack).toEqual([]);
  useSheet.getState().open('hub');
  expect(useSheet.getState().stack).toEqual([]);
  history.replaceState(base, '', '/');
  dispatchEvent(new PopStateEvent('popstate', {state: base}));
  expect(useSheet.getState().stack).toEqual([{kind: 'hub', key: undefined}]);
  expect(history.state[HISTORY_KEY].index).toBe(1);
});

test('a combined event/import link is scrubbed before history is created and remains shareable', () => {
  history.replaceState({otherFeature: 'preserved'}, '', '/#event=6&picks=3,6&verdicts=6:Draw');
  stop = startSheetHistory(boot);
  expect(location.hash).toBe('#event=6');
  expect(history.state.otherFeature).toBe('preserved');
  expect(JSON.stringify(history.state)).not.toContain('Draw');
  expect(useSheet.getState().stack).toHaveLength(1);
  const accept = useBanner.getState().banner.actions[0];
  useSheet.getState().open('event', 80);
  accept.onClick();
  expect(location.hash).toBe('#event=80');
  expect(usePlanner.getState().picks).toEqual(new Set([3, 6]));
});

test('invalid saved descriptors establish a fresh safe base instead of using a bogus rewind distance', () => {
  history.replaceState({[HISTORY_KEY]: {version: 1, chain: 'bad', index: 999, base: '/', stack: [{id: 'bad', kind: 'event', key: 9999}]}}, '', '/#event=6');
  stop = startSheetHistory(boot);
  expect(history.state[HISTORY_KEY].index).toBe(1);
  expect(useSheet.getState().stack).toEqual([{kind: 'event', key: 6}]);
  const go = vi.spyOn(history, 'go').mockImplementation(() => {});
  useSheet.getState().close();
  expect(go).toHaveBeenCalledExactlyOnceWith(-1);
});
