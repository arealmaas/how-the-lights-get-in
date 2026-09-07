// The reading list's Mine / Crew toggle (CREW-SPEC section 7 "My festival crew section").
import {test, expect, beforeEach} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import ReadingSheet from './ReadingSheet.jsx';
import {useCloud} from '../../store/cloud.js';
import {usePlanner} from '../../store/planner.js';

const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com'};
const member = (uid, name, picks = {}) => ({uid, name, joinedAt: 1, picks, verdicts: {}, notes: {}});
const CREW = {
  id: 'c1', name: 'The Heath Three', createdBy: 'u1',
  members: [member('u1', 'Are', {6: true}), member('u2', 'Kari', {12: true})],
  invites: [], removed: [], syncedAt: Date.now(), live: true,
};
const lines = () => [...document.querySelectorAll('.rl-ev .t')].map(el => el.textContent);

beforeEach(() => {
  localStorage.clear();
  usePlanner.setState({picks: new Set([6]), verdicts: {}, notes: {}, shared: {}});
  useCloud.setState({user: null, accountName: '', crewId: null, crew: null});
});

test('without a crew there are no tabs and the list is only mine', () => {
  render(<ReadingSheet />);
  expect(document.querySelector('.tabs')).toBeNull();
  expect(lines()).toHaveLength(1);
});

test('Crew lists the union of the picks and ends each line with who is going', () => {
  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  render(<ReadingSheet />);

  expect(screen.getByRole('button', {name: 'Mine'})).toHaveAttribute('aria-pressed', 'true');
  expect(lines()).toHaveLength(1);
  expect(lines()[0]).not.toContain('you');

  fireEvent.click(screen.getByRole('button', {name: 'Crew'}));
  expect(screen.getByRole('button', {name: 'Crew'})).toHaveAttribute('aria-pressed', 'true');

  const crewLines = lines();
  expect(crewLines).toHaveLength(2);                       // 6 (mine) and 12 (Kari's)
  expect(crewLines[0]).toMatch(/· you$/);
  expect(crewLines[1]).toMatch(/· Kari$/);
  expect(screen.getByText(/Built from everyone’s picks in the crew/)).toBeInTheDocument();
});
