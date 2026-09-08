/* eslint-env serviceworker */
const MANIFEST = self.__WB_MANIFEST || [];
const SCOPE_TAG = self.registration.scope.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(-40);
const PREFIX = 'htlgi-' + SCOPE_TAG + '-';
const BUILD = MANIFEST.map(e => e.revision || e.url).join('|');
const CACHE = PREFIX + hash(BUILD);
const IMG_CACHE = 'htlgi-img-v1';
const urlOf = e => new URL(e.url, self.registration.scope).href;
const ASSETS = MANIFEST.filter(e => !e.url.includes('img/')).map(urlOf);
const IMAGES = MANIFEST.filter(e => e.url.includes('img/')).map(urlOf);
function hash(s){ let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); }

self.addEventListener('install', e => {
  const core = caches.open(CACHE).then(c => c.addAll(ASSETS.concat([self.registration.scope])));
  const photos = caches.open(IMG_CACHE).then(c => Promise.all(IMAGES.map(u => c.match(u).then(hit => hit || c.add(u).catch(() => {})))));
  e.waitUntil(Promise.all([core, photos]).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/__/')) return;   // Firebase auth helpers: never intercepted
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(self.registration.scope, r.clone())); return r; }).catch(() => caches.match(self.registration.scope)));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.includes('/img/')) {
    e.respondWith(caches.open(IMG_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }))));
    return;
  }
  const cacheable = url.origin === self.location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!cacheable) return;
  e.respondWith(caches.match(req).then(cached => {
    const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') caches.open(CACHE).then(c => c.put(req, r.clone())); return r; }).catch(() => cached);
    return cached || net;
  }));
});
