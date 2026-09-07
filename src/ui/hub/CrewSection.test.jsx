// The My festival crew section (CREW-SPEC section 7 "My festival crew section"): the three summary lists,
// the split slot, and the crew calendar's "Going:" prefix. download() is mocked so the .ics text can be
// read straight out of the call.
import {test, expect, beforeEach, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import CrewSection from './CrewSection.jsx';
import {useCloud} from '../../store/cloud.js';
import {usePlanner} from '../../store/planner.js';
import {useSheet} from '../../store/sheet.js';
import {useBanner} from '../../store/banner.js';

vi.mock('../download.js', () => ({download: vi.fn()}));
const {download} = await import('../download.js');

// events 1 and 2 share the 09:00 Saturday slot (the split); 6 is 10:30, 12 is 11:45
const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com'};
const member = (uid, name, picks = {}) => ({uid, name, joinedAt: 1, picks, verdicts: {}, notes: {}});
const crewOf = (...members) => ({
  id: 'c1', name: 'The Heath Three', createdBy: 'u1', members,
  invites: [], removed: [], syncedAt: Date.now(), live: true,
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  useSheet.setState({stack: []});
  useBanner.setState({banner: null});
  usePlanner.setState({picks: new Set([1, 6]), verdicts: {}, notes: {}, shared: {}});
  useCloud.setState({
    user: USER, accountName: 'Are', crewId: 'c1',
    crew: crewOf(member('u1', 'Are', {1: true, 6: true}), member('u2', 'Kari', {2: true, 6: true}), member('u3', 'Morten', {6: true, 12: true})),
  });
});

test('All of you, Where you split and the Only you / Only them expanders', () => {
  render(<CrewSection />);

  expect(screen.getByRole('heading', {name: 'All of you · 1'})).toBeInTheDocument();
  expect(screen.getByRole('heading', {name: 'Where you split · 1'})).toBeInTheDocument();
  expect(screen.getByText('Only you · 1')).toBeInTheDocument();
  expect(screen.getByText('Only them · 2')).toBeInTheDocument();

  // the split slot: one time, both choices, and who holds each
  const row = document.querySelector('.splitrow');
  expect(row.querySelector('.t')).toHaveTextContent('Sat 09:00');
  const choices = [...row.querySelectorAll('button')];
  expect(choices).toHaveLength(2);
  expect(choices.map(b => b.querySelector('.v').textContent)).toEqual(['Are', 'Kari']);

  // and the choice opens that event
  fireEvent.click(choices[1]);
  expect(useSheet.getState().stack.at(-1)).toEqual({kind: 'event', key: 2});
});

test('with nothing in common the lists say so instead of rendering empty', () => {
  usePlanner.setState({picks: new Set([1])});
  useCloud.setState({crew: crewOf(member('u1', 'Are', {1: true}), member('u2', 'Kari', {12: true}))});
  render(<CrewSection />);

  expect(screen.getByRole('heading', {name: 'All of you · 0'})).toBeInTheDocument();
  expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
  expect(screen.getByText(/No slot where you split/)).toBeInTheDocument();
});

test('the crew calendar is the union of the picks, each entry prefixed with who is going', () => {
  render(<CrewSection />);
  fireEvent.click(screen.getByRole('button', {name: 'Crew calendar (.ics)'}));

  expect(download).toHaveBeenCalledTimes(1);
  const [name, text, mime] = download.mock.calls[0];
  expect(name).toBe('htlgi-london-2026-crew.ics');
  expect(mime).toBe('text/calendar;charset=utf-8');
  expect(text).toContain('X-WR-CALNAME:HTLGI London 2026 — The Heath Three');

  // union: 1 (mine), 2 (Kari), 6 (all), 12 (Morten) — four events, no more
  expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(4);
  expect(text).toContain('DESCRIPTION:Going: you\\, Kari\\, Morten');   // event 6
  expect(text).toContain('DESCRIPTION:Going: Kari');                    // event 2, which I have not picked
});

test('an empty crew calendar says so instead of downloading an empty file', () => {
  usePlanner.setState({picks: new Set()});
  useCloud.setState({crew: crewOf(member('u1', 'Are'), member('u2', 'Kari'))});
  render(<CrewSection />);
  fireEvent.click(screen.getByRole('button', {name: 'Crew calendar (.ics)'}));

  expect(download).not.toHaveBeenCalled();
  expect(useBanner.getState().banner.text).toBe('No picks in the crew yet.');
});

test('Crew reading list opens the reading sheet; with no crew the section is not built at all', () => {
  const {unmount} = render(<CrewSection />);
  fireEvent.click(screen.getByRole('button', {name: 'Crew reading list'}));
  expect(useSheet.getState().stack.at(-1).kind).toBe('reading');
  unmount();

  useCloud.setState({crew: null, crewId: null});
  render(<CrewSection />);
  expect(screen.queryByText(/All of you/)).toBeNull();
});
