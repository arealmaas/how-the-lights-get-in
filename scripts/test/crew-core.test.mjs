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
