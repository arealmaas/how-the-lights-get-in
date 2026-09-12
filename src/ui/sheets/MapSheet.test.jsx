import {beforeEach, expect, test} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sheet from '../Sheet.jsx';
import {useSheet} from '../../store/sheet.js';
import {usePlanner} from '../../store/planner.js';
import {useCloud} from '../../store/cloud.js';
import {byNo} from '../../data/index.js';

beforeEach(() => {
  useSheet.setState({stack: []});
  usePlanner.setState({picks: new Set([6]), notes: {6: 'Remember this question.'}, verdicts: {}, shared: {}});
  useCloud.setState({user: null, crewId: null, crew: null});
});

test('an event opens the dated area map and Back preserves its notes, tab and reading position', async () => {
  useSheet.getState().open('event', 6);
  render(<Sheet />);
  await userEvent.click(screen.getByRole('button', {name: 'Notes', exact: true}));
  fireEvent.scroll(document.getElementById('sheet-body'), {target: {scrollTop: 120}});
  await userEvent.click(screen.getByRole('button', {name: 'Show on map'}));
  expect(screen.getByRole('heading', {name: 'Festival map'})).toHaveFocus();
  expect(screen.getByText(byNo.get(6).venue, {exact: true})).toBeVisible();
  expect(screen.getByText('2025 area map.')).toBeVisible();
  expect(screen.getByText(/Individual tents aren’t marked/)).toBeVisible();
  expect(screen.getByRole('img')).toHaveAttribute('src', 'img/maps/london-area-2025.webp');
  await userEvent.click(screen.getByRole('button', {name: '← Back', exact: true}));
  expect(screen.getByRole('heading', {name: byNo.get(6).title})).toHaveFocus();
  expect(screen.getByRole('button', {name: 'Notes', exact: true})).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Remember this question.')).toBeVisible();
  expect(screen.getByRole('button', {name: /In my picks/})).toHaveAttribute('aria-pressed', 'true');
  expect(document.getElementById('sheet-body').scrollTop).toBe(120);
});

test('zoom is bounded, survives full screen, and reset restores the map’s scroll position', async () => {
  useSheet.getState().open('map', 'Arena');
  render(<Sheet />);
  const zoomIn = screen.getByRole('button', {name: 'Zoom in'});
  const zoomOut = screen.getByRole('button', {name: 'Zoom out'});
  expect(zoomOut).toBeDisabled();
  for (let i = 0; i < 6; i++) await userEvent.click(zoomIn);
  expect(zoomIn).toBeDisabled();
  expect(screen.getByText('400%')).toBeVisible();
  await userEvent.click(screen.getByRole('button', {name: 'Full screen', exact: true}));
  expect(screen.getByText('400%')).toBeVisible();
  await userEvent.click(zoomOut);
  expect(screen.getByText('350%')).toBeVisible();
  const map = screen.getByRole('region', {name: 'Festival area map'});
  fireEvent.scroll(map, {target: {scrollTop: 170, scrollLeft: 250}});
  await userEvent.click(screen.getByRole('button', {name: 'Reset zoom'}));
  expect(screen.getByText('100%')).toBeVisible();
  expect(map.scrollTop).toBe(0);
  expect(map.scrollLeft).toBe(0);
});

test('a failed image leaves an explanation and the official source reachable', () => {
  useSheet.getState().open('map', 'Arena');
  render(<Sheet />);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('alert')).toHaveTextContent('The map couldn’t load.');
  expect(screen.getByRole('link', {name: 'Open original map ↗'})).toHaveAttribute('href', expect.stringContaining('/London-25-Area-Map.webp'));
  expect(screen.queryByRole('button', {name: 'Zoom in'})).toBeNull();
});
