import {test, expect, afterEach, beforeEach, vi} from 'vitest';
import {act, render, screen} from '@testing-library/react';
import App from './App.jsx';
import {usePlanner} from './store/planner.js';
import {useSheet} from './store/sheet.js';

beforeEach(() => {
  useSheet.setState({stack: []});
  usePlanner.setState({day: '2026-09-19', view: 'list', picks: new Set(), q: '', groups: [], venue: '', topic: '', picksOnly: false, crewOnly: false});
});

// VITE_PREVIEW is stubbed below; a test that fails part-way through would otherwise leave it set for
// every file that runs after this one.
afterEach(() => { vi.unstubAllEnvs(); });

test('renders the masthead', () => {
  render(<App />);
  expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('HowTheLightGetsIn');
});

// The PR workflow builds with VITE_PREVIEW="PR #12"; the live build has no such variable, so neither the
// ribbon nor the robots tag exists there.
test('a preview build carries the ribbon and a noindex tag; a live build carries neither', () => {
  const {unmount} = render(<App />);
  expect(document.querySelector('.previewtag')).toBeNull();
  expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  unmount();

  vi.stubEnv('VITE_PREVIEW', 'PR #7');
  render(<App />);
  expect(document.querySelector('.previewtag').textContent).toBe('Preview build · PR #7 · not the live site');
  expect(document.head.querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex');
});

test('the programme offers comparison only in My picks and keeps it visible through other filters', () => {
  usePlanner.setState({picks: new Set([3, 6, 82, 83]), q: 'no matching events'});
  render(<App />);
  expect(screen.queryByRole('button', {name: 'Compare overlapping picks'})).toBeNull();
  act(() => usePlanner.setState({picksOnly: true}));
  expect(screen.getByRole('button', {name: 'Compare overlapping picks'})).toBeInTheDocument();
  expect(screen.getByText('Saturday · 1 overlapping group')).toBeInTheDocument();
  act(() => usePlanner.setState({day: '2026-09-20', view: 'grid'}));
  expect(screen.getByText('Sunday · 1 overlapping group')).toBeInTheDocument();
});
