import {EVENTS, SPEAKERS, ACTS, BRIEFINGS, BRIEF_NOTE, MEDIA, PLAYLIST, EXTRA, byNo, spkBySlug, spkByName, actBySlug, GROUP, GROUPS, VENUES, TOPICS, DAYS, PERFORMANCE, LONDON_OFFSET_MIN, PUBLIC_URL, FIREBASE, CLOUD} from './index.js';

test('the programme loads with events, speakers and acts, and byNo finds them', () => {
  expect(EVENTS.length).toBeGreaterThan(0);
  expect(SPEAKERS.length).toBeGreaterThan(0);
  expect(ACTS.length).toBeGreaterThan(0);
  expect(byNo.get(EVENTS[0].eventNo)).toBe(EVENTS[0]);
});

test('briefings are stripped of the _meta key and the note is lifted out', () => {
  expect(BRIEFINGS._meta).toBeUndefined();
  expect(Object.keys(BRIEFINGS).length).toBeGreaterThan(0);
  expect(typeof BRIEF_NOTE).toBe('string');
  expect(BRIEF_NOTE.length).toBeGreaterThan(0);
});

test('media is split into acts and films, with the playlist lifted out of _meta', () => {
  expect(Object.keys(MEDIA)).toEqual(['acts', 'films']);
  expect(MEDIA._meta).toBeUndefined();
  expect(PLAYLIST).toHaveProperty('url');
  expect(PLAYLIST).toHaveProperty('label');
});

test('speaker extras is the inner speakers map', () => {
  expect(typeof EXTRA).toBe('object');
  expect(EXTRA._meta).toBeUndefined();
});

test('lookup maps are keyed by slug and lowercased name', () => {
  const speaker = SPEAKERS.find(s => s.slug);
  expect(spkBySlug.get(speaker.slug)).toBe(speaker);
  expect(spkByName.get(speaker.name.toLowerCase())).toBe(speaker);
  const act = ACTS[0];
  expect(actBySlug.get(act.slug)).toBe(act);
});

test('the fixed festival constants are as published', () => {
  expect(DAYS).toEqual({'2026-09-19': 'Saturday', '2026-09-20': 'Sunday'});
  expect(GROUPS.length).toBe(6);
  expect(VENUES).toContain('Arena');
  expect(GROUP['Debates']).toBe('debates');
  expect(GROUP['IAI Academy']).toBe('talks');
  expect(PERFORMANCE.has('Music')).toBe(true);
  expect(LONDON_OFFSET_MIN).toBe(60);
  expect(PUBLIC_URL).toBe('https://htlgi-planner.firebaseapp.com/');
  expect(TOPICS.length).toBeGreaterThan(0);
  expect(TOPICS).toEqual([...TOPICS].sort());
});

test('there is no firebase config in this build, so cloud features are off', () => {
  expect(FIREBASE).toBeNull();
  expect(CLOUD).toBe(false);
});
