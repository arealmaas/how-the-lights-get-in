import {ticketBadge, ticketLine, whoPlain, initials, slug, cleanDesc, ytId} from './labels.js';

test('ticketBadge returns plain data for each ticketing state', () => {
  expect(ticketBadge({ticketing: 'sold_out'})).toEqual({cls: 'badge sold', text: 'Sold out'});
  expect(ticketBadge({ticketing: 'fast_pass', fastPassPrice: 12})).toEqual({cls: 'badge', text: 'Fast Pass £12'});
  expect(ticketBadge({ticketing: 'fast_pass'})).toEqual({cls: 'badge', text: 'Fast Pass'});
  expect(ticketBadge({ticketing: 'separate_ticket', prices: {standard: 20}})).toEqual({cls: 'badge sep', text: 'Separate ticket · from £20'});
  expect(ticketBadge({ticketing: 'included'})).toEqual({cls: 'badge', text: 'Included'});
});

test('ticketLine spells out the ticketing state in full', () => {
  expect(ticketLine({ticketing: 'included'})).toBe('Included with the Festival Ticket');
  expect(ticketLine({ticketing: 'sold_out'})).toBe('Separately ticketed · sold out');
  expect(ticketLine({ticketing: 'separate_ticket', prices: {earlybird: 10, standard: 20}}))
    .toBe('Not included with the Festival Ticket · Earlybird £10 / Standard £20 (+ VAT)');
  expect(ticketLine({ticketing: 'fast_pass', fastPassPrice: 8}))
    .toBe('Included with the Festival Ticket · optional Fast Pass £8 + VAT (skip the queue, reserved seat)');
});

test('whoPlain joins speakers and hosts without markup', () => {
  expect(whoPlain({speakers: ['Sam Harris'], hosts: []})).toBe('Sam Harris');
  expect(whoPlain({speakers: ['Sam Harris'], hosts: ['Jo']})).toBe('Sam Harris · hosted by Jo');
  expect(whoPlain({speakers: [], hosts: []})).toBe('');
});

test('initials takes the first and last name', () => {
  expect(initials('Sabine Hossenfelder')).toBe('SH');
  expect(initials('Cher')).toBe('C');
  expect(initials('')).toBe('');
});

test('slug lowercases, strips accents and punctuation', () => {
  expect(slug('Café Society & Co.')).toBe('cafe-society-and-co');
});

test('cleanDesc strips the menu footnote', () => {
  expect(cleanDesc('A talk. Click here to view the full menu.')).toBe('A talk.');
  expect(cleanDesc(undefined)).toBe('');
});

test('ytId extracts the video id from common YouTube URL shapes', () => {
  expect(ytId('https://www.youtube.com/watch?v=abc12345XY')).toBe('abc12345XY');
  expect(ytId('https://youtu.be/abc12345XY')).toBe('abc12345XY');
  expect(ytId('https://example.com')).toBeNull();
});
