import {readingList, readingCount, readingMarkdown, withGoing} from './reading.js';
test('two books per speaker plus the briefing reading', () => {
  const events = [{eventNo: 1, date: '2026-09-19', time: '10:00', title: 'T', people: [{name: 'Sam', slug: 'sam'}]}];
  const extras = {sam: {books: [{title: 'A'}, {title: 'B'}, {title: 'C'}]}};
  const briefings = {1: {reading: [{title: 'R', by: 'X'}]}};
  const items = readingList(events, new Set([1]), extras, briefings);
  expect(items[0].bks.map(b => b.title)).toEqual(['A', 'B']);
  expect(items[0].reads).toEqual([{title: 'R', by: 'X'}]);
  expect(readingCount(items)).toBe(3);
});

test('readingList filters to the picked events only', () => {
  const events = [
    {eventNo: 1, date: '2026-09-19', time: '10:00', title: 'Picked', people: []},
    {eventNo: 2, date: '2026-09-19', time: '11:00', title: 'Not picked', people: []},
  ];
  const items = readingList(events, new Set([1]), {}, {});
  expect(items.map(x => x.e.eventNo)).toEqual([1]);
});

test('readingMarkdown lists each event once, books then briefing reading', () => {
  const items = [{e: {date: '2026-09-19', time: '10:00', title: 'A talk'}, bks: [{who: 'Sam', title: 'A book', year: 2001}], reads: [{title: 'An essay', by: 'X'}]}];
  const md = readingMarkdown(items);
  expect(md).toContain('## Sat 10:00 · A talk');
  expect(md).toContain('Sam: *A book* (2001)');
  expect(md).toContain('An essay — X');
});

test('withGoing marks each reading item with who is going, leaving the rest untouched', () => {
  const items = [{e: {eventNo: 3}, bks: [{who: 'A', title: 'B'}], reads: []}, {e: {eventNo: 9}, bks: [], reads: []}];
  const out = withGoing(items, no => (no === 3 ? ['you', 'Kari'] : []));
  expect(out.map(x => x.going)).toEqual([['you', 'Kari'], []]);
  expect(out[0].bks).toBe(items[0].bks);
  expect(items[0].going).toBeUndefined();   // the input is not mutated
});
