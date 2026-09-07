import {test, expect, vi} from 'vitest';
import {render, fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventCard from './EventCard.jsx';
import {usePlanner} from '../store/planner.js';
import {useSheet} from '../store/sheet.js';
import {EVENTS} from '../data/index.js';

test('a picked event with a clash and a note shows the star, note badge and clash text; the star toggles the pick', async () => {
  const togglePick = vi.fn();
  usePlanner.setState({togglePick});

  const e = EVENTS[0];
  const other = EVENTS[1];
  const {container} = render(
    <EventCard e={e} picked={true} clash={[{no: other.eventNo, min: 50}]} hasNote={true} />
  );

  const star = container.querySelector('button.pick');
  expect(star).toHaveAttribute('aria-pressed', 'true');
  expect(container.querySelector('.badge.note')).toHaveTextContent('✎ notes');
  expect(container.querySelector('.badge.clash')).toHaveTextContent(`⚠ Clashes with ${other.title}`);

  await userEvent.click(star);
  expect(togglePick).toHaveBeenCalledWith(e.eventNo);
});

test('keyboard Enter on the nested star does not open the sheet; Enter on the card itself does', () => {
  const open = vi.fn();
  useSheet.setState({open});

  const e = EVENTS[0];
  const {container} = render(<EventCard e={e} picked={false} clash={null} hasNote={false} />);

  const star = container.querySelector('button.pick');
  fireEvent.keyDown(star, {key: 'Enter'});
  expect(open).not.toHaveBeenCalled();

  const article = container.querySelector('article.ev');
  fireEvent.keyDown(article, {key: 'Enter'});
  expect(open).toHaveBeenCalledWith('event', e.eventNo);
});
