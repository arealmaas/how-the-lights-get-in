import {icsFile, eventTimes, calDescription} from './calendar.js';
const e = {id: 'ev-9', eventNo: 9, title: 'Test, with; commas', type: 'Talks', venue: 'Ring', date: '2026-09-19', time: '14:30', speakers: ['A B'], hosts: [], topics: ['t'], description: 'd', ticketing: 'included', url: 'https://x/e', people: [], links: []};
test('times are exported in UTC with a one-hour London offset', () => {
  expect(eventTimes(e)).toEqual({start: '20260919T133000Z', end: '20260919T143000Z', dur: 60});
});
test('the ics file has the calendar wrapper, one event, escaped text and folded lines', () => {
  const ics = icsFile([e], 'HTLGI London 2026');
  expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
  expect(ics).toContain('UID:htlgi-london-2026-ev-9@arealmaas.github.io');
  expect(ics).toContain('SUMMARY:Test\\, with\\; commas');
  expect(ics.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75)).toBe(true);
  expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
});
test('a prefix goes first in the description', () => {
  expect(calDescription(e, 'Going: you, Kari').startsWith('Going: you, Kari\n\n')).toBe(true);
});
