// The Crew chip and the crewOnly filter (CREW-SPEC section 7 "Everywhere"): the chip exists only in a
// crew, counts the day's crew events, and composes with the other filters through useFiltered's crewAny.
import {test, expect, beforeEach} from 'vitest';
import {render, act, fireEvent, renderHook} from '@testing-library/react';
import Chips from './Chips.jsx';
import {useFiltered} from './useFiltered.js';
import {useCloud} from '../store/cloud.js';
import {usePlanner} from '../store/planner.js';

const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com'};
const member = (uid, name, picks = {}) => ({uid, name, joinedAt: 1, picks, verdicts: {}, notes: {}});
const CREW = {
  id: 'c1', name: 'The Heath Three', createdBy: 'u1',
  // 6 and 12 are Saturday, 80 is Sunday; 1 is mine alone
  members: [member('u1', 'Are', {1: true}), member('u2', 'Kari', {6: true, 12: true, 80: true})],
  invites: [], removed: [], syncedAt: Date.now(), live: true,
};

beforeEach(() => {
  localStorage.clear();
  usePlanner.setState({day: '2026-09-19', groups: [], venue: '', topic: '', picksOnly: false, crewOnly: false, q: '', picks: new Set([1])});
  useCloud.setState({user: null, accountName: '', crewId: null, crew: null});
});

test('without a crew there is no Crew chip at all', () => {
  render(<Chips clashes={new Map()} />);
  expect(document.querySelector('.chip.crewchip')).toBeNull();
});

test('in a crew the chip counts the day’s crew events and toggles crewOnly', () => {
  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  render(<Chips clashes={new Map()} />);

  const chip = document.querySelector('.chip.crewchip');
  expect(chip).toHaveTextContent('Crew (2)');           // 6 and 12; Sunday's 80 is not counted
  expect(chip).toHaveAttribute('aria-pressed', 'false');

  fireEvent.click(chip);
  expect(usePlanner.getState().crewOnly).toBe(true);
  expect(document.querySelector('.chip.crewchip')).toHaveAttribute('aria-pressed', 'true');

  act(() => { usePlanner.getState().setFilter({day: '2026-09-20'}); });
  expect(document.querySelector('.chip.crewchip')).toHaveTextContent('Crew (1)');
});

test('crewAny is the events other members picked, and crewOnly filters the list down to them', () => {
  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  const {result} = renderHook(() => useFiltered());

  expect([...result.current.crewAny].sort((a, b) => a - b)).toEqual([6, 12, 80]);   // never my own event 1
  expect(result.current.list.some(e => e.eventNo === 1)).toBe(true);

  act(() => { usePlanner.getState().setFilter({crewOnly: true}); });
  expect(result.current.list.map(e => e.eventNo)).toEqual([6, 12]);                 // Saturday only, mine dropped

  // and it composes: crewOnly plus a search
  act(() => { usePlanner.getState().setQuery('cult'); });
  expect(result.current.list.map(e => e.eventNo)).toEqual([12]);
});

// The flag is persisted, and cloud/crew.js only clears it when it sees the crew go. A boot with no crew
// (signed out, offline, or a build with no Firebase config) must not find itself filtering by a chip that
// is not on screen to unpress.
test('without a crew crewAny is empty and a left-over crewOnly hides nothing', () => {
  usePlanner.setState({crewOnly: true});
  const {result} = renderHook(() => useFiltered());
  expect(result.current.crewAny.size).toBe(0);
  expect(result.current.list.length).toBeGreaterThan(0);
  expect(result.current.list.every(e => e.date === '2026-09-19')).toBe(true);
});
