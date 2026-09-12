import {test, expect, vi, beforeEach} from 'vitest';
import {render, fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventCard from './EventCard.jsx';
import EventGrid from './EventGrid.jsx';
import {usePlanner} from '../store/planner.js';
import {useSheet} from '../store/sheet.js';
import {useCloud} from '../store/cloud.js';
import {EVENTS} from '../data/index.js';

// the write behind the crew-plan toggle is cloud/crew.js's; the card's job is to render the state and call it
vi.mock('../cloud/crew.js', async orig => ({...await orig(), toggleCrewPick: vi.fn()}));
const {toggleCrewPick} = await import('../cloud/crew.js');

const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com'};
const CREW = {
  id: 'c1', name: 'The Heath Three', createdBy: 'u1', picks: {6: 'u2'},
  members: [{uid: 'u1', name: 'Are', joinedAt: 1, picks: {}, verdicts: {}, notes: {}}, {uid: 'u2', name: 'Kari', joinedAt: 2, picks: {}, verdicts: {}, notes: {}}],
  invites: [], removed: [], syncedAt: Date.now(), live: true,
};
const E6 = EVENTS.find(e => e.eventNo === 6), E12 = EVENTS.find(e => e.eventNo === 12);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useCloud.setState({user: null, accountName: '', marker: null, crewId: null, crew: null});
});

test('a picked event with a clash and a note shows the star, note badge and clash text; the star toggles the pick', async () => {
  const togglePick = vi.fn();
  usePlanner.setState({togglePick});

  const e = EVENTS[0];
  const other = EVENTS[1];
  const {container} = render(
    <EventCard e={e} picked={true} clash={[{no: other.eventNo, min: 50}]} hasNote={true} />
  );

  const star = container.querySelector('button.pick');
  expect(star).toHaveAttribute('aria-pressed', 'true');
  expect(container.querySelector('.badge.note')).toHaveTextContent('✎ notes');
  expect(container.querySelector('.badge.clash')).toHaveTextContent(`⚠ Clashes with ${other.title}`);

  await userEvent.click(star);
  expect(togglePick).toHaveBeenCalledWith(e.eventNo);
});

test.each(['{Enter}', ' '])('keyboard %s opens details from the native title button and preserves its focus', async key => {
  const open = vi.fn();
  useSheet.setState({open});

  const e = EVENTS[0];
  const {container, getByRole} = render(<EventCard e={e} picked={false} clash={null} hasNote={false} />);
  const details = getByRole('button', {name: e.title});
  expect(details).toHaveAttribute('aria-haspopup', 'dialog');
  expect(details.closest('h3')).toHaveClass('ev-title');
  expect(container.querySelector('article.ev')).not.toHaveAttribute('role', 'button');
  expect(container.querySelector('article.ev')).not.toHaveAttribute('tabindex');

  details.focus();
  await userEvent.keyboard(key);
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith('event', e.eventNo);
  expect(details).toHaveFocus();
});

test.each(['{Enter}', ' '])('keyboard %s on the star toggles the pick without opening details', async key => {
  const open = vi.fn(), togglePick = vi.fn();
  useSheet.setState({open});
  usePlanner.setState({togglePick});

  const e = EVENTS[0];
  const {getByRole} = render(<EventCard e={e} picked={false} clash={null} hasNote={false} />);
  const star = getByRole('button', {name: `Add to my picks: ${e.title}`});

  star.focus();
  await userEvent.keyboard(key);
  expect(togglePick).toHaveBeenCalledTimes(1);
  expect(togglePick).toHaveBeenCalledWith(e.eventNo);
  expect(open).not.toHaveBeenCalled();
});

// CREW-SPEC section 7 "Everywhere": in a crew every card has a second toggle beside the star, for the
// crew's plan. Pressed and ringed when the event is in the plan; a plain outline when it is not. The
// star is untouched by it — the two lists are independent.
test('in a crew the card has the crew-plan toggle beside the star, pressed and ringed when the event is in the plan', async () => {
  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  const open = vi.fn();
  useSheet.setState({open});

  const {container, unmount} = render(<EventCard e={E6} picked={false} clash={null} hasNote={false} />);
  const btn = container.querySelector('button.crewpick');
  expect(btn).toHaveAttribute('aria-pressed', 'true');
  expect(btn).toHaveAttribute('aria-label', 'Remove from the crew’s plan');
  expect(btn.querySelector('svg')).not.toBeNull();
  expect(btn.nextElementSibling).toHaveClass('pick');
  expect(container.querySelector('article.ev')).toHaveClass('crew');
  expect(container.querySelector('article.ev')).not.toHaveClass('picked');   // the plan is not my pick

  await userEvent.click(btn);
  expect(toggleCrewPick).toHaveBeenCalledWith(6);
  expect(open).not.toHaveBeenCalled();   // the click stays on the button, like the star's
  fireEvent.keyDown(btn, {key: 'Enter'});
  expect(open).not.toHaveBeenCalled();
  unmount();

  render(<EventCard e={E12} picked={true} clash={null} hasNote={false} />);
  const off = document.querySelector('button.crewpick');
  expect(off).toHaveAttribute('aria-pressed', 'false');
  expect(off).toHaveAttribute('aria-label', 'Add to the crew’s plan');
  expect(document.querySelector('article.ev')).not.toHaveClass('crew');
  expect(document.querySelector('article.ev')).toHaveClass('picked');   // and my pick is not the plan
});

test('without a crew there is no crew-plan toggle and no ring, whatever the plan says', () => {
  useCloud.setState({user: USER, crewId: null, crew: null});
  const {container} = render(<EventCard e={E6} picked={false} clash={null} hasNote={false} />);
  expect(container.querySelector('button.crewpick')).toBeNull();
  expect(container.querySelector('article.ev')).not.toHaveClass('crew');
});

// The cached crew on a cold or offline start (CREW-SPEC section 6, "Failure modes") has the plan too:
// the ring and the toggle are there on the account marker alone, before the SDK has produced a user.
test('a cached crew with only the account marker still rings the planned cards', () => {
  useCloud.setState({user: null, marker: {uid: 'u1'}, crewId: 'c1', crew: {...CREW, live: false}});
  const {container} = render(<EventCard e={E6} picked={false} clash={null} hasNote={false} />);
  expect(container.querySelector('article.ev')).toHaveClass('crew');
  expect(container.querySelector('button.crewpick')).toHaveAttribute('aria-pressed', 'true');
});

// A tile is one button, so it carries the ring and the glyph but not the toggle.
test('a grid tile in the plan is ringed and marked with the crew glyph', () => {
  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  usePlanner.setState({day: '2026-09-19', view: 'grid', picks: new Set([12])});
  render(<EventGrid list={[E6, E12]} clashes={new Map()} />);

  const tiles = [...document.querySelectorAll('.tile')];
  const t6 = tiles.find(t => t.textContent.includes(E6.title));
  const t12 = tiles.find(t => t.textContent.includes(E12.title));
  expect(t6).toHaveClass('crew');
  expect(t6.querySelector('.crewmark svg')).not.toBeNull();
  expect(t6.querySelector('.crewpick')).toBeNull();
  expect(t12).not.toHaveClass('crew');
  expect(t12.querySelector('.crewmark')).toBeNull();
  expect(t12).toHaveClass('picked');
});
