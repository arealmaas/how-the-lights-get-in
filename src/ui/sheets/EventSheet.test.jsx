import {test, expect, beforeEach} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sheet from '../Sheet.jsx';
import {useSheet} from '../../store/sheet.js';
import {usePlanner} from '../../store/planner.js';
import {EVENTS} from '../../data/index.js';

const EVENT_6 = EVENTS.find(e => e.eventNo === 6);   // a debate, with a briefing that has sides

beforeEach(() => {
  localStorage.clear();
  useSheet.setState({stack: []});
  usePlanner.setState({picks: new Set(), verdicts: {}, notes: {}, shared: {}});
});

test('opening event 6 shows its title, a Who won? verdict block and the notes textarea; the pick button toggles the store', async () => {
  useSheet.getState().open('event', 6);
  render(<Sheet />);

  expect(screen.getByRole('heading', {name: EVENT_6.title})).toBeInTheDocument();
  expect(screen.getByText('Who won?')).toBeInTheDocument();
  expect(document.querySelector('textarea.notes')).toBeInTheDocument();

  expect(usePlanner.getState().picks.has(6)).toBe(false);
  await userEvent.click(screen.getByRole('button', {name: /add to my picks/i}));
  expect(usePlanner.getState().picks.has(6)).toBe(true);
});
