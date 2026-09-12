// The status line must agree with useFiltered about what is actually filtering the list.
import {test, expect, beforeEach} from 'vitest';
import {render, screen} from '@testing-library/react';
import Status from './Status.jsx';
import {useCloud} from '../store/cloud.js';
import {usePlanner} from '../store/planner.js';

const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com'};
const CREW = {
  id: 'c1', name: 'The Heath Three', createdBy: 'u1',
  members: [{uid: 'u1', name: 'Are', joinedAt: 1, picks: {}, verdicts: {}, notes: {}}],
  invites: [], removed: [], syncedAt: Date.now(), live: true,
};

beforeEach(() => {
  localStorage.clear();
  usePlanner.setState({day: '2026-09-19', groups: [], venue: '', topic: '', picksOnly: false, crewOnly: false, q: ''});
  useCloud.setState({user: null, accountName: '', marker: null, crewId: null, crew: null});
});

test('an unfiltered day still shows the result count', () => {
  render(<Status shown={40} onClear={() => {}} />);
  expect(document.getElementById('status')).toHaveTextContent('40 Saturday events');
  expect(screen.queryByRole('button', {name: 'Clear filters'})).not.toBeInTheDocument();
});

// crewOnly is persisted and cloud/crew.js only clears it when it sees a crew go. useFiltered ignores a
// left-over flag outside a crew, so the status line must not offer "Clear filters" over an unfiltered list.
test('a left-over crewOnly outside a crew does not count as a filter', () => {
  usePlanner.setState({crewOnly: true});
  const {unmount} = render(<Status shown={40} onClear={() => {}} />);
  expect(document.getElementById('status')).toHaveTextContent('40 Saturday events');
  expect(screen.queryByRole('button', {name: 'Clear filters'})).not.toBeInTheDocument();
  unmount();

  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  render(<Status shown={2} onClear={() => {}} />);
  expect(document.getElementById('status')).not.toHaveAttribute('hidden');
  expect(screen.getByRole('button', {name: 'Clear filters'})).toBeInTheDocument();
});
