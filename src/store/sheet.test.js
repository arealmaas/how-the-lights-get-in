import {useSheet, topSheet} from './sheet.js';

beforeEach(() => { useSheet.setState({stack: []}); });

test('opening two sheets makes the second one topSheet', () => {
  useSheet.getState().open('event', 3);
  useSheet.getState().open('speaker', 'jane-doe');
  expect(topSheet()).toEqual({kind: 'speaker', key: 'jane-doe'});
});

test('back returns to the first sheet', () => {
  useSheet.getState().open('event', 3);
  useSheet.getState().open('speaker', 'jane-doe');
  useSheet.getState().back();
  expect(topSheet()).toEqual({kind: 'event', key: 3});
});

test('close empties the stack', () => {
  useSheet.getState().open('event', 3);
  useSheet.getState().open('speaker', 'jane-doe');
  useSheet.getState().close();
  expect(topSheet()).toBeNull();
  expect(useSheet.getState().stack).toEqual([]);
});

// A sheet entry may carry an opening mode (the hub's "Crew reading list" → the reading sheet's Crew tab).
// It is only present when asked for, so every other entry keeps exactly the shape it had.
test('an entry carries an optional mode, and only when one is given', () => {
  useSheet.getState().open('reading', undefined, 'crew');
  expect(topSheet()).toEqual({kind: 'reading', key: undefined, mode: 'crew'});

  useSheet.getState().open('event', 3);
  expect(Object.keys(topSheet())).toEqual(['kind', 'key']);

  useSheet.getState().replaceTop('reading', undefined, 'crew');
  expect(topSheet()).toEqual({kind: 'reading', key: undefined, mode: 'crew'});
  expect(useSheet.getState().stack).toHaveLength(2);
});
