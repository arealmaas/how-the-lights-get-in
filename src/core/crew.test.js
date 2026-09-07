// Moved from scripts/test/crew-core.test.mjs (the crew half): same assertions, ESM imports.
import {projectForCrew, parseJoinHash, memberColour, pickedBy, crewSummary} from './crew.js';

test('projectForCrew drops notes that are not shared', () => {
  const p = projectForCrew({picks: {3: true}, verdicts: {6: 'Draw'}, notes: {3: 'private', 6: 'shared one', 7: '  '}, shared: {6: true, 7: true}});
  expect(p).toEqual({picks: {3: true}, verdicts: {6: 'Draw'}, notes: {6: 'shared one'}});
  expect(projectForCrew(null)).toEqual({picks: {}, verdicts: {}, notes: {}});
});

test('parseJoinHash accepts only well-formed links', () => {
  const crew = 'AbCdEfGhIjKlMnOpQrSt', token = 'abcdefghijklmnopqrstu_';
  expect(parseJoinHash(`#join=${crew}.${token}`)).toEqual({crew, token});
  expect(parseJoinHash(`#event=3&join=${crew}.${token}&x=1`)).toEqual({crew, token});
  expect(parseJoinHash('#join=short.token')).toBeNull();
  expect(parseJoinHash(`#join=${crew}.${token}extra`)).toBeNull();
  expect(parseJoinHash('')).toBeNull();
});

test('crewSummary finds shared events, splits and one-sided picks', () => {
  const events = [
    {eventNo: 1, date: '2026-09-19', time: '10:00'}, {eventNo: 2, date: '2026-09-19', time: '10:00'},
    {eventNo: 3, date: '2026-09-19', time: '11:00'}, {eventNo: 4, date: '2026-09-20', time: '09:00'},
  ];
  const members = [
    {uid: 'me', name: 'Are', picks: {1: true, 3: true}},
    {uid: 'k', name: 'Kari', picks: {2: true, 3: true}},
    {uid: 'm', name: 'Morten', picks: {3: true, 4: true}},
  ];
  const s = crewSummary(members, 'me', events);
  expect(s.all.map(e => e.eventNo)).toEqual([3]);
  expect(s.split).toEqual([{slot: '2026-09-19 10:00', choices: [{no: 1, names: ['Are']}, {no: 2, names: ['Kari']}]}]);
  expect(s.onlyMe.map(e => e.eventNo)).toEqual([1]);
  expect(s.onlyThem.map(e => e.eventNo)).toEqual([2, 4]);
  expect(pickedBy(members, 'me', 3).map(m => m.name)).toEqual(['Kari', 'Morten']);
  expect(crewSummary([members[0]], 'me', events).all).toEqual([]);
  expect(memberColour(7)).toBe('talks');
});
