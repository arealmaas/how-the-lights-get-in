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

// A response can only be cloned while its body is unread, and respondWith() hands the body to the page the
// moment the fetch settles. So the copy destined for the cache has to be taken synchronously, in the same
// tick as the response — never after awaiting caches.open(), which resolves a microtask later, by which
// time the page has started reading and clone() throws "Response body is already used".
function liveResponse(){
  const errors = [];
  const r = {
    ok: true, type: 'basic', bodyUsed: false, errors,
    clone(){
      if (r.bodyUsed) { const e = new TypeError("Failed to execute 'clone' on 'Response': Response body is already used"); errors.push(e); throw e; }
      return {ok: true, type: 'basic', copyOf: r};
    },
  };
  return r;
}

// caches.open() is a real async call; this sandbox makes it settle a microtask later, as the browser does.
function loadSwWithDeferredCache(scope, response){
  const puts = [];
  const listeners = {};
  const cache = {addAll: () => Promise.resolve(), match: () => Promise.resolve(undefined), add: () => Promise.resolve(), put: (req, res) => { puts.push({req, res}); return Promise.resolve(); }};
  const sandbox = {
    self: {addEventListener: (t, fn) => { listeners[t] = fn; }, registration: {scope}, location: new URL(scope), skipWaiting: () => Promise.resolve(), clients: {claim: () => Promise.resolve()}},
    // caches.open() is backed by real storage: it settles on a later task, never in the same microtask
    // checkpoint as the fetch that is waiting for it.
    caches: {keys: () => Promise.resolve([]), delete: () => Promise.resolve(true), open: () => new Promise(res => setTimeout(() => res(cache), 0)), match: () => Promise.resolve(undefined)},
    URL, Promise, setTimeout, fetch: () => Promise.resolve(response),
  };
  sandbox.self.caches = sandbox.caches;
  vm.runInNewContext(MANIFEST_PRELUDE + fs.readFileSync('src/sw.js', 'utf8'), sandbox);
  return {listeners, puts};
}

// the page reads the body as soon as respondWith() gives it the response
const flush = async (p, response) => { const r = await p; response.bodyUsed = true; await new Promise(res => setTimeout(res, 10)); return r; };

test('a cacheable same-origin response is cloned before the page consumes it', async () => {
  const response = liveResponse();
  const {listeners, puts} = loadSwWithDeferredCache('https://live.firebaseapp.com/', response);
  let served;
  listeners.fetch({request: {method: 'GET', url: 'https://live.firebaseapp.com/programme.json', mode: 'cors'}, respondWith: p => { served = p; }});
  await flush(served, response);
  expect(response.errors).toEqual([]);
  expect(puts).toHaveLength(1);
  expect(puts[0].res.copyOf).toBe(response);   // the cache got the copy, the page got the original
});

test('a navigation response is cloned before the page consumes it', async () => {
  const response = liveResponse();
  const {listeners, puts} = loadSwWithDeferredCache('https://live.firebaseapp.com/', response);
  let served;
  listeners.fetch({request: {method: 'GET', url: 'https://live.firebaseapp.com/', mode: 'navigate'}, respondWith: p => { served = p; }});
  await flush(served, response);
  expect(response.errors).toEqual([]);
  expect(puts).toHaveLength(1);
  expect(puts[0].res.copyOf).toBe(response);
});
