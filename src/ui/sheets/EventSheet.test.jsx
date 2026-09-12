import {test, expect, beforeEach, vi} from 'vitest';
import {render, screen, act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sheet from '../Sheet.jsx';
import {useSheet} from '../../store/sheet.js';
import {usePlanner} from '../../store/planner.js';
import {useCloud} from '../../store/cloud.js';
import {EVENTS} from '../../data/index.js';

vi.mock('../../cloud/crew.js', async orig => ({...await orig(), toggleCrewPick: vi.fn()}));
const {toggleCrewPick} = await import('../../cloud/crew.js');

const EVENT_6 = EVENTS.find(e => e.eventNo === 6);   // a debate, with a briefing that has sides
const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com'};
const CREW = {
  id: 'c1', name: 'The Heath Three', createdBy: 'u1', picks: {},
  members: [{uid: 'u1', name: 'Are', joinedAt: 1, picks: {}, verdicts: {}, notes: {}}],
  invites: [], removed: [], syncedAt: Date.now(), live: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useSheet.setState({stack: []});
  usePlanner.setState({picks: new Set(), verdicts: {}, notes: {}, shared: {}});
  useCloud.setState({user: null, accountName: '', marker: null, crewId: null, crew: null});
});

test('opening event 6 shows its title, a Who won? verdict block and the notes textarea; the pick button toggles the store', async () => {
  useSheet.getState().open('event', 6);
  render(<Sheet />);

  expect(screen.getByRole('heading', {name: EVENT_6.title})).toBeInTheDocument();
  expect(screen.queryByRole('textbox', {name: 'My note'})).toBeNull();
  await userEvent.click(screen.getByRole('button', {name: 'Notes', exact: true}));
  expect(screen.getByText('Who won?')).toBeVisible();
  expect(screen.getByRole('textbox', {name: 'My note'})).toBeVisible();

  expect(usePlanner.getState().picks.has(6)).toBe(false);
  await userEvent.click(screen.getByRole('button', {name: /add to my picks/i}));
  expect(usePlanner.getState().picks.has(6)).toBe(true);
});

test('changing sections keeps the note draft and the same event visit', async () => {
  useSheet.getState().open('event', 6);
  render(<Sheet />);
  const sections = screen.getByRole('group', {name: 'Event sections'});
  expect(sections).toBeVisible();
  await userEvent.click(screen.getByRole('button', {name: 'Notes', exact: true}));
  const editor = screen.getByRole('textbox', {name: 'My note'});
  await userEvent.type(editor, 'A thought to compare with the briefing.');
  await userEvent.click(screen.getByRole('button', {name: 'Briefing', exact: true}));
  expect(editor).not.toBeVisible();
  await userEvent.click(screen.getByRole('button', {name: 'Notes', exact: true}));
  expect(editor).toBeVisible();
  expect(editor).toHaveValue('A thought to compare with the briefing.');
  expect(useSheet.getState().stack).toHaveLength(1);
});

// CREW-SPEC section 7: in a crew the actions row has the crew-plan toggle beside "Add to my picks".
// It reads the crew document and calls cloud/crew.js; the pressed state follows the next snapshot.
test('in a crew the actions row offers the crew-plan toggle beside the pick button; without one it does not', async () => {
  useSheet.getState().open('event', 6);
  const {unmount} = render(<Sheet />);
  expect(screen.queryByRole('button', {name: /crew’s plan/})).toBeNull();
  unmount();

  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  render(<Sheet />);
  const add = screen.getByRole('button', {name: 'Add to the crew’s plan'});
  expect(add).toHaveAttribute('aria-pressed', 'false');
  expect(add.previousElementSibling).toHaveTextContent('Add to my picks');
  await userEvent.click(add);
  expect(toggleCrewPick).toHaveBeenCalledWith(6);
  expect(usePlanner.getState().picks.has(6)).toBe(false);   // the plan is not my pick

  act(() => { useCloud.setState({crew: {...CREW, picks: {6: 'u1'}}}); });   // the listener's echo
  const on = screen.getByRole('button', {name: 'In the crew’s plan'});
  expect(on).toHaveAttribute('aria-pressed', 'true');
  expect(on).toHaveClass('crewbtn');
  expect(document.querySelector('.going .plan').textContent).toBe('In the crew’s plan · added by Are');
});
