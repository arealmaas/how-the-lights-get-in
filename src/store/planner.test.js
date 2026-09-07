import {vi, beforeEach, test, expect} from 'vitest';
vi.mock('../cloud/sync.js', () => ({change: vi.fn()}));
import {change} from '../cloud/sync.js';
import {usePlanner, DEL, LS} from './planner.js';

beforeEach(() => { localStorage.clear(); usePlanner.setState({picks: new Set(), verdicts: {}, notes: {}, shared: {}}); change.mockClear(); });

test('togglePick persists and syncs a field-level change', () => {
  usePlanner.getState().togglePick(3);
  expect(usePlanner.getState().picks.has(3)).toBe(true);
  expect(JSON.parse(localStorage.getItem(LS.picks))).toEqual([3]);
  expect(change).toHaveBeenLastCalledWith({'picks.3': true}, {'picks.3': true});
  usePlanner.getState().togglePick(3);
  expect(change).toHaveBeenLastCalledWith({'picks.3': DEL}, {'picks.3': DEL});
});
test('notes are capped and shared notes reach the member projection', () => {
  usePlanner.getState().setShared(6, true);
  usePlanner.getState().setNote(6, 'x'.repeat(20005));
  expect(usePlanner.getState().notes[6].length).toBe(20000);
  expect(change).toHaveBeenLastCalledWith({'notes.6': 'x'.repeat(20000)}, {'notes.6': 'x'.repeat(20000)});
  usePlanner.getState().setNote(7, 'private');
  expect(change).toHaveBeenLastCalledWith({'notes.7': 'private'}, null);
});
test('replaceFromAccount keeps the note being typed and reports whether anything changed', () => {
  usePlanner.getState().setNote(6, 'typing');
  const changed = usePlanner.getState().replaceFromAccount({picks: {3: true}, verdicts: {}, notes: {6: 'server', 41: 'other'}, shared: {}}, 6);
  expect(changed).toBe(true);
  expect(usePlanner.getState().notes).toEqual({6: 'typing', 41: 'other'});
  expect(usePlanner.getState().replaceFromAccount({picks: {3: true}, verdicts: {}, notes: {6: 'typing', 41: 'other'}, shared: {}}, null)).toBe(false);
});
test('importFromLink unions and syncs once', () => {
  usePlanner.getState().importFromLink({picks: [3, 6], verdicts: {6: 'Draw'}, notes: {6: 'n'}}, (a, b) => b);
  expect(change).toHaveBeenCalledTimes(1);
  expect(change.mock.calls[0][0]).toEqual({'picks.3': true, 'picks.6': true, 'verdicts.6': 'Draw', 'notes.6': 'n'});
});
