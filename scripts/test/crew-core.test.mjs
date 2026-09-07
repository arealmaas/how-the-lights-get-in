import test from 'node:test';
import assert from 'node:assert/strict';
import CrewCore from '../crew-core.js';

test('notes round-trip through the fragment param', () => {
  const notes = {41: 'Ask about the mirror universe paper', 6: 'Café — ünïcode ✓'};
  const {param, dropped} = CrewCore.encodeNotesParam(notes);
  assert.deepEqual(dropped, []);
  assert.match(param, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(CrewCore.decodeNotesParam(param), {6: 'Café — ünïcode ✓', 41: 'Ask about the mirror universe paper'});
});

test('longest notes are dropped first when the param is too long', () => {
  const {param, dropped} = CrewCore.encodeNotesParam({1: 'x'.repeat(500), 2: 'short', 3: 'y'.repeat(300)}, 200);
  assert.deepEqual(dropped, [1, 3]);
  assert.deepEqual(CrewCore.decodeNotesParam(param), {2: 'short'});
});

test('empty and blank notes are not carried', () => {
  const {param} = CrewCore.encodeNotesParam({1: '', 2: '   ', 3: 'keep'});
  assert.deepEqual(CrewCore.decodeNotesParam(param), {3: 'keep'});
  assert.equal(CrewCore.encodeNotesParam({}).param, '');
});

test('garbage decodes to nothing', () => {
  assert.deepEqual(CrewCore.decodeNotesParam('%%%'), {});
  assert.deepEqual(CrewCore.decodeNotesParam(''), {});
  assert.deepEqual(CrewCore.decodeNotesParam(CrewCore.b64u.encode('[1,2]')), {});
  assert.deepEqual(CrewCore.decodeNotesParam(CrewCore.b64u.encode('{"abc":"not an event","7":42,"8":"ok"}')), {8: 'ok'});
});

test('mergeNoteText keeps both texts only when they differ', () => {
  assert.equal(CrewCore.mergeNoteText('', 'theirs'), 'theirs');
  assert.equal(CrewCore.mergeNoteText('mine', ''), 'mine');
  assert.equal(CrewCore.mergeNoteText('same ', 'same'), 'same ');
  assert.equal(CrewCore.mergeNoteText('mine', 'theirs'), 'mine\n\n---\n\ntheirs');
});

test('encodeNotesParam reports how many notes were shortened to 20 000 characters', () => {
  assert.equal(CrewCore.encodeNotesParam({1: 'x'.repeat(20001), 2: 'ok'}).shortened, 1);
  assert.equal(CrewCore.encodeNotesParam({2: 'ok'}).shortened, 0);
});

test('mergeNoteText is idempotent when the incoming text is already included', () => {
  assert.equal(CrewCore.mergeNoteText('mine\n\n---\n\ntheirs', 'theirs'), 'mine\n\n---\n\ntheirs');
});

test('picks convert between a Set and a map', () => {
  assert.deepEqual(CrewCore.picksToMap(new Set([3, 41])), {3: true, 41: true});
  assert.deepEqual([...CrewCore.mapToPicks({3: true, 41: true, abc: true})].sort((a, b) => a - b), [3, 41]);
  assert.deepEqual(CrewCore.picksToMap(['x', 2.5, 7]), {7: true});
});

test('mergeState unions picks, lets local verdicts win and keeps both note texts', () => {
  const local = {picks: {3: true, 6: true}, verdicts: {6: 'Draw'}, notes: {6: 'from phone', 9: 'phone only'}, shared: {}};
  const remote = {picks: {6: true, 41: true}, verdicts: {6: 'Sabine Hossenfelder', 43: 'Draw'}, notes: {6: 'from laptop', 41: 'laptop only'}, shared: {41: true}};
  const m = CrewCore.mergeState(local, remote);
  assert.deepEqual(m.picks, {3: true, 6: true, 41: true});
  assert.deepEqual(m.verdicts, {6: 'Draw', 43: 'Draw'});
  assert.deepEqual(m.notes, {6: 'from phone\n\n---\n\nfrom laptop', 9: 'phone only', 41: 'laptop only'});
  assert.deepEqual(m.shared, {41: true});
  assert.equal(m.added, 1);
  assert.deepEqual(CrewCore.mergeState({}, {}), {picks: {}, verdicts: {}, notes: {}, shared: {}, added: 0});
});

test('projectForCrew drops notes that are not shared', () => {
  const p = CrewCore.projectForCrew({picks: {3: true}, verdicts: {6: 'Draw'}, notes: {3: 'private', 6: 'shared one', 7: '  '}, shared: {6: true, 7: true}});
  assert.deepEqual(p, {picks: {3: true}, verdicts: {6: 'Draw'}, notes: {6: 'shared one'}});
  assert.deepEqual(CrewCore.projectForCrew(null), {picks: {}, verdicts: {}, notes: {}});
});

test('parseJoinHash accepts only well-formed links', () => {
  const crew = 'AbCdEfGhIjKlMnOpQrSt', token = 'abcdefghijklmnopqrstu_';
  assert.deepEqual(CrewCore.parseJoinHash(`#join=${crew}.${token}`), {crew, token});
  assert.deepEqual(CrewCore.parseJoinHash(`#event=3&join=${crew}.${token}&x=1`), {crew, token});
  assert.equal(CrewCore.parseJoinHash('#join=short.token'), null);
  assert.equal(CrewCore.parseJoinHash(`#join=${crew}.${token}extra`), null);
  assert.equal(CrewCore.parseJoinHash(''), null);
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
  const s = CrewCore.crewSummary(members, 'me', events);
  assert.deepEqual(s.all.map(e => e.eventNo), [3]);
  assert.deepEqual(s.split, [{slot: '2026-09-19 10:00', choices: [{no: 1, names: ['Are']}, {no: 2, names: ['Kari']}]}]);
  assert.deepEqual(s.onlyMe.map(e => e.eventNo), [1]);
  assert.deepEqual(s.onlyThem.map(e => e.eventNo), [2, 4]);
  assert.deepEqual(CrewCore.pickedBy(members, 'me', 3).map(m => m.name), ['Kari', 'Morten']);
  assert.deepEqual(CrewCore.crewSummary([members[0]], 'me', events).all, []);
  assert.equal(CrewCore.memberColour(7), 'talks');
});
