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
test('setPicks applies a comparison choice in one update, one persistence write, and one sync', () => {
  const notes = {3: 'Keep my notes'}, verdicts = {6: 'Draw'}, shared = {3: true};
  usePlanner.setState({picks: new Set([3, 6, 7]), notes, verdicts, shared});
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  const observed = [];
  const unsubscribe = usePlanner.subscribe(s => observed.push([...s.picks]));
  try {
    expect(usePlanner.getState().setPicks({3: false, 6: false, 41: true, 7: true})).toBe(true);
    expect(observed).toEqual([[7, 41]]);
    expect(JSON.parse(localStorage.getItem(LS.picks))).toEqual([7, 41]);
    expect(storage).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith({'picks.3': DEL, 'picks.6': DEL, 'picks.41': true}, {'picks.3': DEL, 'picks.6': DEL, 'picks.41': true});
    expect(usePlanner.getState().notes).toBe(notes);
    expect(usePlanner.getState().verdicts).toBe(verdicts);
    expect(usePlanner.getState().shared).toBe(shared);
  } finally { storage.mockRestore(); unsubscribe(); }
});
test('setPicks ignores invalid values and event numbers while applying valid changes', () => {
  usePlanner.getState().setPicks({3: true, 6: 'true', 7: 1, 41: null, 999999: true, bogus: true});
  expect([...usePlanner.getState().picks]).toEqual([3]);
  expect(change).toHaveBeenCalledTimes(1);
  expect(change).toHaveBeenCalledWith({'picks.3': true}, {'picks.3': true});
});
test('setPicks does not update, persist, or sync when nothing valid changes', () => {
  usePlanner.setState({picks: new Set([3])});
  const before = usePlanner.getState().picks;
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  const listener = vi.fn(), unsubscribe = usePlanner.subscribe(listener);
  try {
    expect(usePlanner.getState().setPicks({3: true, 6: false, 999999: true, 7: 'false'})).toBe(false);
    expect(usePlanner.getState().setPicks({})).toBe(false);
    expect(usePlanner.getState().setPicks(null)).toBe(false);
    expect(usePlanner.getState().picks).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
  } finally { storage.mockRestore(); unsubscribe(); }
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
test('a note reports a failed local save while preserving the text for recovery', () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage full'); });
  try {
    expect(usePlanner.getState().setNote(6, 'Keep this thought').local).toBe(false);
    expect(usePlanner.getState().notes[6]).toBe('Keep this thought');
    expect(change).toHaveBeenLastCalledWith({'notes.6': 'Keep this thought'}, null);
  } finally { storage.mockRestore(); }
});
test('importFromLink unions and syncs once', () => {
  usePlanner.getState().importFromLink({picks: [3, 6], verdicts: {6: 'Draw'}, notes: {6: 'n'}}, (a, b) => b);
  expect(change).toHaveBeenCalledTimes(1);
  expect(change.mock.calls[0][0]).toEqual({'picks.3': true, 'picks.6': true, 'verdicts.6': 'Draw', 'notes.6': 'n'});
});
