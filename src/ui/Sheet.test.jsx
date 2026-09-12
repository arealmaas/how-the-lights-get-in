import {afterEach, beforeEach, expect, test, vi} from 'vitest';
import {act, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sheet from './Sheet.jsx';
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
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(){
    return new DOMRect(0, this.classList.contains('note-card') ? 600 : 100, 100, 100);
  });
  usePlanner.setState({notes: {6: 'A thought to revise'}});
  render(<Sheet />);
  act(() => useSheet.getState().open('event', 6, 'edit-note'));
  const body = document.getElementById('sheet-body');
  expect(screen.getByRole('textbox', {name: 'My note'})).toHaveFocus();
  expect(body.scrollTop).toBe(488);
  fireEvent.scroll(body, {target: {scrollTop: 640}});
  act(() => useSheet.getState().open('event', 7));
  await userEvent.click(screen.getByRole('button', {name: '← Back', exact: true}));
  expect(screen.getByRole('heading', {name: byNo.get(6).title})).toHaveFocus();
  expect(body.scrollTop).toBe(640);
  expect(screen.getByRole('textbox', {name: 'My note'})).toHaveValue('A thought to revise');
});
