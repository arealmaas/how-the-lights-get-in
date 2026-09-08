// The pure half of the move page (move/main.js): what the "open the new site with my picks and notes"
// button puts in the link. The page itself is three DOM lines around this.
import {test, expect} from 'vitest';
import {mergeCarry, parseVerdicts, encodeVerdicts} from './carry.js';

test('picks are the union of this browser and the link, without duplicates', () => {
  const r = mergeCarry({picks: [3, 41]}, {picks: ['41', '6']});
  expect(r.picks).toEqual([3, 41, 6]);
});

// The Phase 0 ruling: union of picks, and an incoming verdict wins nothing over one already held here.
test('verdicts are the union, and a verdict already held here is never overwritten', () => {
  const r = mergeCarry({verdicts: {6: 'Hossenfelder'}}, {verdicts: {6: 'Draw', 41: 'Draw'}});
  expect(r.verdicts).toEqual({6: 'Hossenfelder', 41: 'Draw'});
});

test('a link with verdicts and none held here carries the link’s; none either side carries nothing', () => {
  expect(mergeCarry({picks: [3]}, {verdicts: {6: 'Draw'}}).verdicts).toEqual({6: 'Draw'});
  expect(mergeCarry({picks: [3]}, {}).verdicts).toEqual({});
});

// `#picks=` with nothing after it splits to [''], and Number('') is 0: an event that does not exist.
test('an empty or ragged picks parameter yields no picks at all, and never a zero', () => {
  expect(mergeCarry({picks: []}, {picks: ''.split(',')}).picks).toEqual([]);
  expect(mergeCarry({}, {picks: ['', ' ', 'x', '-3', '3.5', 'NaN']}).picks).toEqual([]);
  expect(mergeCarry({picks: [3, null, undefined, NaN]}, {}).picks).toEqual([3]);
});

test('mergeCarry copes with nothing on either side', () => {
  expect(mergeCarry(null, null)).toEqual({picks: [], verdicts: {}, notes: {}});
});

test('verdicts survive the round trip through the parameter, encoded and back', () => {
  const verdicts = {6: 'Sabine Hossenfelder', 41: 'Draw', 7: 'A; B: C'};
  expect(parseVerdicts(encodeVerdicts(verdicts))).toEqual(verdicts);
});

test('a ragged verdicts parameter drops what it cannot read rather than throwing', () => {
  expect(parseVerdicts('6:Draw;7;:x;x:y;41:')).toEqual({6: 'Draw'});
  expect(parseVerdicts('6:%E0%A4%A')).toEqual({});   // unreadable, so not carried — never re-encoded as "6:"
  expect(parseVerdicts('')).toEqual({});
  expect(parseVerdicts(null)).toEqual({});
});

// A #notes= link opened in a browser that has notes of its own: the same rule the app's import uses, so a
// note held here is kept, a friend's different text is appended under a rule, and a new note is added.
test('notes from the link are merged the way the app merges a #notes= import', () => {
  const r = mergeCarry({notes: {41: 'mine'}}, {notes: {41: 'theirs', 6: 'new'}});
  expect(r.notes).toEqual({41: 'mine\n\n---\n\ntheirs', 6: 'new'});
  expect(mergeCarry({notes: {41: 'same'}}, {notes: {41: 'same'}}).notes).toEqual({41: 'same'});
  expect(mergeCarry({notes: {41: 'kept'}}, {}).notes).toEqual({41: 'kept'});
  expect(mergeCarry({}, {notes: {6: 'only theirs'}}).notes).toEqual({6: 'only theirs'});
});
