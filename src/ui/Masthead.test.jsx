// The Crew button is the way in to the account as well as the crew, so it has to be there before anyone
// has signed in — but only in a build that has a Firebase project to sign in to. CLOUD is mocked through
// a getter so both builds can be exercised in one file.
import {test, expect, beforeEach, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import Masthead from './Masthead.jsx';
import {useSheet} from '../store/sheet.js';
import {useCloud} from '../store/cloud.js';
import {usePlanner} from '../store/planner.js';

const H = vi.hoisted(() => ({cloud: {on: true}}));
vi.mock('../data/index.js', async orig => {
  const real = await orig();
  return {...real, get CLOUD(){ return H.cloud.on; }};
});

const CREW = {
  id: 'c1', name: 'The Heath Three', createdBy: 'u1',
  members: [{uid: 'u1', name: 'Are', joinedAt: 1, picks: {}, verdicts: {}, notes: {}}, {uid: 'u2', name: 'Kari', joinedAt: 2, picks: {}, verdicts: {}, notes: {}}],
  invites: [], removed: [], syncedAt: Date.now(), live: true,
};
const labels = () => [...document.querySelectorAll('.mast-actions .mbtn .label')].map(b => b.textContent);

beforeEach(() => {
  H.cloud.on = true;
  useSheet.setState({stack: []});
  useCloud.setState({user: null, accountName: '', marker: null, crewId: null, crew: null});
  usePlanner.setState({picks: new Set(), verdicts: {}, notes: {}, shared: {}});
});

test('a build with no Firebase project keeps the two buttons it always had', () => {
  H.cloud.on = false;
  render(<Masthead />);
  expect(labels()).toEqual(['My festival', 'Reading list']);
});

// Signed out on purpose: the crew screen carries the Account card, so hiding the button until sign-in
// would leave nothing to sign in with.
test('with cloud on the Crew button is there before anyone has signed in, and opens the crew sheet', () => {
  render(<Masthead />);
  expect(labels()).toEqual(['My festival', 'Reading list', 'Crew']);

  fireEvent.click(screen.getByRole('button', {name: /Crew/}));
  expect(useSheet.getState().stack).toEqual([{kind: 'crew', key: undefined}]);
});

test('in a crew the button counts the crew and lights up; out of one it counts nothing', () => {
  const {unmount} = render(<Masthead />);
  const count = () => document.querySelector('[data-count-crew]');
  expect(count().hidden).toBe(true);
  expect(document.querySelector('.mbtn.has')).toBeNull();
  unmount();

  useCloud.setState({user: {uid: 'u1'}, crewId: 'c1', crew: CREW});
  render(<Masthead />);
  expect(count().hidden).toBe(false);
  expect(count().textContent).toBe('2');
  expect(document.querySelector('.mbtn.has')).not.toBeNull();
});
