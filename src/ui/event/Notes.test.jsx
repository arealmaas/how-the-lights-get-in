import {test, expect, beforeEach, afterEach, vi} from 'vitest';
import {act} from 'react';
import {render, fireEvent} from '@testing-library/react';
import Notes from './Notes.jsx';
import {usePlanner} from '../../store/planner.js';

beforeEach(() => {
  usePlanner.setState({notes: {}});
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
