// The masthead's crew button (CREW-SPEC section 7): in a crew, a third button named after the crew and
// counting its plan, so being in a crew shows at the top of every page. It opens My festival at the crew
// cards. Nothing at all outside a crew, which is also the CLOUD-off case.
import {test, expect, beforeEach} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import Masthead from './Masthead.jsx';
import {useCloud} from '../store/cloud.js';
import {usePlanner} from '../store/planner.js';
import {useSheet} from '../store/sheet.js';

const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com'};
const CREW = {
  id: 'c1', name: 'The Heath Three', createdBy: 'u1', picks: {6: 'u2', 12: 'u1', 999999: 'u1'},
  members: [{uid: 'u1', name: 'Are', joinedAt: 1, picks: {}, verdicts: {}, notes: {}}],
  invites: [], removed: [], syncedAt: Date.now(), live: true,
};
const buttons = () => [...document.querySelectorAll('.mast-actions .mbtn')].map(b => b.querySelector('.label').textContent);

beforeEach(() => {
  localStorage.clear();
  useSheet.setState({stack: []});
  usePlanner.setState({picks: new Set([6])});
  useCloud.setState({user: null, accountName: '', marker: null, crewId: null, crew: null});
});

test('without a crew the masthead has its two buttons and no more', () => {
  render(<Masthead />);
  expect(buttons()).toEqual(['My festival', 'Reading list']);
  expect(document.querySelector('.crewbtn')).toBeNull();
});

test('in a crew a third button carries the crew’s name and the size of its plan, and opens the hub at the crew', () => {
  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  render(<Masthead />);

  expect(buttons()).toEqual(['My festival', 'Reading list', 'The Heath Three']);
  const btn = document.querySelector('.mbtn.crewbtn');
  expect(btn.querySelector('svg')).not.toBeNull();
  expect(btn.querySelector('[data-count-crew]')).toHaveTextContent('2');   // 6 and 12; 999999 is not an event
  expect(btn.querySelector('[data-count-crew]')).not.toHaveAttribute('hidden');
  expect(btn).toHaveAttribute('title', 'Your crew: The Heath Three · 2 in the crew’s plan');

  fireEvent.click(btn);
  expect(useSheet.getState().stack.at(-1)).toEqual({kind: 'hub', key: undefined, mode: 'crew'});
});

test('a crew whose name has not arrived yet, and an empty plan, still make a button', () => {
  useCloud.setState({user: USER, crewId: 'c1', crew: {...CREW, name: '', picks: {}}});
  render(<Masthead />);
  expect(screen.getByRole('button', {name: /^Crew$/})).toBeInTheDocument();
  expect(document.querySelector('[data-count-crew]')).toHaveAttribute('hidden');
});

// The cached crew on a cold or offline start is painted on the account marker alone (CREW-SPEC section 6).
test('a cached crew with only the account marker shows the button too', () => {
  useCloud.setState({user: null, marker: {uid: 'u1'}, crewId: 'c1', crew: {...CREW, live: false}});
  render(<Masthead />);
  expect(buttons()).toEqual(['My festival', 'Reading list', 'The Heath Three']);
});
