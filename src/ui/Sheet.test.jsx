import {afterEach, beforeEach, expect, test, vi} from 'vitest';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sheet from './Sheet.jsx';
import ComparePrompt from './ComparePrompt.jsx';
import {useSheet} from '../store/sheet.js';
import {usePlanner} from '../store/planner.js';
import {useCloud} from '../store/cloud.js';
import {byNo} from '../data/index.js';

beforeEach(() => {
  localStorage.clear();
  useSheet.setState({stack: []});
  usePlanner.setState({picks: new Set(), verdicts: {}, notes: {}, shared: {}});
  useCloud.setState({user: null, accountName: '', marker: null, crewId: null, crew: null});
});
afterEach(() => { vi.restoreAllMocks(); });

test('Back restores each stack entry’s scroll and event tab, even when an event appears twice', async () => {
  useSheet.getState().open('event', 6);
  render(<Sheet />);
  const body = document.getElementById('sheet-body');
  await userEvent.click(screen.getByRole('button', {name: 'Briefing', exact: true}));
  fireEvent.scroll(body, {target: {scrollTop: 340}});

  const speaker = byNo.get(6).people.find(person => person.slug);
  act(() => useSheet.getState().open('speaker', speaker.slug));
  expect(body.scrollTop).toBe(0);
  fireEvent.scroll(body, {target: {scrollTop: 180}});

  act(() => useSheet.getState().open('event', 6));
  expect(screen.getByRole('button', {name: 'Overview', exact: true})).toHaveAttribute('aria-pressed', 'true');
  expect(body.scrollTop).toBe(0);
  await userEvent.click(screen.getByRole('button', {name: 'Notes', exact: true}));
  fireEvent.scroll(body, {target: {scrollTop: 90}});

  await userEvent.click(screen.getByRole('button', {name: '← Back', exact: true}));
  expect(body.scrollTop).toBe(180);
  await userEvent.click(screen.getByRole('button', {name: '← Back', exact: true}));
  expect(screen.getByRole('button', {name: 'Briefing', exact: true})).toHaveAttribute('aria-pressed', 'true');
  expect(body.scrollTop).toBe(340);
  expect(screen.getByRole('heading', {name: byNo.get(6).title})).toHaveFocus();

  await userEvent.click(screen.getByRole('button', {name: 'Close', exact: true}));
  act(() => useSheet.getState().open('event', 6));
  expect(screen.getByRole('button', {name: 'Overview', exact: true})).toHaveAttribute('aria-pressed', 'true');
  expect(body.scrollTop).toBe(0);
});

test('history restores the outgoing scroll position even before its scroll event is delivered', async () => {
  useSheet.getState().open('event', 6);
  render(<Sheet />);
  const body = document.getElementById('sheet-body');
  body.scrollTop = 110;
  const speaker = byNo.get(6).people.find(person => person.slug);
  act(() => useSheet.getState().open('speaker', speaker.slug));
  body.scrollTop = 180;
  act(() => useSheet.getState().open('event', 6));
  await userEvent.click(screen.getByRole('button', {name: 'Briefing', exact: true}));
  body.scrollTop = 260;
  const forwardStack = useSheet.getState().stack;

  // Browser history restores the existing entries directly. No scroll event has
  // fired for any of these positions before the next navigation starts.
  act(() => useSheet.setState({stack: forwardStack.slice(0, -1)}));
  expect(body.scrollTop).toBe(180);
  act(() => useSheet.setState({stack: forwardStack}));
  expect(screen.getByRole('button', {name: 'Briefing', exact: true})).toHaveAttribute('aria-pressed', 'true');
  expect(body.scrollTop).toBe(260);
  act(() => useSheet.setState({stack: forwardStack.slice(0, 1)}));
  expect(screen.getByRole('button', {name: 'Overview', exact: true})).toHaveAttribute('aria-pressed', 'true');
  expect(body.scrollTop).toBe(110);
});

test('Tab moves between banner and dialog controls without entering the background', async () => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function(){
    return this.closest('[hidden]') ? [] : [new DOMRect(0, 0, 100, 40)];
  });
  useSheet.getState().open('event', 6);
  render(<>
    <div className="banner"><button>Accept invitation</button><button>Dismiss invitation</button></div>
    <button>Background programme action</button>
    <Sheet />
  </>);
  const accept = screen.getByRole('button', {name: 'Accept invitation'});
  const dismiss = screen.getByRole('button', {name: 'Dismiss invitation'});
  const expand = screen.getByRole('button', {name: 'Full screen', exact: true});
  const last = screen.getByRole('link', {name: 'Google Calendar ↗'});
  accept.focus();
  await userEvent.tab();
  expect(dismiss).toHaveFocus();
  await userEvent.tab();
  expect(expand).toHaveFocus();
  await userEvent.tab({shift: true});
  expect(dismiss).toHaveFocus();
  accept.focus();
  await userEvent.tab({shift: true});
  expect(last).toHaveFocus();
  await userEvent.tab();
  expect(accept).toHaveFocus();
});

