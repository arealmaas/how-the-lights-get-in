import {beforeEach, expect, test} from 'vitest';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompareSheet from './CompareSheet.jsx';
import Sheet from '../Sheet.jsx';
import {EVENTS, BRIEFINGS, BRIEF_NOTE, byNo} from '../../data/index.js';
import {overlapMin} from '../../core/clashes.js';
import {cleanDesc, ticketLine} from '../../core/labels.js';
import {LS, usePlanner} from '../../store/planner.js';
import {useSheet} from '../../store/sheet.js';
import {useCloud} from '../../store/cloud.js';

const option = no => within(screen.getByRole('article', {name: byNo.get(no).title}));

beforeEach(() => {
  localStorage.clear();
  usePlanner.setState({picks: new Set(), verdicts: {}, notes: {}, shared: {}});
  useSheet.setState({stack: []});
  useCloud.setState({user: null, accountName: '', marker: null, crewId: null, crew: null});
});

test('choosing and undoing preserves unrelated pick changes and the latest personal notes', async () => {
  usePlanner.setState({picks: new Set([3, 6, 7, 41]), notes: {7: 'A reason to go'}, verdicts: {7: 'Draw'}, shared: {7: true}});
  render(<CompareSheet no={6} />);
  await userEvent.click(option(6).getByRole('button', {name: 'Choose this event'}));

  expect([...usePlanner.getState().picks]).toEqual([6, 41]);
  expect(option(6).getByRole('button', {name: '✓ Keeping this event'})).toBeDisabled();
  expect(option(3).getByText('Not picked')).toBeVisible();
  expect(option(7).getByText('Not picked')).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Removed 2 overlapping picks.');

  act(() => {
    usePlanner.getState().setPicks({41: false, 10: true});
    usePlanner.getState().setNote(7, 'Revised while deciding');
    usePlanner.getState().setVerdict(7, 'Steve Keen');
  });
  await userEvent.click(screen.getByRole('button', {name: 'Undo choice'}));
  expect(usePlanner.getState().picks).toEqual(new Set([3, 6, 7, 10]));
  expect(JSON.parse(localStorage.getItem(LS.picks))).toEqual(expect.arrayContaining([3, 6, 7, 10]));
  expect(usePlanner.getState().notes).toEqual({7: 'Revised while deciding'});
  expect(usePlanner.getState().verdicts).toEqual({7: 'Steve Keen'});
  expect(usePlanner.getState().shared).toEqual({7: true});
  await userEvent.click(option(7).getByText('Your note'));
  expect(option(7).getByText('Revised while deciding')).toBeVisible();
  expect(screen.queryByRole('button', {name: 'Undo choice'})).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent('Choice undone. Your previous picks are restored.');
});

test('Undo becomes unavailable when a pick affected by the choice is changed elsewhere', async () => {
  usePlanner.setState({picks: new Set([3, 6, 7])});
  render(<CompareSheet no={6} />);
  await userEvent.click(option(6).getByRole('button', {name: 'Choose this event'}));
  act(() => usePlanner.getState().setPicks({7: true}));
  expect(screen.queryByRole('button', {name: 'Undo choice'})).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent('Your picks have changed since that choice.');
  expect(usePlanner.getState().picks).toEqual(new Set([6, 7]));
  await userEvent.click(option(7).getByRole('button', {name: 'Choose this event'}));
  expect(usePlanner.getState().picks).toEqual(new Set([7]));
  await userEvent.click(screen.getByRole('button', {name: 'Undo choice'}));
  expect(usePlanner.getState().picks).toEqual(new Set([6, 7]));
});

