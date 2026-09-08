// Hooks are counted, not conditioned: every hook in useInCrew/useFiltered must run on every render,
// whether or not this device is in a crew. Creating a crew flips `crew` from null to an object under a
// mounted tree, so a hook that only runs on one side of that flip is React error #310 ("rendered more
// hooks than during the previous render") the moment the crew lands.
import {test, expect, beforeEach} from 'vitest';
import {render, act} from '@testing-library/react';
import App from '../App.jsx';
import Status from './Status.jsx';
import {useCloud} from '../store/cloud.js';
import {usePlanner} from '../store/planner.js';

const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com'};
const CREW = {
  id: 'c1', name: 'The Heath Three', createdBy: 'u1', picks: {6: 'u1'},
  members: [{uid: 'u1', name: 'Are', joinedAt: 1, picks: {}, verdicts: {}, notes: {}}],
  invites: [], removed: [], syncedAt: Date.now(), live: true,
};

beforeEach(() => {
  localStorage.clear();
  usePlanner.setState({day: '2026-09-19', groups: [], venue: '', topic: '', picksOnly: false, crewOnly: false, q: ''});
  useCloud.setState({user: null, accountName: '', marker: null, crewId: null, crew: null});
});

// The reported crash: signed in, no crew, press "Create crew", the snapshot lands and the whole app throws.
test('creating a crew under a mounted App does not change the hook count', () => {
  useCloud.setState({user: USER, accountName: 'Are'});
  render(<App />);
  expect(() => act(() => { useCloud.setState({crewId: 'c1', crew: CREW}); })).not.toThrow();
});

// And the other direction: the crew is closed, or you are removed from it, while the app is on screen.
test('losing a crew under a mounted App does not change the hook count', () => {
  useCloud.setState({user: USER, accountName: 'Are', crewId: 'c1', crew: CREW});
  render(<App />);
  expect(() => act(() => { useCloud.setState({crewId: null, crew: null}); })).not.toThrow();
});

// Status calls useInCrew directly, so it carries the same fault on its own.
test('Status survives a crew arriving while it is mounted', () => {
  useCloud.setState({user: USER, accountName: 'Are'});
  usePlanner.setState({crewOnly: true});
  render(<Status shown={40} onClear={() => {}} />);
  expect(() => act(() => { useCloud.setState({crewId: 'c1', crew: CREW}); })).not.toThrow();
  expect(document.getElementById('status')).not.toHaveAttribute('hidden');
});

// The plan changes under a mounted App on every toggle: a card's useInPlan, the grid's and the chips'
// useCrewPlan and the masthead's crew button all read it with unconditional hooks.
test('the plan changing under a mounted App does not change the hook count', () => {
  useCloud.setState({user: USER, accountName: 'Are', crewId: 'c1', crew: CREW});
  usePlanner.setState({view: 'grid'});
  render(<App />);
  expect(() => act(() => { useCloud.setState({crew: {...CREW, picks: {6: 'u1', 12: 'u1'}}}); })).not.toThrow();
  expect(() => act(() => { useCloud.setState({crew: {...CREW, picks: {}}}); })).not.toThrow();
  expect(() => act(() => { usePlanner.setState({view: 'list'}); })).not.toThrow();
  expect(() => act(() => { useCloud.setState({crew: {...CREW, picks: {6: 'u1'}}}); })).not.toThrow();
});
