// The reading list's Mine / Crew toggle (CREW-SPEC section 7 "My festival crew section").
import {test, expect, beforeEach} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import ReadingSheet from './ReadingSheet.jsx';
import Sheet from '../Sheet.jsx';
import {useSheet} from '../../store/sheet.js';
import {useCloud} from '../../store/cloud.js';
import {usePlanner} from '../../store/planner.js';
import {EVENTS} from '../../data/index.js';

const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com'};
const member = (uid, name, picks = {}) => ({uid, name, joinedAt: 1, picks, verdicts: {}, notes: {}});
// the plan is 12 (Kari has starred it) and 41 (nobody has); my own pick 6 is not in it
const CREW = {
  id: 'c1', name: 'The Heath Three', createdBy: 'u1', picks: {12: 'u2', 41: 'u1'},
  members: [member('u1', 'Are', {6: true}), member('u2', 'Kari', {12: true})],
  invites: [], removed: [], syncedAt: Date.now(), live: true,
};
const lines = () => [...document.querySelectorAll('.rl-ev .t')].map(el => el.textContent);

beforeEach(() => {
  localStorage.clear();
  useSheet.setState({stack: []});
  usePlanner.setState({picks: new Set([6]), verdicts: {}, notes: {}, shared: {}});
  useCloud.setState({user: null, accountName: 'Are', marker: null, crewId: null, crew: null});
});

test('without a crew there are no tabs and the list is only mine', () => {
  render(<ReadingSheet />);
  expect(document.querySelector('.tabs')).toBeNull();
  expect(lines()).toHaveLength(1);
});

test('Crew lists the crew’s plan and ends each line with who is going', () => {
  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  render(<ReadingSheet />);

  expect(screen.getByRole('button', {name: 'Mine'})).toHaveAttribute('aria-pressed', 'true');
  expect(lines()).toHaveLength(1);
  expect(lines()[0]).not.toContain('you');

  fireEvent.click(screen.getByRole('button', {name: 'Crew'}));
  expect(screen.getByRole('button', {name: 'Crew'})).toHaveAttribute('aria-pressed', 'true');

  const titles = [...document.querySelectorAll('.rl-ev h4')].map(el => el.textContent);
  expect(titles).toHaveLength(2);                                                          // 12 and 41: the plan, not my pick 6
  expect(titles).not.toContain(EVENTS.find(e => e.eventNo === 6).title);
  const line = no => document.querySelectorAll('.rl-ev')[titles.indexOf(EVENTS.find(e => e.eventNo === no).title)].querySelector('.t').textContent;
  expect(line(12)).toMatch(/· Kari$/);                                                     // who has starred it
  expect(line(41)).not.toMatch(/·\s*$/);                                                   // nobody yet: no trailing names
  expect(screen.getByText(/Built from the crew’s plan/)).toBeInTheDocument();
});

test('an empty plan says so on the Crew tab', () => {
  useCloud.setState({user: USER, crewId: 'c1', crew: {...CREW, picks: {}}});
  render(<ReadingSheet mode="crew" />);
  expect(lines()).toHaveLength(0);
  expect(screen.getByText(/Nothing in the crew’s plan yet/)).toBeInTheDocument();
});

// CREW-SPEC section 7: the hub's "Crew reading list" is the crew list, so it opens on the Crew tab.
test('an opening mode of crew selects the Crew tab from the start', () => {
  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  render(<ReadingSheet mode="crew" />);

  expect(screen.getByRole('button', {name: 'Crew'})).toHaveAttribute('aria-pressed', 'true');
  expect(lines()).toHaveLength(2);
});

test('the sheet stack carries that mode through to the tab', () => {
  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  useSheet.getState().open('reading', undefined, 'crew');
  render(<Sheet />);

  expect(screen.getByRole('button', {name: 'Crew'})).toHaveAttribute('aria-pressed', 'true');
  expect(lines()).toHaveLength(2);
});

test('opened without a mode it is still Mine', () => {
  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  useSheet.getState().open('reading');
  render(<Sheet />);

  expect(screen.getByRole('button', {name: 'Mine'})).toHaveAttribute('aria-pressed', 'true');
  expect(lines()).toHaveLength(1);
});

test('switching tab clears a stale "Copied" — the two tabs are two different lists', async () => {
  Object.defineProperty(navigator, 'clipboard', {value: {writeText: () => Promise.resolve()}, configurable: true});
  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  render(<ReadingSheet />);

  fireEvent.click(screen.getByRole('button', {name: 'Copy as text'}));
  await screen.findByRole('button', {name: 'Copied'});

  fireEvent.click(screen.getByRole('button', {name: 'Crew'}));
  expect(screen.getByRole('button', {name: 'Copy as text'})).toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Copied'})).toBeNull();
});
