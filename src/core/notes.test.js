// Moved from the old node --test suite for the page's shared core (the notes/picks half): same
// assertions, ESM imports.
import {b64u, mergeNoteText, encodeNotesParam, decodeNotesParam, picksToMap, mapToPicks, mergeState} from './notes.js';

test('notes round-trip through the fragment param', () => {
  const notes = {41: 'Ask about the mirror universe paper', 6: 'Café — ünïcode ✓'};
  const {param, dropped} = encodeNotesParam(notes);
  expect(dropped).toEqual([]);
  expect(param).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(decodeNotesParam(param)).toEqual({6: 'Café — ünïcode ✓', 41: 'Ask about the mirror universe paper'});
});

test('longest notes are dropped first when the param is too long', () => {
  const {param, dropped} = encodeNotesParam({1: 'x'.repeat(500), 2: 'short', 3: 'y'.repeat(300)}, 200);
  expect(dropped).toEqual([1, 3]);
  expect(decodeNotesParam(param)).toEqual({2: 'short'});
});

test('empty and blank notes are not carried', () => {
  const {param} = encodeNotesParam({1: '', 2: '   ', 3: 'keep'});
  expect(decodeNotesParam(param)).toEqual({3: 'keep'});
  expect(encodeNotesParam({}).param).toBe('');
});

test('garbage decodes to nothing', () => {
  expect(decodeNotesParam('%%%')).toEqual({});
  expect(decodeNotesParam('')).toEqual({});
  expect(decodeNotesParam(b64u.encode('[1,2]'))).toEqual({});
  expect(decodeNotesParam(b64u.encode('{"abc":"not an event","7":42,"8":"ok"}'))).toEqual({8: 'ok'});
});

test('mergeNoteText keeps both texts only when they differ', () => {
  expect(mergeNoteText('', 'theirs')).toBe('theirs');
  expect(mergeNoteText('mine', '')).toBe('mine');
  expect(mergeNoteText('same ', 'same')).toBe('same ');
  expect(mergeNoteText('mine', 'theirs')).toBe('mine\n\n---\n\ntheirs');
});

test('encodeNotesParam reports how many notes were shortened to 20 000 characters', () => {
  expect(encodeNotesParam({1: 'x'.repeat(20001), 2: 'ok'}).shortened).toBe(1);
  expect(encodeNotesParam({2: 'ok'}).shortened).toBe(0);
});

test('mergeNoteText is idempotent when the incoming text is already included', () => {
  expect(mergeNoteText('mine\n\n---\n\ntheirs', 'theirs')).toBe('mine\n\n---\n\ntheirs');
});

test('picks convert between a Set and a map', () => {
  expect(picksToMap(new Set([3, 41]))).toEqual({3: true, 41: true});
  expect([...mapToPicks({3: true, 41: true, abc: true})].sort((a, b) => a - b)).toEqual([3, 41]);
  expect(picksToMap(['x', 2.5, 7])).toEqual({7: true});
});

test('mergeState unions picks, lets local verdicts win and keeps both note texts', () => {
  const local = {picks: {3: true, 6: true}, verdicts: {6: 'Draw'}, notes: {6: 'from phone', 9: 'phone only'}, shared: {}};
  const remote = {picks: {6: true, 41: true}, verdicts: {6: 'Sabine Hossenfelder', 43: 'Draw'}, notes: {6: 'from laptop', 41: 'laptop only'}, shared: {41: true}};
  const m = mergeState(local, remote);
  expect(m.picks).toEqual({3: true, 6: true, 41: true});
  expect(m.verdicts).toEqual({6: 'Draw', 43: 'Draw'});
  expect(m.notes).toEqual({6: 'from phone\n\n---\n\nfrom laptop', 9: 'phone only', 41: 'laptop only'});
  expect(m.shared).toEqual({41: true});
  expect(m.added).toBe(1);
  expect(mergeState({}, {})).toEqual({picks: {}, verdicts: {}, notes: {}, shared: {}, added: 0});
});
