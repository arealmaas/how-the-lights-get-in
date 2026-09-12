// The notes other members chose to share, beside my own notes box (CREW-SPEC section 7 "Everywhere").
import {test, expect, beforeEach} from 'vitest';
import {render, screen} from '@testing-library/react';
import CrewNotes from './CrewNotes.jsx';
import Sheet from '../Sheet.jsx';
import {useSheet} from '../../store/sheet.js';
import {useCloud} from '../../store/cloud.js';
import {usePlanner} from '../../store/planner.js';

const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com'};
const member = (uid, name, extra = {}) => ({uid, name, joinedAt: 1, picks: {}, verdicts: {}, notes: {}, ...extra});
const crewOf = (...members) => ({
  id: 'c1', name: 'The Heath Three', createdBy: 'u1', members,
  invites: [], removed: [], syncedAt: Date.now(), live: true,
});

beforeEach(() => {
  localStorage.clear();
  useSheet.setState({stack: []});
  usePlanner.setState({picks: new Set(), verdicts: {}, notes: {}, shared: {}});
  useCloud.setState({
    user: USER, accountName: 'Are Almaas', marker: null, crewId: 'c1',
    crew: crewOf(
      member('u1', 'Are', {notes: {6: 'mine, never echoed back at me'}}),
      member('u2', 'Kari', {notes: {6: 'A <b>bold</b> claim\n\nSecond thought'}}),
      member('u3', 'Morten', {notes: {6: '   '}}),   // whitespace only: not a note
    ),
  });
});

test('a shared note appears with its author, as text — markup in it is not markup', () => {
  render(<CrewNotes no={6} />);

  expect(screen.getByRole('heading', {name: 'Crew notes'})).toBeInTheDocument();
  const notes = [...document.querySelectorAll('.crewnote')];
  expect(notes).toHaveLength(1);                               // never my own, never a blank one
  expect(notes[0].querySelector('b').textContent).toBe('Kari');

  const text = notes[0].querySelector('.note-text');
  expect(text.textContent).toBe('A <b>bold</b> claim\n\nSecond thought');
  expect(text.querySelector('b')).toBeNull();
});

test('nothing when nobody shared one, and nothing outside a crew', () => {
  useCloud.setState({crew: crewOf(member('u1', 'Are'), member('u2', 'Kari'))});
  const {unmount} = render(<CrewNotes no={6} />);
  expect(document.querySelector('.crewnote')).toBeNull();
  unmount();

  useCloud.setState({user: null, crew: null, crewId: null});
  render(<CrewNotes no={6} />);
  expect(document.querySelector('.crewnote')).toBeNull();
});

// CREW-SPEC section 7 puts the shared notes with the notes box, not up beside the "Going" row.
test('the event sheet puts it directly after my own notes box', () => {
  useSheet.getState().open('event', 6, 'notes');
  render(<Sheet />);

  const heading = screen.getByRole('heading', {name: 'Crew notes'});
  expect(heading.previousElementSibling).toHaveClass('note-card');
  expect(document.querySelector('textarea.notes')).not.toBeNull();
  expect(heading.compareDocumentPosition(document.querySelector('textarea.notes')))
    .toBe(Node.DOCUMENT_POSITION_PRECEDING);
});
