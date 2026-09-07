import {matches, hasFilters} from './filters.js';
const f = {day: '2026-09-19', groups: [], venue: '', topic: '', picksOnly: false, crewOnly: false, q: ''};
const e = {eventNo: 1, date: '2026-09-19', type: 'Debates', venue: 'Arena', topics: ['Mind'], title: 'Free will', speakers: ['Sam'], hosts: [], description: ''};
test('filters compose', () => {
  expect(matches(e, f, new Set(), () => false)).toBe(true);
  expect(matches(e, {...f, day: '2026-09-20'}, new Set(), () => false)).toBe(false);
  expect(matches(e, {...f, groups: ['talks']}, new Set(), () => false)).toBe(false);
  expect(matches(e, {...f, q: 'free'}, new Set(), () => false)).toBe(true);
  expect(matches(e, {...f, picksOnly: true}, new Set([1]), () => false)).toBe(true);
  expect(matches(e, {...f, crewOnly: true}, new Set(), no => no === 1)).toBe(true);
  expect(hasFilters(f)).toBeFalsy();
  expect(hasFilters({...f, venue: 'Arena'})).toBeTruthy();
});
