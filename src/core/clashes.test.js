import {computeClashes} from './clashes.js';
const ev = (no, time) => ({eventNo: no, date: '2026-09-19', time, type: 'Talks'});
test('starts within 15 minutes clash, a 30-minute overlap is soft', () => {
  const events = [ev(1, '10:00'), ev(2, '10:10'), ev(3, '10:30'), ev(4, '12:00')];
  const {clashes, soft} = computeClashes(events, new Set([1, 2, 3, 4]));
  expect([...clashes.keys()].sort()).toEqual([1, 2]);
  expect(soft.get(1).map(x => x.no)).toEqual([3]);
  expect(clashes.has(4)).toBe(false);
});
