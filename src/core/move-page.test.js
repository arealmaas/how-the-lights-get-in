// The move page itself (move/main.js), driven in jsdom: the DOM half around src/core/carry.js. It runs as
// an IIFE on import, so each case resets modules, seeds localStorage and the hash, then imports it again.
import {test, expect, beforeEach, vi} from 'vitest';
import {encodeNotesParam, decodeNotesParam} from './notes.js';

const NEW = 'https://how-the-light-gets-in.firebaseapp.com/';
const page = () => {
  document.body.innerHTML = '<a id="new"></a><div id="carry" hidden></div><div id="go" hidden><button id="btn"></button></div><p id="warn" hidden></p>';
};
const arrive = hash => {
  const loc = {hash, href: '', replace: vi.fn()};
  vi.stubGlobal('location', loc);
  return loc;
};

beforeEach(() => { vi.resetModules(); localStorage.clear(); page(); });

test('with nothing stored here the visitor goes straight through with the fragment intact', async () => {
  const loc = arrive('#event=41&picks=3');
  await import('../../move/main.js');
  expect(loc.replace).toHaveBeenCalledWith(NEW + '#event=41&picks=3');
  expect(document.getElementById('carry').hidden).toBe(true);
});

test('with state here the button builds a link that carries this browser’s state and what the link brought', async () => {
  localStorage.setItem('htlgi-l26-picks', '[3]');
  localStorage.setItem('htlgi-l26-verdicts', JSON.stringify({6: 'Hossenfelder'}));
  localStorage.setItem('htlgi-l26-notes', JSON.stringify({41: 'mine'}));
  const loc = arrive('#picks=6,41&verdicts=6:Draw;41:Draw&notes=' + encodeNotesParam({41: 'theirs', 6: 'new'}).param + '&event=41');
  await import('../../move/main.js');
  expect(loc.replace).not.toHaveBeenCalled();
  expect(document.getElementById('carry').hidden).toBe(false);
  document.getElementById('btn').click();
  expect(loc.href.startsWith(NEW + '#')).toBe(true);
  const q = Object.fromEntries(loc.href.slice(NEW.length + 1).split('&').map(kv => kv.split('=')));
  expect(q.picks).toBe('3,6,41');
  expect(q.verdicts).toBe('6:Hossenfelder;41:Draw');
  expect(decodeNotesParam(q.notes)).toEqual({41: 'mine\n\n---\n\ntheirs', 6: 'new'});
  expect(q.event).toBe('41');
  expect(document.getElementById('warn').hidden).toBe(true);
});

test('a note too long for the link is reported, not silently dropped', async () => {
  localStorage.setItem('htlgi-l26-notes', JSON.stringify({41: 'x'.repeat(40000)}));
  arrive('');
  await import('../../move/main.js');
  const warn = document.getElementById('warn');
  expect(warn.hidden).toBe(false);
  expect(warn.textContent).toMatch(/very long note/);
});
