// The crew's verdicts on a debate, beneath my own vote (CREW-SPEC section 7 "Everywhere").
import {test, expect, beforeEach} from 'vitest';
import {render, screen} from '@testing-library/react';
import CrewTally from './CrewTally.jsx';
import Sheet from '../Sheet.jsx';
import {useSheet} from '../../store/sheet.js';
import {useCloud} from '../../store/cloud.js';
import {usePlanner} from '../../store/planner.js';
import {EVENTS} from '../../data/index.js';

const DEBATE = EVENTS.find(e => e.eventNo === 6);
const TALK = EVENTS.find(e => e.eventNo === 1);            // Inner Circle: never a verdict
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
    crew: crewOf(
      member('u1', 'Are', {verdicts: {6: 'Hossenfelder'}}),
      member('u2', 'Kari', {verdicts: {6: 'Draw'}}),
      member('u3', 'Morten', {verdicts: {6: 'Hossenfelder'}}),
    ),
  });
});

test('the tally names each member who voted, and never my own vote', () => {
  render(<CrewTally e={DEBATE} />);
  const tally = document.querySelector('p.tally');
  expect(tally).toHaveTextContent('Crew verdicts — Kari: Draw · Morten: Hossenfelder');
  expect(tally.textContent.startsWith('Crew verdicts — Kari')).toBe(true);   // my own vote is the block above
});

test('nothing for a non-debate, nothing before anyone votes, nothing outside a crew', () => {
  const a = render(<CrewTally e={TALK} />);
  expect(document.querySelector('p.tally')).toBeNull();
  a.unmount();

  useCloud.setState({crew: crewOf(member('u1', 'Are'), member('u2', 'Kari'))});
  const b = render(<CrewTally e={DEBATE} />);
  expect(document.querySelector('p.tally')).toBeNull();
  b.unmount();

  useCloud.setState({user: null, crew: null, crewId: null});
  render(<CrewTally e={DEBATE} />);
  expect(document.querySelector('p.tally')).toBeNull();
});

// CREW-SPEC section 7: "the verdict block shows the crew tally beneath your own vote".
test('the event sheet puts it directly beneath my own verdict pills', () => {
  useSheet.getState().open('event', 6);
  render(<Sheet />);

  expect(screen.getByText('Who won?')).toBeInTheDocument();
  const tally = document.querySelector('p.tally');
  expect(tally).toHaveTextContent('Crew verdicts — Kari: Draw');
  expect(tally.previousElementSibling).toHaveClass('verdict');
  expect(tally.nextElementSibling.tagName).toBe('TEXTAREA');
});