test('Edit note focuses and reveals the editor on entry, then Back restores its cached position', async () => {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function(){
    return this.classList.contains('event-tabs') ? 44 : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(){
    return new DOMRect(0, this.classList.contains('note-card') ? 600 : 100, 100, 100);
  });
  usePlanner.setState({notes: {6: 'A thought to revise'}});
  render(<Sheet />);
  act(() => useSheet.getState().open('event', 6, 'edit-note'));
  const body = document.getElementById('sheet-body');
  expect(screen.getByRole('textbox', {name: 'My note'})).toHaveFocus();
  expect(body.scrollTop).toBe(444); // leave the section strip and a gap above the note toolbar
  fireEvent.scroll(body, {target: {scrollTop: 640}});
  act(() => useSheet.getState().open('event', 7));
  await userEvent.click(screen.getByRole('button', {name: '← Back', exact: true}));
  expect(screen.getByRole('heading', {name: byNo.get(6).title})).toHaveFocus();
  expect(body.scrollTop).toBe(640);
  expect(screen.getByRole('textbox', {name: 'My note'})).toHaveValue('A thought to revise');
});

test('comparison slot changes replace the opening event while preserving retained options and Undo', async () => {
  usePlanner.setState({picks: new Set([3, 4, 13, 14])});
  useSheet.getState().open('compare', 3);
  render(<Sheet />);
  const firstOption = screen.getByRole('article', {name: byNo.get(3).title});
  await userEvent.click(within(firstOption).getByRole('button', {name: 'Choose this event'}));
  expect(usePlanner.getState().picks.has(4)).toBe(false);
  const slots = screen.getByRole('group', {name: 'Overlapping time slots'});
  await userEvent.click(within(slots).getByRole('button', {name: 'Saturday 12:00 · 2 options'}));
  expect(useSheet.getState().stack).toEqual([{kind: 'compare', key: 13}]);
  expect(screen.getByRole('button', {name: 'Undo choice'})).toBeVisible();
  await userEvent.click(within(slots).getByRole('button', {name: 'Saturday 10:00 · 2 options'}));
  expect(useSheet.getState().stack).toEqual([{kind: 'compare', key: 3}]);
  expect(screen.getByRole('article', {name: byNo.get(4).title})).toBeVisible();
  await userEvent.click(screen.getByRole('button', {name: 'Undo choice'}));
  expect(usePlanner.getState().picks).toEqual(new Set([3, 4, 13, 14]));
});

test('the dialog focus trap reaches native comparison disclosures with Tab', async () => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function(){
    if (this.closest('[hidden]')) return [];
    const details = this.closest('details');
    if (details && !details.open && this.tagName !== 'SUMMARY') return [];
    return [new DOMRect(0, 0, 100, 40)];
  });
  usePlanner.setState({picks: new Set([3, 4])});
  useSheet.getState().open('compare', 3);
  render(<Sheet />);
  const firstSummary = document.querySelector('.compare-details summary');
  // The timeline's last event link directly precedes the first option's disclosure.
  const timeline = screen.getByRole('region', {name: 'Overlap timeline'});
  within(timeline).getAllByRole('button').at(-1).focus();
  await userEvent.tab();
  expect(firstSummary).toHaveFocus();
  await userEvent.tab({shift: true});
  expect(within(timeline).getAllByRole('button').at(-1)).toHaveFocus();
});

test.each([false, true])('Close restores useful focus after the comparison opener disappears (undo: %s)', async undo => {
  usePlanner.setState({picks: new Set([3, 4])});
  render(<><main id="main" tabIndex={-1}><ComparePrompt day="2026-09-19" /></main><Sheet /></>);
  const original = screen.getByRole('button', {name: 'Compare overlapping picks'});
  await userEvent.click(original);
  const firstOption = screen.getByRole('article', {name: byNo.get(3).title});
  await userEvent.click(within(firstOption).getByRole('button', {name: 'Choose this event'}));
  expect(original.isConnected).toBe(false);
  if (undo) await userEvent.click(screen.getByRole('button', {name: 'Undo choice'}));
  await userEvent.click(screen.getByRole('button', {name: 'Close', exact: true}));
  expect(undo ? screen.getByRole('button', {name: 'Compare overlapping picks'}) : document.getElementById('main')).toHaveFocus();
});
