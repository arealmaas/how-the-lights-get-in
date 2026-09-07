// The crew overlay inside an event sheet (CREW-SPEC section 7 "Everywhere"). Crew state is set straight
// on useCloud, the way a members snapshot would; cloud/crew.js's others() reads the same store.
import {test, expect, beforeEach} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import CrewRow from './CrewRow.jsx';
import Sheet from '../Sheet.jsx';
import {useSheet} from '../../store/sheet.js';
import {useCloud} from '../../store/cloud.js';
import {usePlanner} from '../../store/planner.js';
import {EVENTS} from '../../data/index.js';

const DEBATE = EVENTS.find(e => e.eventNo === 6);        // Debates
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
    user: USER, accountName: 'Are Almaas', crewId: 'c1',
    crew: crewOf(member('u1', 'Are'), member('u2', 'Kari', {picks: {6: true}}), member('u3', 'Morten')),
  });
});

test('who is going, who is not yet, and Join them while I have not picked it', () => {
  render(<CrewRow e={DEBATE} />);

  expect(screen.getByText('Going: Kari · not yet: Morten')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: 'Join them'}));
  expect(usePlanner.getState().picks.has(6)).toBe(true);
});

// CREW-SPEC section 7's example line is "Going: Are, Kari · not yet: Morten": my own name leads the list
// once I have picked it, and "not yet" only ever names the others.
test('once I have picked it my own account name leads the list and Join them is gone', () => {
  usePlanner.setState({picks: new Set([6])});
  useCloud.setState({crew: crewOf(member('u1', 'Are', {picks: {6: true}}), member('u2', 'Kari', {picks: {6: true}}), member('u3', 'Morten'))});
  render(<CrewRow e={DEBATE} />);

  expect(screen.getByText('Going: Are Almaas, Kari · not yet: Morten')).toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Join them'})).toBeNull();
});

test('with no account name I am written as "you"', () => {
  usePlanner.setState({picks: new Set([6])});
  useCloud.setState({accountName: '', crew: crewOf(member('u1', 'Are'), member('u2', 'Kari', {picks: {6: true}}))});
  render(<CrewRow e={DEBATE} />);
  expect(screen.getByText('Going: you, Kari')).toBeInTheDocument();
});

// I have starred it locally but my member document has not caught up: Join them still asks about them.
test('Join them stays hidden on my own pick even before the member document catches up', () => {
  usePlanner.setState({picks: new Set([6])});
  useCloud.setState({crew: crewOf(member('u1', 'Are'), member('u2', 'Kari'), member('u3', 'Morten'))});
  render(<CrewRow e={DEBATE} />);

  expect(screen.getByText('Going: Are Almaas · not yet: Kari, Morten')).toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Join them'})).toBeNull();
});

test('nobody yet, and a crew of one, each get their own line', () => {
  useCloud.setState({crew: crewOf(member('u1', 'Are'), member('u2', 'Kari'))});
  const {unmount} = render(<CrewRow e={DEBATE} />);
  expect(screen.getByText('Nobody in the crew has picked this yet.')).toBeInTheDocument();
  unmount();

  useCloud.setState({crew: crewOf(member('u1', 'Are'))});
  render(<CrewRow e={DEBATE} />);
  expect(screen.getByText('You are the only one in the crew so far.')).toBeInTheDocument();
});

test('a shared note appears under Crew notes with its author, as text — markup in it is not markup', () => {
  useCloud.setState({crew: crewOf(
    member('u1', 'Are', {notes: {6: 'mine, never echoed back at me'}}),
    member('u2', 'Kari', {picks: {6: true}, notes: {6: 'A <b>bold</b> claim\n\nSecond thought'}}),
    member('u3', 'Morten', {notes: {6: '   '}}),   // whitespace only: not a note
  )});
  render(<CrewRow e={DEBATE} />);

  expect(screen.getByRole('heading', {name: 'Crew notes'})).toBeInTheDocument();
  const notes = [...document.querySelectorAll('.crewnote')];
  expect(notes).toHaveLength(1);
  expect(notes[0].querySelector('b').textContent).toBe('Kari');

  const ps = [...notes[0].querySelectorAll('p')];
  expect(ps.map(p => p.textContent)).toEqual(['A <b>bold</b> claim', 'Second thought']);
  expect(ps.some(p => p.querySelector('b'))).toBe(false);   // the <b> is text, not an element
});

test('signed out, or with no crew, the row is not built at all', () => {
  useCloud.setState({crew: null, crewId: null});
  const {unmount} = render(<CrewRow e={DEBATE} />);
  expect(document.querySelector('.going')).toBeNull();
  unmount();

  useCloud.setState({user: null});
  render(<CrewRow e={DEBATE} />);
  expect(document.querySelector('.going')).toBeNull();
});

// CREW-SPEC section 7: "a 'Going' row under the people pills".
test('the event sheet puts it directly under the people pills', () => {
  useSheet.getState().open('event', 6);
  render(<Sheet />);

  const going = document.querySelector('.going');
  expect(going).toHaveTextContent('Going: Kari · not yet: Morten');
  expect(going.previousElementSibling).toHaveClass('people');
  expect(going.nextElementSibling).toHaveClass('desc');
});
