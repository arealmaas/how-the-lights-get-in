import {beforeEach, expect, test} from 'vitest';
import {act, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComparePrompt from './ComparePrompt.jsx';
import {usePlanner} from '../store/planner.js';
import {useSheet} from '../store/sheet.js';

beforeEach(() => {
  localStorage.clear();
  useSheet.setState({stack: []});
  usePlanner.setState({picks: new Set(), q: '', groups: [], venue: '', topic: '', picksOnly: true, crewOnly: false});
});

test('a soft overlap is enough to offer comparison and opens that group', async () => {
  usePlanner.setState({picks: new Set([3, 6])}); // 10:00 and 10:30
  render(<ComparePrompt day="2026-09-19" />);
  expect(screen.getByText('Saturday · 1 overlapping group')).toBeInTheDocument();
  expect(screen.getByText(/2 of your picks overlap/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', {name: 'Compare overlapping picks'}));
  expect(useSheet.getState().stack).toEqual([{kind: 'compare', key: 3}]);
});

test('pointer activation establishes an opener even when the browser does not focus buttons', () => {
  usePlanner.setState({picks: new Set([3, 6])});
  render(<ComparePrompt />);
  const button = screen.getByRole('button', {name: 'Compare overlapping picks'});
  // A bare click reproduces Safari's lack of automatic pointer focus.
  fireEvent.click(button);
  expect(button).toHaveFocus();
  expect(useSheet.getState().stack.at(-1)).toEqual({kind: 'compare', key: 3});
});

test('day scope counts every overlap on that day despite other programme filters', async () => {
  usePlanner.setState({picks: new Set([3, 4, 13, 14, 82, 83]), q: 'nothing matches this', groups: ['music'], venue: 'Stage'});
  const {rerender} = render(<ComparePrompt day="2026-09-19" />);
  expect(screen.getByText('Saturday · 2 overlapping groups')).toBeInTheDocument();
  expect(screen.getByText(/4 of your picks overlap/)).toBeInTheDocument();
  rerender(<ComparePrompt day="2026-09-20" />);
  expect(screen.getByText('Sunday · 1 overlapping group')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', {name: 'Compare overlapping picks'}));
  expect(useSheet.getState().stack.at(-1)).toEqual({kind: 'compare', key: 82});
});

test('weekend scope includes both days and updates as picks are resolved', () => {
  usePlanner.setState({picks: new Set([3, 4, 82, 83])});
  render(<ComparePrompt />);
  expect(screen.getByText('Your weekend · 2 overlapping groups')).toBeInTheDocument();
  act(() => usePlanner.setState({picks: new Set([3, 82])}));
  expect(screen.queryByRole('complementary', {name: 'Overlapping picks'})).toBeNull();
});

test('does not offer a comparison for no picks, adjoining picks, or another day', () => {
  const {rerender} = render(<ComparePrompt />);
  expect(screen.queryByRole('button')).toBeNull();
  act(() => usePlanner.setState({picks: new Set([3, 8])})); // 10:00 and 11:00
  expect(screen.queryByRole('button')).toBeNull();
  act(() => usePlanner.setState({picks: new Set([3, 4])}));
  rerender(<ComparePrompt day="2026-09-20" />);
  expect(screen.queryByRole('button')).toBeNull();
});
