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
