import {runInNewContext} from 'node:vm';
import script from '../../scripts/extract-in-browser.js?raw';
import fixture from '../../tests/fixtures/festival-ticketing.html?raw';

test('official ticket markup distinguishes event admission, available tiers, and Fast Pass availability', async () => {
  const extractedWindow = {};
  const doc = document.implementation.createHTMLDocument();
  const download = doc.createElement('a');
  download.click = () => {};
  const fetch = async path => ({
    ok: true,
    text: async () => path === '/FullEventListPage_Controller/getevents?offset=0&limit=40&isInternationalFestival=0&festival=london' ? fixture : '',
  });
  await runInNewContext(script, {
    DOMParser, Blob, fetch, window: extractedWindow,
    document: {body: doc.body, createElement: () => download},
    URL: {createObjectURL: () => 'blob:extract-test'},
    location: {href: 'https://howthelightgetsin.org/festivals/london/programme'},
    console: {log() {}, warn() {}},
  });
  const events = Object.fromEntries(extractedWindow.__extract.events.map(event => [event.eventNo, event]));
  expect(Object.keys(events)).toHaveLength(8);
  expect(events[1]).toMatchObject({ticketing: 'sold_out', prices: null});
  expect(events[10]).toMatchObject({ticketing: 'included', fastPassPrice: null});
  expect(events[10]).not.toHaveProperty('fastPassSoldOut');
  expect(events[3]).toMatchObject({ticketing: 'fast_pass', fastPassPrice: 9.6});
  expect(events[3]).not.toHaveProperty('fastPassSoldOut');
  expect(events[12]).toMatchObject({ticketing: 'fast_pass', fastPassSoldOut: true, fastPassPrice: null});
  expect(events[70]).toMatchObject({ticketing: 'sold_out', fastPassPrice: null});
  expect(events[70]).not.toHaveProperty('fastPassSoldOut');
  expect(events[81]).toMatchObject({ticketing: 'sold_out', fastPassPrice: null});
  expect(events[81]).not.toHaveProperty('fastPassSoldOut');
  expect(events[20]).toMatchObject({ticketing: 'separate_ticket', prices: {standard: 50.4}});
  expect(events[118]).toMatchObject({ticketing: 'separate_ticket', prices: {standard: 38.4}});
  expect(Object.keys(events[20].prices)).toEqual(['standard']);
  expect(Object.keys(events[118].prices)).toEqual(['standard']);
});
