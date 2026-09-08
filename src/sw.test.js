// Ports scripts/test/sw.test.mjs's vm sandbox to Vitest, against the injectManifest source (src/sw.js).
// The real build replaces `self.__WB_MANIFEST` with an array literal before this file ever runs in a worker;
// here we simulate that by prepending the assignment to the source text handed to vm.runInNewContext.
import fs from 'node:fs';
import vm from 'node:vm';

const MANIFEST_PRELUDE = "self.__WB_MANIFEST = [{url: 'index.html', revision: '1'}, {url: 'assets/a.js', revision: '2'}, {url: 'img/x.webp', revision: null}];\n";

// Evaluates src/sw.js in a sandbox with a fake service-worker global and returns the captured listeners.
// `fetchImpl` defaults to an offline rejection (every exercised path that keeps the response promise around
// attaches its own .catch); the image-cache path has no catch, so that test passes a resolving fetch instead.
function loadSw(scope, {fetchImpl = () => Promise.reject(new Error('offline'))} = {}){
  const listeners = {};
  const deleted = [];
  const opened = [];
  const cacheNames = ['htlgi-img-v1', 'htlgi-live-firebaseapp-com-old1', 'htlgi-live-firebaseapp-com-old2', 'htlgi-pr-7-web-app-abc'];
  const sandbox = {
    self: {
      addEventListener: (type, fn) => { listeners[type] = fn; },
      registration: {scope},
      location: new URL(scope),
      skipWaiting: () => Promise.resolve(),
      clients: {claim: () => Promise.resolve()},
    },
    caches: {
      keys: () => Promise.resolve(cacheNames),
      delete: n => { deleted.push(n); return Promise.resolve(true); },
      open: n => { opened.push(n); return Promise.resolve({addAll: () => Promise.resolve(), match: () => Promise.resolve(undefined), add: () => Promise.resolve(), put: () => Promise.resolve()}); },
      match: () => Promise.resolve(undefined),
    },
    URL, Promise, fetch: fetchImpl,
  };
  sandbox.self.caches = sandbox.caches;
  vm.runInNewContext(MANIFEST_PRELUDE + fs.readFileSync('src/sw.js', 'utf8'), sandbox);
  return {listeners, deleted, opened, sandbox};
}

test('the cache name carries the scope and the sweep only touches caches of the same scope', async () => {
  const {listeners, deleted} = loadSw('https://live.firebaseapp.com/');
  let done;
  await listeners.activate({waitUntil: p => { done = p; }});
  await done;
  expect(deleted.sort()).toEqual(['htlgi-live-firebaseapp-com-old1', 'htlgi-live-firebaseapp-com-old2']);
});

test('the fetch handler leaves /__/ and unknown hosts alone but handles the fonts host', () => {
  const {listeners} = loadSw('https://live.firebaseapp.com/');
  const responded = (url, mode = 'cors') => {
    let r = false;
    listeners.fetch({request: {method: 'GET', url, mode}, respondWith: () => { r = true; }});
    return r;
  };
  expect(responded('https://live.firebaseapp.com/__/auth/iframe')).toBe(false);
  expect(responded('https://apis.google.com/js/api.js')).toBe(false);
  expect(responded('https://fonts.gstatic.com/s/x.woff2')).toBe(true);
  expect(responded('https://live.firebaseapp.com/programme.json')).toBe(true);
  expect(responded('https://live.firebaseapp.com/__/auth/handler', 'navigate')).toBe(false);
  expect(responded('https://live.firebaseapp.com/__/firebase/init.json')).toBe(false);
  expect(responded('https://live.firebaseapp.com/', 'navigate')).toBe(true);
});

test('an image request is routed to the image cache', () => {
  // resolves rather than rejects: the image path's fetch fallback has no .catch, so a rejecting mock here
  // would leave an unhandled rejection even though the assertion below only needs the synchronous cache lookup.
  const {listeners, opened} = loadSw('https://live.firebaseapp.com/', {fetchImpl: () => Promise.resolve({ok: false})});
  listeners.fetch({request: {method: 'GET', url: 'https://live.firebaseapp.com/img/x.webp', mode: 'cors'}, respondWith: () => {}});
  expect(opened).toContain('htlgi-img-v1');
});
