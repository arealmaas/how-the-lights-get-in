import {test, expect, beforeEach, afterEach, vi} from 'vitest';
import {act} from 'react';
import {render, fireEvent, screen} from '@testing-library/react';
import Notes from './Notes.jsx';
import {usePlanner, LS} from '../../store/planner.js';
import {useCloud} from '../../store/cloud.js';

const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com'};
const realSetNote = usePlanner.getState().setNote;
const CREW = {
  id: 'c1', name: 'The Heath Three', createdBy: 'u1',
  members: [{uid: 'u1', name: 'Are', joinedAt: 1, picks: {}, verdicts: {}, notes: {}}],
  invites: [], removed: [], syncedAt: Date.now(), live: true,
};

beforeEach(() => {
  localStorage.clear();
  usePlanner.setState({notes: {}, shared: {}, setNote: realSetNote});
  useCloud.setState({user: null, marker: null, accountName: '', crewId: null, crew: null, syncPaused: false, syncStopped: false});
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('typing debounces into the store after 250ms; a snapshot arriving while focused does not clobber the draft; blur flushes it', () => {
  const {container} = render(<Notes no={6} />);
  const textarea = container.querySelector('textarea.notes');

  textarea.focus();
  fireEvent.change(textarea, {target: {value: 'my thoughts'}});
  act(() => { vi.advanceTimersByTime(250); });
  expect(usePlanner.getState().notes[6]).toBe('my thoughts');

  act(() => { usePlanner.setState({notes: {6: 'server'}}); });
  expect(textarea.value).toBe('my thoughts');

  fireEvent.blur(textarea);
  expect(textarea.value).toBe('my thoughts');
  expect(usePlanner.getState().notes[6]).toBe('my thoughts');
});

test('unmounting with a pending debounce (no blur) still commits the latest draft', () => {
  const {container, unmount} = render(<Notes no={6} />);
  const textarea = container.querySelector('textarea.notes');

  textarea.focus();
  fireEvent.change(textarea, {target: {value: 'unsaved thoughts'}});
  expect(usePlanner.getState().notes[6]).toBeUndefined();   // debounce hasn't fired yet

  unmount();
  expect(usePlanner.getState().notes[6]).toBe('unsaved thoughts');
});

// CREW-SPEC section 7: the checkbox is the only way a note leaves this device for the crew, so it exists
// only in a crew — a signed-out or crewless planner must not offer to share anything.
test('the share checkbox appears only in a crew', () => {
  const {container, unmount} = render(<Notes no={6} />);
  expect(container.querySelector('label.share')).toBeNull();
  unmount();

  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  const second = render(<Notes no={6} />);
  expect(second.container.querySelector('label.share')).toHaveTextContent('Share this note with the crew');
});

// The old page's change handler called flushNote() before writing `shared`, because setShared copies
// whatever note the store holds into the member document: ticking mid-sentence must share the sentence.
test('ticking it commits the draft first, then shares; unticking clears the flag', () => {
  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  const {container} = render(<Notes no={6} />);
  const box = container.querySelector('label.share input');
  expect(box.checked).toBe(false);

  container.querySelector('textarea.notes').focus();
  fireEvent.change(container.querySelector('textarea.notes'), {target: {value: 'half a thought'}});
  expect(usePlanner.getState().notes[6]).toBeUndefined();   // still inside the 250ms debounce

  fireEvent.click(box);
  expect(usePlanner.getState().notes[6]).toBe('half a thought');
  expect(usePlanner.getState().shared[6]).toBe(true);
  expect(container.querySelector('label.share input').checked).toBe(true);

  fireEvent.click(container.querySelector('label.share input'));
  expect(usePlanner.getState().shared[6]).toBeUndefined();
  expect(usePlanner.getState().notes[6]).toBe('half a thought');
});

// The flush before setShared is unforced: pendingRef still catches a half-typed draft (the test above),
// but ticking and unticking a note nobody has touched must not rewrite it on every click.
test('ticking a note nobody has edited does not rewrite it', () => {
  const setNote = vi.fn();
  useCloud.setState({user: USER, crewId: 'c1', crew: CREW});
  usePlanner.setState({notes: {6: 'written last week'}, shared: {}, setNote});

  const {container} = render(<Notes no={6} />);
  fireEvent.click(container.querySelector('label.share input'));
  fireEvent.click(container.querySelector('label.share input'));

  expect(setNote).not.toHaveBeenCalled();
  expect(usePlanner.getState().shared[6]).toBeUndefined();
});

test('Save persists immediately, shows the entire note with line breaks, and Edit reopens it', () => {
  const text = 'A <b>literal</b> quote\n\n' + 'A longer thought.\n'.repeat(40) + 'The very last line.';
  render(<Notes no={6} />);
  fireEvent.change(screen.getByRole('textbox', {name: 'My note'}), {target: {value: text}});
  fireEvent.click(screen.getByRole('button', {name: 'Save note'}));
  expect(JSON.parse(localStorage.getItem(LS.notes))[6]).toBe(text);
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(document.querySelector('.note-text').textContent).toBe(text);
  expect(document.querySelector('.note-text b')).toBeNull();
  expect(screen.getByRole('button', {name: 'Edit note'})).toHaveFocus();
  fireEvent.click(screen.getByRole('button', {name: 'Edit note'}));
  const editor = screen.getByRole('textbox', {name: 'My note'});
  expect(editor).toHaveValue(text);
  expect(editor).toHaveFocus();
  fireEvent.change(editor, {target: {value: text + '\nAn edit.'}});
  fireEvent.keyDown(editor, {key: 'Enter', ctrlKey: true});
  expect(document.querySelector('.note-text').textContent).toBe(text + '\nAn edit.');
});

test('backgrounding the page saves the last keystrokes without waiting for the debounce', () => {
  render(<Notes no={6} />);
  fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Before switching apps'}});
  fireEvent(window, new Event('pagehide'));
  expect(JSON.parse(localStorage.getItem(LS.notes))[6]).toBe('Before switching apps');
});

test('a read view follows account changes, but a draft stays intact with the keyboard dismissed', () => {
  usePlanner.setState({notes: {6: 'Saved earlier'}});
  render(<Notes no={6} />);
  act(() => usePlanner.setState({notes: {6: 'Updated on another phone'}}));
  expect(document.querySelector('.note-text').textContent).toBe('Updated on another phone');
  fireEvent.click(screen.getByRole('button', {name: 'Edit note'}));
  fireEvent.change(screen.getByRole('textbox'), {target: {value: 'My current draft'}});
  fireEvent.blur(screen.getByRole('textbox'));
  act(() => usePlanner.setState({notes: {6: 'Late snapshot'}}));
  expect(screen.getByRole('textbox')).toHaveValue('My current draft');
  fireEvent.click(screen.getByRole('button', {name: 'Save note'}));
  expect(usePlanner.getState().notes[6]).toBe('My current draft');
});

test('saving reports a browser storage failure and keeps the editor open', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  render(<Notes no={6} />);
  fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Keep this safe'}});
  fireEvent.click(screen.getByRole('button', {name: 'Save note'}));
  expect(screen.getByRole('status')).toHaveTextContent('Couldn’t save');
  expect(screen.getByRole('textbox')).toHaveValue('Keep this safe');
});

test('account save feedback waits for acknowledgement and ignores an earlier draft’s result', async () => {
  const completions = [];
  useCloud.setState({user: USER, marker: {uid: USER.uid}});
  usePlanner.setState({setNote: (no, text) => ({...realSetNote(no, text), cloud: new Promise(resolve => completions.push(resolve))})});
  render(<Notes no={6} />);
  fireEvent.change(screen.getByRole('textbox'), {target: {value: 'First draft'}});
  act(() => vi.advanceTimersByTime(250));
  expect(screen.getByRole('status')).toHaveTextContent('syncing');
  fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Latest draft'}});
  act(() => vi.advanceTimersByTime(250));
  await act(async () => completions[0](true));
  expect(screen.getByRole('status')).toHaveTextContent('syncing');
  await act(async () => completions[1](true));
  expect(screen.getByRole('status')).toHaveTextContent('Saved to your account');
});

test('failed account saves keep the local copy and can be retried', async () => {
  const completions = [];
  useCloud.setState({user: USER, marker: {uid: USER.uid}});
  usePlanner.setState({setNote: (no, text) => ({...realSetNote(no, text), cloud: new Promise(resolve => completions.push(resolve))})});
  render(<Notes no={6} />);
  fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Saved locally'}});
  fireEvent.click(screen.getByRole('button', {name: 'Save note'}));
  await act(async () => completions[0](false));
  expect(screen.getByRole('status')).toHaveTextContent('account sync failed');
  expect(JSON.parse(localStorage.getItem(LS.notes))[6]).toBe('Saved locally');
  fireEvent.click(screen.getByRole('button', {name: 'Edit note'}));
  fireEvent.click(screen.getByRole('button', {name: 'Save note'}));
  await act(async () => completions[1](true));
  expect(screen.getByRole('status')).toHaveTextContent('Saved to your account');
});

test('the limit is visible, and an oversized legacy note is never silently truncated on save', () => {
  const text = 'x'.repeat(20050);
  usePlanner.setState({notes: {6: text}});
  render(<Notes no={6} />);
  expect(document.querySelector('.note-text').textContent).toBe(text);
  fireEvent.click(screen.getByRole('button', {name: 'Edit note'}));
  expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', '20000');
  fireEvent.click(screen.getByRole('button', {name: 'Save note'}));
  expect(screen.getByRole('status')).toHaveTextContent('over 20,000 characters');
  expect(usePlanner.getState().notes[6]).toBe(text);
  expect(screen.getByRole('textbox')).toHaveValue(text);
});