test('returning to a comparison after switching accounts discards the previous account’s options and Undo', async () => {
  useCloud.setState({user: {uid: 'first-account'}, marker: {uid: 'first-account'}});
  usePlanner.setState({picks: new Set([3, 4])});
  useSheet.getState().open('compare', 3);
  render(<Sheet />);
  await userEvent.click(option(3).getByRole('button', {name: 'Choose this event'}));
  expect(usePlanner.getState().picks).toEqual(new Set([3]));
  expect(screen.getByRole('button', {name: 'Undo choice'})).toBeVisible();

  // The comparison is unmounted while its visit memory remains in the sheet.
  // Account changes can arrive while the user is reading another sheet.
  await userEvent.click(option(3).getByRole('button', {name: 'Full event details'}));
  act(() => {
    useCloud.setState({user: {uid: 'second-account'}, marker: {uid: 'second-account'}});
    usePlanner.setState({picks: new Set()});
  });
  await userEvent.click(screen.getByRole('button', {name: '← Back'}));
  expect(screen.getByRole('heading', {name: 'Your picks fit together'})).toBeVisible();
  expect(screen.queryByRole('button', {name: 'Undo choice'})).toBeNull();
  expect(screen.queryByRole('article')).toBeNull();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  expect(usePlanner.getState().picks).toEqual(new Set());
});

test('hydrating the same cached account identity preserves comparison options and Undo', async () => {
  useCloud.setState({user: null, marker: {uid: 'same-account'}});
  usePlanner.setState({picks: new Set([3, 4])});
  useSheet.getState().open('compare', 3);
  render(<Sheet />);
  await userEvent.click(option(3).getByRole('button', {name: 'Choose this event'}));
  act(() => useCloud.setState({user: {uid: 'same-account'}}));
  expect(option(4).getByText('Not picked')).toBeVisible();
  await userEvent.click(screen.getByRole('button', {name: 'Undo choice'}));
  expect(usePlanner.getState().picks).toEqual(new Set([3, 4]));
});

test('both ends of an overlap chain can be kept, then reconsidered without losing the original options', async () => {
  usePlanner.setState({picks: new Set([3, 6, 8])}); // 10:00, 10:30, 11:00
  render(<CompareSheet no={6} />);
  await userEvent.click(option(3).getByRole('button', {name: 'Choose this event'}));
  expect(usePlanner.getState().picks).toEqual(new Set([3, 8]));
  expect(option(8).getByRole('button', {name: '✓ Keeping this event'})).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Your current picks have no estimated overlaps.');

  await userEvent.click(option(6).getByRole('button', {name: 'Choose this event'}));
  expect(usePlanner.getState().picks).toEqual(new Set([6]));
  expect(screen.getAllByRole('article')).toHaveLength(3);
  await userEvent.click(screen.getByRole('button', {name: 'Undo choice'}));
  expect(usePlanner.getState().picks).toEqual(new Set([3, 8]));
  expect(option(6).getByText('Not picked')).toBeVisible();
});

test('a comparison visit keeps its selected slot, options, scroll and Undo across profile and event drilldowns', async () => {
  usePlanner.setState({picks: new Set([3, 6, 41, 42])});
  useSheet.getState().open('compare', 3);
  render(<Sheet />);
  await userEvent.click(screen.getByRole('button', {name: 'Saturday 16:00 · 2 options'}));
  await userEvent.click(option(41).getByRole('button', {name: 'Choose this event'}));
  const body = document.getElementById('sheet-body');
  fireEvent.scroll(body, {target: {scrollTop: 360}});

  await userEvent.click(option(41).getByRole('button', {name: 'Thomas Hertog'}));
  expect(useSheet.getState().stack.at(-1)).toEqual({kind: 'speaker', key: 'thomas-hertog'});
  await userEvent.click(screen.getByRole('button', {name: '← Back'}));
  expect(body.scrollTop).toBe(360);
  expect(screen.getByRole('button', {name: 'Saturday 16:00 · 2 options'})).toHaveAttribute('aria-pressed', 'true');
  expect(option(42).getByText('Not picked')).toBeVisible();
  expect(screen.getByRole('button', {name: 'Undo choice'})).toBeVisible();

  await userEvent.click(option(41).getByRole('button', {name: 'Full event details'}));
  expect(useSheet.getState().stack.at(-1)).toEqual({kind: 'event', key: 41});
  await userEvent.click(screen.getByRole('button', {name: '← Back'}));
  expect(option(42).getByText('Not picked')).toBeVisible();
  await userEvent.click(screen.getByRole('button', {name: 'Undo choice'}));
  expect(usePlanner.getState().picks).toEqual(new Set([3, 6, 41, 42]));

  await userEvent.click(option(41).getByRole('button', {name: 'Choose this event'}));
  await userEvent.click(screen.getByRole('button', {name: 'Close'}));
  act(() => useSheet.getState().open('compare', 41));
  expect(screen.queryByRole('article', {name: byNo.get(42).title})).toBeNull();
  expect(screen.queryByRole('button', {name: 'Undo choice'})).toBeNull();
  expect(option(3).getByText('★ Picked')).toBeVisible();
  expect(useSheet.getState().stack).toEqual([{kind: 'compare', key: 41}]);
});

