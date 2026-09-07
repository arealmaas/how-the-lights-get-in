import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Evaluates the generated sw.js in a sandbox with a fake service-worker global and returns the captured listeners.
function loadSw(scope){
  const listeners = {};
  const deleted = [];
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
      open: () => Promise.resolve({addAll: () => Promise.resolve(), match: () => Promise.resolve(undefined), add: () => Promise.resolve(), put: () => Promise.resolve()}),
      match: () => Promise.resolve(undefined),
    },
    URL, Promise, fetch: () => Promise.reject(new Error('offline')),
  };
  sandbox.self.caches = sandbox.caches;
  vm.runInNewContext(fs.readFileSync(new URL('../../sw.js', import.meta.url), 'utf8'), sandbox);
  return {listeners, deleted, sandbox};
}

test('the cache name carries the scope and the sweep only touches caches of the same scope', async () => {
  const {listeners, deleted} = loadSw('https://live.firebaseapp.com/');
  let done;
  await listeners.activate({waitUntil: p => { done = p; }});
  await done;
  assert.deepEqual(deleted.sort(), ['htlgi-live-firebaseapp-com-old1', 'htlgi-live-firebaseapp-com-old2']);
});

test('the fetch handler leaves /__/ and unknown hosts alone but handles the SDK host', () => {
  const {listeners} = loadSw('https://live.firebaseapp.com/');
  const responded = (url, mode = 'cors') => {
    let r = false;
    listeners.fetch({request: {method: 'GET', url, mode}, respondWith: () => { r = true; }});
    return r;
  };
  assert.equal(responded('https://live.firebaseapp.com/__/auth/iframe'), false);
  assert.equal(responded('https://apis.google.com/js/api.js'), false);
  assert.equal(responded('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'), true);
  assert.equal(responded('https://live.firebaseapp.com/programme.json'), true);
  assert.equal(responded('https://live.firebaseapp.com/__/auth/handler', 'navigate'), false);
  assert.equal(responded('https://live.firebaseapp.com/__/firebase/init.json'), false);
  assert.equal(responded('https://live.firebaseapp.com/', 'navigate'), true);
});
