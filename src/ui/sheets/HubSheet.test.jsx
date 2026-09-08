import {test, expect, beforeEach} from 'vitest';
import {render, screen} from '@testing-library/react';
import Sheet from '../Sheet.jsx';
import {useSheet} from '../../store/sheet.js';
import {usePlanner} from '../../store/planner.js';

beforeEach(() => {
  localStorage.clear();
  useSheet.setState({stack: []});
  usePlanner.setState({picks: new Set([3, 6, 41]), verdicts: {}, notes: {}, shared: {}});
});

test('the hub summarises picks, offers a share link that carries them, and a reading-list card', () => {
  useSheet.getState().open('hub');
  render(<Sheet />);

  // scoped to the summary line itself: "3 picks" also appears inside a per-day heading when every pick
  // falls on the same day, which would otherwise match twice under a plain getByText(/3 picks/).
  expect(document.querySelector('p.src').textContent).toContain('3 picks');

  const link = document.getElementById('picklink');
  expect(link).not.toBeNull();
  expect(link.value).toContain('#picks=');

  expect(screen.getByRole('button', {name: /reading list/i})).toBeInTheDocument();
});

// Without data/firebase.json — the state of this repo, of the e2e run and of anyone self-hosting
// without a Firebase project — CLOUD is false and the account and crew half of the hub is not built at
// all. The signed-out planner must never advertise an account it cannot offer.
test('without a Firebase config the hub has no Account card and no account heading', () => {
  useSheet.getState().open('hub');
  render(<Sheet />);

  expect(document.querySelector('.hub-card.account')).toBeNull();
  expect(screen.queryByText('Account and crew')).toBeNull();
  expect(screen.queryByRole('button', {name: /Continue with Google/})).toBeNull();
});

test('with no picks, the hub shows the empty-state nudge instead of the cards', () => {
  usePlanner.setState({picks: new Set(), verdicts: {}, notes: {}, shared: {}});
  useSheet.getState().open('hub');
  render(<Sheet />);

  expect(screen.getByText('Nothing picked yet')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: /browse the programme/i})).toBeInTheDocument();
  expect(document.getElementById('picklink')).toBeNull();
});
