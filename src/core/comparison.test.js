import {test, expect} from 'vitest';
import {conflictGroups, resolveChoice} from './comparison.js';

const ev = (eventNo, time, date = '2026-09-19') => ({eventNo, time, date, type: 'Talks'});
const numbers = groups => groups.map(g => g.events.map(e => e.eventNo));

test('groups both hard and soft clashes, including an indirect overlap chain', () => {
  const events = [ev(30, '11:00'), ev(20, '10:30'), ev(10, '10:00'), ev(11, '10:10')];
  expect(numbers(conflictGroups(events, new Set([10, 11, 20, 30])))).toEqual([[10, 11, 20, 30]]);
});

test('returns chronological, deduplicated groups with deterministic ordering for tied starts', () => {
  const events = [ev(1, '15:00'), ev(8, '09:00'), ev(3, '09:00'), ev(2, '15:15'), ev(8, '09:00'), ev(99, '08:00', '2026-09-20'), ev(100, '08:30', '2026-09-20')];
  const groups = conflictGroups(events, new Set(events.map(e => e.eventNo)));
  expect(numbers(groups)).toEqual([[3, 8], [1, 2], [99, 100]]);
  expect(groups.map(({id, date}) => ({id, date}))).toEqual([
    {id: 3, date: '2026-09-19'},
    {id: 1, date: '2026-09-19'},
    {id: 99, date: '2026-09-20'},
  ]);
});

test('back-to-back sessions, different days, and unpicked sessions do not create groups', () => {
  const events = [ev(1, '10:00'), ev(2, '11:00'), ev(3, '10:00', '2026-09-20'), ev(4, '10:30')];
  expect(conflictGroups(events, new Set([1, 2, 3, 9999]))).toEqual([]);
  expect(conflictGroups(events, new Set())).toEqual([]);
  expect(conflictGroups([], new Set([1]))).toEqual([]);
});

test('an unpicked bridge cannot join two separate groups', () => {
  const events = [ev(1, '10:00'), ev(2, '10:05'), ev(3, '10:50'), ev(4, '11:05'), ev(5, '11:10')];
  expect(numbers(conflictGroups(events, new Set([1, 2, 4, 5])))).toEqual([[1, 2], [4, 5]]);
  expect(numbers(conflictGroups(events, new Set([1, 2, 3, 4, 5])))).toEqual([[1, 2, 3, 4, 5]]);
});

test('choosing a session removes only its picked direct overlaps and preserves both ends of a chain', () => {
  const events = [ev(3, '11:00'), ev(2, '10:30'), ev(1, '10:00'), ev(4, '12:00'), ev(5, '10:00', '2026-09-20'), ev(6, '10:10')];
  const picks = new Set([1, 2, 3, 4, 5]);
  const original = [...picks];
  expect(resolveChoice(events, picks, 1)).toEqual({changes: {1: true, 2: false}, removed: [events[1]]});
  const middle = resolveChoice(events, picks, 2);
  expect(middle.changes).toEqual({1: false, 2: true, 3: false});
  expect(middle.removed.map(e => e.eventNo)).toEqual([1, 3]);
  expect([...picks]).toEqual(original);
  expect(events.map(e => e.eventNo)).toEqual([3, 2, 1, 4, 5, 6]);
});

test('can choose an unpicked known event, deduplicates removals, and ignores unknown choices', () => {
  const events = [ev(1, '10:00'), ev(2, '10:30'), ev(2, '10:30')];
  expect(resolveChoice(events, new Set([2]), 1)).toEqual({changes: {1: true, 2: false}, removed: [events[2]]});
  expect(resolveChoice(events, new Set(), 1)).toEqual({changes: {1: true}, removed: []});
  expect(resolveChoice(events, new Set([1, 2]), 9999)).toEqual({changes: {}, removed: []});
});
