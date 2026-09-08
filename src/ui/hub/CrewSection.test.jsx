// The My festival crew section (CREW-SPEC section 7 "My festival crew section"): the crew's plan by day,
// the crew calendar built from it (with its "Going:" prefix), then the three summary lists and the split
// slot over everyone's own picks. download() is mocked so the .ics text can be read straight out of the
// call.
import {test, expect, beforeEach, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import CrewSection from './CrewSection.jsx';
import {useCloud} from '../../store/cloud.js';
import {usePlanner} from '../../store/planner.js';
import {useSheet} from '../../store/sheet.js';
import {useBanner} from '../../store/banner.js';
import {byNo} from '../../data/index.js';

vi.mock('../download.js', () => ({download: vi.fn()}));
const {download} = await import('../download.js');

// events 1 and 2 share the 09:00 Saturday slot (the split); 6 is 10:30, 12 is 11:45
const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com'};
const member = (uid, name, picks = {}) => ({uid, name, joinedAt: 1, picks, verdicts: {}, notes: {}});
const crewOf = (members, picks = {}) => ({
  id: 'c1', name: 'The Heath Three', createdBy: 'u1', picks, members,
  invites: [], removed: [], syncedAt: Date.now(), live: true,
});
const MEMBERS = [member('u1', 'Are', {1: true, 6: true}), member('u2', 'Kari', {2: true, 6: true}), member('u3', 'Morten', {6: true, 12: true})];

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  useSheet.setState({stack: []});
  useBanner.setState({banner: null});
  usePlanner.setState({picks: new Set([1, 6]), verdicts: {}, notes: {}, shared: {}});
  // the plan: 6 (everyone has starred it, Kari added it), 12 (Morten's, Morten added it) and Sunday's 80
  // (nobody has starred it yet; I added it). 1 and 2 are starred but not planned.
  useCloud.setState({user: USER, accountName: 'Are', crewId: 'c1', crew: crewOf(MEMBERS, {6: 'u2', 12: 'u3', 80: 'u1'})});
});

test('the crew plan comes first, by day, each row saying who is going and who added it', () => {
  render(<CrewSection />);

  const headings = [...document.querySelectorAll('h3.sub')].map(h => h.textContent);
  expect(headings[0]).toBe('Crew plan · 3');
  expect([...document.querySelectorAll('.planday')].map(p => p.textContent)).toEqual(['Saturday · 2', 'Sunday · 1']);

  const rows = [...document.querySelectorAll('.hub-list')].slice(0, 2).flatMap(l => [...l.querySelectorAll('li')]);
  const titles = rows.map(r => r.querySelector('.n').textContent);
  expect(titles).toEqual([6, 12, 80].map(no => byNo.get(no).title));
  const marks = rows.map(r => r.querySelector('.m .xtra').textContent);
  expect(marks[0]).toBe('Going: Are, Kari, Morten · added by Kari');   // me first, under my account name
  expect(marks[1]).toBe('Going: Morten · added by Morten');
  expect(marks[2]).toBe('Nobody going yet · added by Are');

  fireEvent.click(rows[2].querySelector('button'));
  expect(useSheet.getState().stack.at(-1)).toEqual({kind: 'event', key: 80});
});

test('an empty plan says how to add to it, and an entry added by someone who has left has no name', () => {
  useCloud.setState({crew: crewOf(MEMBERS, {})});
  const {unmount} = render(<CrewSection />);
  expect(screen.getByRole('heading', {name: 'Crew plan · 0'})).toBeInTheDocument();
  expect(screen.getByText(/Nothing in the crew’s plan yet/)).toBeInTheDocument();
  expect(document.querySelector('.planday')).toBeNull();
  unmount();

  useCloud.setState({crew: crewOf(MEMBERS, {12: 'gone'})});
  render(<CrewSection />);
  expect(document.querySelector('.hub-list .m .xtra').textContent).toBe('Going: Morten');
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

// Starring an event is local first; my member document catches up a sync round trip later. "Only you"
// and the crew calendar must agree the moment the star lands, not a second afterwards.
test('a just-starred event counts as mine before my member document catches up', () => {
  usePlanner.setState({picks: new Set([1, 6, 12])});   // 12 is Morten's; the member document has 1 and 6
  render(<CrewSection />);

  expect(screen.getByText('Only them · 1')).toBeInTheDocument();          // 2 only; 12 has just become shared
  expect(screen.getByRole('heading', {name: 'All of you · 1'})).toBeInTheDocument();

  const [, onlyThem] = document.querySelectorAll('details.hub-more');
  expect(onlyThem.textContent).toContain('Philosophy Breakfast with David Aaronovitch');   // event 2, Kari's
  expect(onlyThem.textContent).not.toContain('The Cult of the Internet');                  // event 12, now mine too
});

test('with nothing in common the lists say so instead of rendering empty', () => {
  usePlanner.setState({picks: new Set([1])});
  useCloud.setState({crew: crewOf([member('u1', 'Are', {1: true}), member('u2', 'Kari', {12: true})])});
  render(<CrewSection />);

  expect(screen.getByRole('heading', {name: 'All of you · 0'})).toBeInTheDocument();
  expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
  expect(screen.getByText(/No slot where you split/)).toBeInTheDocument();
});

test('the crew calendar is the plan, each entry prefixed with who is going', () => {
  render(<CrewSection />);
  fireEvent.click(screen.getByRole('button', {name: 'Crew calendar (.ics)'}));

  expect(download).toHaveBeenCalledTimes(1);
  const [name, text, mime] = download.mock.calls[0];
  expect(name).toBe('htlgi-london-2026-crew.ics');
  expect(mime).toBe('text/calendar;charset=utf-8');
  expect(text).toContain('X-WR-CALNAME:HTLGI London 2026 — The Heath Three');

  // the plan: 6, 12 and 80 — three events; the starred-but-unplanned 1 and 2 are not in it
  expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  expect(text).not.toContain(byNo.get(2).title);
  expect(text).toContain('DESCRIPTION:Going: Are\\, Kari\\, Morten');   // event 6, me under my account name
  expect(text).toContain('DESCRIPTION:Going: Morten');                  // event 12, which I have not picked
  expect(text).toContain('DESCRIPTION:In the crew’s plan');             // event 80, which nobody has starred
});

test('an empty crew calendar says so instead of downloading an empty file', () => {
  useCloud.setState({crew: crewOf(MEMBERS, {})});
  render(<CrewSection />);
  fireEvent.click(screen.getByRole('button', {name: 'Crew calendar (.ics)'}));

  expect(download).not.toHaveBeenCalled();
  expect(useBanner.getState().banner.text).toBe('Nothing in the crew’s plan yet.');
});

test('Crew reading list opens the reading sheet on its Crew tab; with no crew the section is not built', () => {
  const {unmount} = render(<CrewSection />);
  fireEvent.click(screen.getByRole('button', {name: 'Crew reading list'}));
  expect(useSheet.getState().stack.at(-1)).toEqual({kind: 'reading', key: undefined, mode: 'crew'});
  unmount();

  useCloud.setState({crew: null, crewId: null});
  render(<CrewSection />);
  expect(screen.queryByText(/All of you/)).toBeNull();
});
