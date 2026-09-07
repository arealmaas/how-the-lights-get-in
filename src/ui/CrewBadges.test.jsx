// The initials badges on cards and grid tiles (CREW-SPEC section 7 "Everywhere").
import {test, expect, beforeEach} from 'vitest';
import {render} from '@testing-library/react';
import EventCard from './EventCard.jsx';
import EventGrid from './EventGrid.jsx';
import {useCloud} from '../store/cloud.js';
import {usePlanner} from '../store/planner.js';
import {EVENTS} from '../data/index.js';

const E6 = EVENTS.find(e => e.eventNo === 6);
const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com'};
const member = (uid, name, picks = {}) => ({uid, name, joinedAt: 1, picks, verdicts: {}, notes: {}});
const CREW = {
  id: 'c1', name: 'The Heath Three', createdBy: 'u1',
  members: [member('u1', 'Are Almaas', {6: true}), member('u2', 'Kari Nordmann', {6: true}), member('u3', 'Morten Vik')],
  invites: [], removed: [], syncedAt: Date.now(), live: true,
};
const dots = () => [...document.querySelectorAll('.cbadges .cdot')];

beforeEach(() => {
  localStorage.clear();
  usePlanner.setState({day: '2026-09-19', view: 'list', picks: new Set([6]), verdicts: {}, notes: {}, shared: {}});
  useCloud.setState({user: USER, accountName: 'Are', crewId: 'c1', crew: CREW});
});

test('a card shows one dot per other member who picked it, coloured by join order, never my own', () => {
  render(<EventCard e={E6} picked={true} clash={undefined} hasNote={false} />);

  expect(dots().map(d => d.textContent)).toEqual(['KN']);          // Kari only: my star already says I am going
  expect(dots()[0].getAttribute('title')).toBe('Kari Nordmann');
  expect(dots()[0].style.getPropertyValue('--c')).toBe('var(--talks)');   // index 1 in the strand palette

  // and the badges sit between the briefing badge and the pick star, as on the old page
  const head = document.querySelector('.ev-head');
  expect(head.querySelector('.cbadges').nextElementSibling).toHaveClass('pick');
});

test('a grid tile carries the same badges', () => {
  usePlanner.setState({view: 'grid'});
  render(<EventGrid list={[E6]} clashes={new Map()} />);
  expect(document.querySelector('.tile .cbadges')).not.toBeNull();
  expect(dots().map(d => d.textContent)).toEqual(['KN']);
});

test('nothing is drawn when nobody else picked it, or when there is no crew', () => {
  const other = EVENTS.find(e => e.eventNo === 12);
  const {unmount} = render(<EventCard e={other} picked={false} clash={undefined} hasNote={false} />);
  expect(document.querySelector('.cbadges')).toBeNull();
  unmount();

  useCloud.setState({user: null, crew: null, crewId: null});
  render(<EventCard e={E6} picked={true} clash={undefined} hasNote={false} />);
  expect(document.querySelector('.cbadges')).toBeNull();
});
