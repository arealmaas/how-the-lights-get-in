// The move page itself (move/main.js), driven in jsdom: the DOM half around src/core/carry.js. It runs as
// an IIFE on import, so each case resets modules, seeds localStorage and the hash, then imports it again.
import {test, expect, beforeEach, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {encodeNotesParam, decodeNotesParam} from './notes.js';

const NEW = 'https://how-the-light-gets-in.firebaseapp.com/';
// the shape of move/index.html: the link already reaches the new site before any script runs
const page = () => {
  document.body.innerHTML =
    '<p id="carry" hidden></p><a id="btn" href="' + NEW + '">Open the planner</a>' +
    '<p><a id="new" href="' + NEW + '">how-the-light-gets-in.firebaseapp.com</a></p><p id="warn" hidden></p>';
};
const arrive = hash => {
  const loc = {hash, href: '', replace: vi.fn()};
  vi.stubGlobal('location', loc);
  return loc;
};
const btn = () => document.getElementById('btn');

beforeEach(() => { vi.resetModules(); localStorage.clear(); page(); });

test('a bare visit with nothing stored here stays on the page, which links to the new address', async () => {
  const loc = arrive('');
  await import('../../move/main.js');
  expect(loc.replace).not.toHaveBeenCalled();
  expect(btn().getAttribute('href')).toBe(NEW);
  expect(document.getElementById('carry').hidden).toBe(true);
});

test('with nothing stored here a link that points somewhere goes straight through with the fragment intact', async () => {
  const loc = arrive('#event=41&picks=3');
  await import('../../move/main.js');
  expect(loc.replace).toHaveBeenCalledWith(NEW + '#event=41&picks=3');
  expect(document.getElementById('carry').hidden).toBe(true);
});

test('with state here the link carries this browser’s state and what the link brought', async () => {
  localStorage.setItem('htlgi-l26-picks', '[3]');
  localStorage.setItem('htlgi-l26-verdicts', JSON.stringify({6: 'Hossenfelder'}));
  localStorage.setItem('htlgi-l26-notes', JSON.stringify({41: 'mine'}));
  const loc = arrive('#picks=6,41&verdicts=6:Draw;41:Draw&notes=' + encodeNotesParam({41: 'theirs', 6: 'new'}).param + '&event=41');
  await import('../../move/main.js');
  expect(loc.replace).not.toHaveBeenCalled();
  expect(document.getElementById('carry').hidden).toBe(false);
  const href = btn().getAttribute('href');
  expect(href.startsWith(NEW + '#')).toBe(true);
  expect(btn().textContent).toMatch(/picks and notes/);
  const q = Object.fromEntries(href.slice(NEW.length + 1).split('&').map(kv => kv.split('=')));
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

// The address is written twice — as the no-JavaScript href in the markup and as NEW in the script. They
// must not drift, or the page would offer two different destinations.
test('the markup and the script name the same address', () => {
  const html = readFileSync(join(import.meta.dirname, '../../move/index.html'), 'utf8');
  const js = readFileSync(join(import.meta.dirname, '../../move/main.js'), 'utf8');
  expect(js).toContain("const NEW = '" + NEW + "'");
  expect(html).toContain('href="' + NEW + '"');
  expect(html).toContain('<link rel="canonical" href="' + NEW + '">');
  // every element move/main.js reaches for has to exist in the page it runs on
  for (const id of ['carry', 'btn', 'warn']) expect(html).toContain('id="' + id + '"');
});