test('an obsolete comparison entry shows the empty state and can return to the programme', async () => {
  usePlanner.setState({picks: new Set([3, 41])});
  useSheet.getState().open('compare', 999999);
  render(<Sheet />);
  expect(screen.getByRole('heading', {name: 'Your picks fit together'})).toBeVisible();
  expect(screen.queryByRole('article')).toBeNull();
  expect(screen.queryByRole('button', {name: 'Choose this event'})).toBeNull();
  await userEvent.click(screen.getByRole('button', {name: 'Back to the programme'}));
  expect(useSheet.getState().stack).toEqual([]);
  expect(usePlanner.getState().picks).toEqual(new Set([3, 41]));
});

test('briefing summaries are attributed and retain the complete programme description and practical details', async () => {
  usePlanner.setState({picks: new Set([6, 7])});
  render(<CompareSheet no={6} />);
  const event = byNo.get(6), briefing = BRIEFINGS[6], card = option(6);
  expect(card.getByText(briefing.question)).toBeVisible();
  expect(card.getByText(briefing.why)).toBeVisible();
  expect(card.getByText('From the unofficial briefing')).toBeVisible();
  expect(screen.getByText(BRIEF_NOTE)).toBeVisible();
  expect(card.getByText(ticketLine(event))).toBeVisible();
  expect(screen.getByText(/End times and overlaps are estimates/)).toBeVisible();

  await userEvent.click(card.getByText('Programme & arguments'));
  for (const paragraph of cleanDesc(event.description).split(/\n+/).filter(Boolean)) {
    expect(card.getByText(paragraph)).toBeVisible();
  }
  for (const side of briefing.sides) expect(card.getByText(side.label)).toBeVisible();
  expect(card.getByRole('link', {name: 'Official event page ↗'})).toHaveAttribute('href', event.url);
  expect(card.getByRole('button', {name: 'Philip Ball'})).toBeVisible();
  expect(option(7).getAllByText('Only here in this comparison').length).toBeGreaterThan(0);
});

test('unbriefed events show their full descriptions and identify artist profile material', async () => {
  usePlanner.setState({picks: new Set([8, 10])});
  render(<CompareSheet no={10} />);
  const event = byNo.get(10), card = option(10);
  expect(card.getByRole('heading', {name: 'The experience'})).toBeVisible();
  expect(card.getByText(cleanDesc(event.description))).toBeVisible();
  expect(card.queryByText('From the unofficial briefing')).toBeNull();
  await userEvent.click(card.getByText('More event details'));
  expect(card.getByText('Description from the artist’s profile.')).toBeVisible();
  expect(card.queryByRole('link', {name: 'Official event page ↗'})).toBeNull();
  await userEvent.click(card.getByRole('button', {name: 'Sue Harding'}));
  expect(useSheet.getState().stack.at(-1)).toEqual({kind: 'act', key: 'sue-harding'});
});

test('an event without a description or URL offers an honest fallback without an empty details disclosure', async () => {
  const event = byNo.get(91);
  const other = EVENTS.find(e => e.eventNo !== event.eventNo && overlapMin(e, event) > 0);
  usePlanner.setState({picks: new Set([event.eventNo, other.eventNo])});
  render(<CompareSheet no={event.eventNo} />);
  const card = option(event.eventNo);
  expect(card.getByText('No description published for this slot.')).toBeVisible();
  expect(card.queryByText('More event details')).toBeNull();
  expect(card.queryByRole('link', {name: 'Official event page ↗'})).toBeNull();
  await userEvent.click(card.getByRole('button', {name: 'Full event details'}));
  expect(useSheet.getState().stack.at(-1)).toEqual({kind: 'event', key: event.eventNo});
});
