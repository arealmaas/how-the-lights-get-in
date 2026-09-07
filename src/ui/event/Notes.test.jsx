import {test, expect, beforeEach, afterEach, vi} from 'vitest';
import {act} from 'react';
import {render, fireEvent} from '@testing-library/react';
import Notes from './Notes.jsx';
import {usePlanner} from '../../store/planner.js';
import {useCloud} from '../../store/cloud.js';

const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com'};
const CREW = {
  id: 'c1', name: 'The Heath Three', createdBy: 'u1',
  members: [{uid: 'u1', name: 'Are', joinedAt: 1, picks: {}, verdicts: {}, notes: {}}],
  invites: [], removed: [], syncedAt: Date.now(), live: true,
};

beforeEach(() => {
  localStorage.clear();
  usePlanner.setState({notes: {}, shared: {}});
  useCloud.setState({user: null, accountName: '', crewId: null, crew: null});
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
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
