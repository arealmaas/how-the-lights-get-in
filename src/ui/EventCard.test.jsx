import {test, expect, vi} from 'vitest';
import {render} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventCard from './EventCard.jsx';
import {usePlanner} from '../store/planner.js';
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
