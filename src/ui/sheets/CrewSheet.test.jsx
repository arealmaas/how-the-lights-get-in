// The crew on a screen of its own (masthead → Crew), with the account underneath it: signed out it is a
// way in, signed in it is the crew card and the whole crew view.
import {test, expect, beforeEach, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import Sheet from '../Sheet.jsx';
import {useSheet} from '../../store/sheet.js';
import {useCloud} from '../../store/cloud.js';
import {usePlanner} from '../../store/planner.js';

vi.mock('../../cloud/auth.js', () => ({
  emailAction: vi.fn(async () => ({text: ''})), signInGoogle: vi.fn(), changeName: vi.fn(), signOutUser: vi.fn(), deleteAccount: vi.fn(),
}));
vi.mock('../../cloud/crew.js', () => ({
  crewOwnedByMe: () => true, liveInvites: () => [], inviteLink: () => '', createCrew: vi.fn(), renameCrew: vi.fn(),
  leaveCrew: vi.fn(), closeCrew: vi.fn(), removeMember: vi.fn(), readmit: vi.fn(), makeOwner: vi.fn(),
  createInvite: vi.fn(), revokeInvite: vi.fn(),
}));

const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com', providerData: [{providerId: 'password'}]};
const CREW = {
  id: 'c1', name: 'The Heath Three', createdBy: 'u1',
  members: [{uid: 'u1', name: 'Are', joinedAt: 1, picks: {}, verdicts: {}, notes: {}}, {uid: 'u2', name: 'Kari', joinedAt: 2, picks: {3: true}, verdicts: {}, notes: {}}],
  invites: [], removed: [], syncedAt: Date.now(), live: true, invitesLive: true,
};

beforeEach(() => {
  localStorage.clear();
  useSheet.setState({stack: []});
  usePlanner.setState({picks: new Set(), verdicts: {}, notes: {}, shared: {}});
  useCloud.setState({user: null, accountName: '', marker: null, crewId: null, crew: null});
});

test('signed out, the crew screen explains crews and offers the ways in', () => {
  useSheet.getState().open('crew');
  render(<Sheet />);

  expect(screen.getByRole('heading', {name: 'Your crew'})).toBeInTheDocument();
  expect(document.querySelector('.hub-card.account')).not.toBeNull();
  expect(screen.getByRole('button', {name: 'Continue with Google'})).toBeInTheDocument();
  expect(document.querySelector('.hub-card.crew')).toBeNull();   // nothing to show until we know who you are
});

test('signed in without a crew, the screen offers to make one, with the account under it', () => {
  useCloud.setState({user: USER, accountName: 'Are', marker: {uid: 'u1'}});
  useSheet.getState().open('crew');
  render(<Sheet />);

  expect(screen.getByRole('button', {name: 'Create a crew'})).toBeInTheDocument();
  expect(document.querySelector('p.src').textContent).toBe('Not in a crew yet.');
  expect(screen.getByText(/Signed in as/)).toBeInTheDocument();
  // the account comes after the crew: this is the crew screen, the account is what it rests on
  const cards = [...document.querySelectorAll('.hub-card')].map(c => c.className);
  expect(cards).toEqual(['hub-card crew', 'hub-card account']);
});

test('in a crew, the screen is the crew: its name, its members and the whole crew view', () => {
  useCloud.setState({user: USER, accountName: 'Are', marker: {uid: 'u1'}, crewId: 'c1', crew: CREW});
  useSheet.getState().open('crew');
  render(<Sheet />);

  expect(screen.getByRole('heading', {name: 'The Heath Three'})).toBeInTheDocument();
  expect(document.querySelector('p.src').textContent).toContain('2 of you');
  expect([...document.querySelectorAll('.hub-card.crew ul.members li .cname')].map(n => n.textContent))
    .toEqual(['Are (you) · owner', 'Kari']);
  // CrewSection's own headings: the crew view proper, which is what the screen was made for
  expect(screen.getByRole('heading', {name: /All of you/})).toBeInTheDocument();
  expect(screen.getByRole('heading', {name: /Where you split/})).toBeInTheDocument();
  expect(screen.getByRole('button', {name: /Crew calendar/})).toBeInTheDocument();
});

// The hub is now picks and reading only; everything cloud lives on the crew screen.
test('the hub no longer carries the account or the crew', () => {
  useCloud.setState({user: USER, accountName: 'Are', marker: {uid: 'u1'}, crewId: 'c1', crew: CREW});
  useSheet.getState().open('hub');
  render(<Sheet />);

  expect(document.querySelector('.hub-card.account')).toBeNull();
  expect(document.querySelector('.hub-card.crew')).toBeNull();
  expect(screen.queryByText('Account and crew')).toBeNull();
});
