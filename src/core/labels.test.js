import {ticketBadge, ticketLine, whoPlain, initials, slug, cleanDesc, ytId} from './labels.js';

test('ticketBadge returns plain data for each ticketing state', () => {
  expect(ticketBadge({ticketing: 'sold_out'})).toEqual({cls: 'badge sold', text: 'Sold out'});
  expect(ticketBadge({ticketing: 'fast_pass', fastPassPrice: 12})).toEqual({cls: 'badge', text: 'Included · optional Fast Pass'});
  expect(ticketBadge({ticketing: 'fast_pass'})).toEqual({cls: 'badge', text: 'Included · optional Fast Pass'});
  expect(ticketBadge({ticketing: 'separate_ticket', prices: {standard: 20}})).toEqual({cls: 'badge sep', text: 'Separate ticket · from £20'});
  expect(ticketBadge({ticketing: 'separate_ticket', prices: {standard: 50.4}})).toEqual({cls: 'badge sep', text: 'Separate ticket · from £50.40'});
  expect(ticketBadge({ticketing: 'included'})).toEqual({cls: 'badge', text: 'Included'});
});

test('ticketLine spells out the ticketing state in full', () => {
  expect(ticketLine({ticketing: 'included'})).toBe('Included with the Festival Ticket');
  expect(ticketLine({ticketing: 'sold_out'})).toBe('Sold out');
  expect(ticketLine({ticketing: 'separate_ticket', prices: {earlybird: 10, standard: 20}}))
    .toBe('Not included with the Festival Ticket · Earlybird £10 / Standard £20');
  expect(ticketLine({ticketing: 'fast_pass', fastPassPrice: 9.6}))
    .toBe('Included with the Festival Ticket · optional Fast Pass £9.60 (skip the queue, reserved seat)');
});

test('sold-out Fast Passes leave festival admission included', () => {
  const event = {ticketing: 'fast_pass', fastPassSoldOut: true, fastPassPrice: 9.6};
  expect(ticketBadge(event)).toEqual({cls: 'badge', text: 'Included · Fast Passes sold out'});
  expect(ticketLine(event)).toBe('Included with the Festival Ticket · Fast Passes sold out');
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
