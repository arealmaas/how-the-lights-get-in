import {londonNow, simulatedNow, currentNow, minutes, addMinutes, dur, isFestivalDay} from './time.js';

test('minutes converts HH:MM to minutes past midnight', () => {
  expect(minutes('09:05')).toBe(545);
  expect(minutes('00:00')).toBe(0);
});

test('addMinutes wraps past midnight', () => {
  expect(addMinutes('14:30', 60)).toBe('15:30');
  expect(addMinutes('23:50', 20)).toBe('00:10');
});

test('dur defaults to 60 minutes for every type — the festival publishes start times only', () => {
  expect(dur({type: 'Talks'})).toBe(60);
  expect(dur({type: 'Music'})).toBe(60);
});

test('isFestivalDay is true only for the festival dates', () => {
  expect(isFestivalDay('2026-09-19')).toBe(true);
  expect(isFestivalDay('2026-09-20')).toBe(true);
  expect(isFestivalDay('2099-01-01')).toBe(false);
});

test('simulatedNow reads ?now= from the search string and validates the format', () => {
  expect(simulatedNow('?now=2026-09-19T14:00')).toEqual({date: '2026-09-19', time: '14:00', simulated: true});
  expect(simulatedNow('')).toBeNull();
  expect(simulatedNow('?now=not-a-date')).toBeNull();
});

test('currentNow prefers the simulated time over the real one', () => {
  expect(currentNow('?now=2026-09-19T09:30')).toEqual({date: '2026-09-19', time: '09:30', simulated: true});
  expect(currentNow('').simulated).toBe(false);
});

test('londonNow returns a plausible date and time shape', () => {
  const now = londonNow();
  expect(now.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(now.time).toMatch(/^\d{2}:\d{2}$/);
  expect(now.simulated).toBe(false);
});
