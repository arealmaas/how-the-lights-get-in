import {parseImportHash, picksLink, safeDecode, notesMarkdown} from './exports.js';
const byNo = new Map([[3, {}], [6, {}], [41, {}]]);
test('an import hash yields picks, verdicts and notes; garbage is ignored', () => {
  const r = parseImportHash('#picks=3,6,999&verdicts=6:Draw;7:X;41:&notes=', byNo);
  expect(r.picks).toEqual([3, 6]);
  expect(r.verdicts).toEqual({6: 'Draw'});
  expect(r.notes).toEqual({});
  expect(parseImportHash('#event=3', byNo)).toBeNull();
});
test('picksLink carries sorted picks and encoded verdicts', () => {
  expect(picksLink('https://x/', new Set([41, 3]), {6: 'A B'})).toBe('https://x/#picks=3,41&verdicts=6:A%20B');
});
test('safeDecode never throws', () => { expect(safeDecode('%E0%A4%A')).toBe(''); });

test('notesMarkdown lists picked events and events with notes only, grouped by day', () => {
  const events = [
    {eventNo: 1, date: '2026-09-19', time: '10:00', title: 'Free will', type: 'Debates', venue: 'Arena', speakers: ['Sam'], hosts: []},
    {eventNo: 2, date: '2026-09-20', time: '11:00', title: 'A talk', type: 'Talks', venue: 'Ring', speakers: [], hosts: []},
    {eventNo: 3, date: '2026-09-20', time: '12:00', title: 'Not involved', type: 'Talks', venue: 'Ring', speakers: [], hosts: []},
  ];
  const picks = new Set([1]);
  const notes = {2: 'worth a note'};
  const verdicts = {1: 'Draw'};
  const md = notesMarkdown(events, picks, notes, verdicts);
  expect(md).toContain('## Saturday 2026-09-19');
  expect(md).toContain('### 10:00 · Free will ★');
  expect(md).toContain('Verdict: **Draw**');
  expect(md).toContain('## Sunday 2026-09-20');
  expect(md).toContain('### 11:00 · A talk');
  expect(md).toContain('worth a note');
  expect(md).not.toContain('Not involved');
});
