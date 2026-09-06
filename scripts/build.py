#!/usr/bin/env python3
"""Build programme.json and index.html from data/extract.json.

    python3 scripts/build.py            # writes programme.json + index.html in the repo root
    python3 scripts/build.py --artifact dist/artifact.html   # additionally writes a body-only copy

data/extract.json is produced by scripts/extract-in-browser.js (see README).
"""
import hashlib, json, re, sys, unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = 'https://howthelightgetsin.org/'
DATES = {'Sat 19 September': ('Saturday', '2026-09-19'), 'Sun 20 September': ('Sunday', '2026-09-20')}
PERFORMANCE_TYPES = {'Music', 'Music & Acoustic', 'Comedy', 'Cabaret'}
ALIASES = {'philipcollins': 'philcollins'}  # programme name -> profile name (normalised)


def norm_name(n):
    n = n.lower().replace('&', ' and ').replace('ø', 'o').replace('æ', 'ae').replace('ß', 'ss').replace('ł', 'l')
    n = unicodedata.normalize('NFKD', n).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z]', '', n)


def parse_speakers(s):
    """'A, B, C. D hosts' -> (['A','B','C'], ['D']); handles initials like 'Tony D. Sampson'."""
    s = s.strip()
    if not s:
        return [], []
    m = re.search(r'\.\s+([^,.]+?)\s+hosts?\.?$', s) or re.search(r'^([^,.]+?)\s+hosts?\.?$', s)
    hosts, main = [], s
    if m:
        hosts = [h.strip() for h in re.split(r',\s*|\s+and\s+', m.group(1)) if h.strip()]
        main = s[:m.start()]
    names = [n.strip() for n in re.split(r',\s*', main.rstrip('.').strip()) if n.strip()]
    return names, hosts


def to_24h(t):
    return datetime.strptime(t.strip().lower(), '%I:%M%p').strftime('%H:%M')


def absolute(url):
    if not url:
        return None
    return url if url.startswith('http') else BASE + url.lstrip('/')


def local_photo(kind, name):
    """Relative path of a thumbnail under img/<kind>/ if it exists (see scripts/fetch-images.js), else None."""
    if not name:
        return None
    rel = f'img/{kind}/{name}.webp'
    return rel if (ROOT / rel).exists() else None


def day_of(date_label):
    if date_label in DATES:
        return DATES[date_label]
    # fall back to parsing "Sat 19 September" for other years/dates
    d = datetime.strptime(date_label + ' 2026', '%a %d %B %Y')
    return d.strftime('%A'), d.strftime('%Y-%m-%d')


def build(extract):
    events, profiles, acts = extract['events'], extract['profiles'], extract['acts']

    by_norm = {}
    for p in profiles:
        key = norm_name(p['name'])
        if key not in by_norm or (p.get('featured') and not by_norm[key].get('featured')):
            by_norm[key] = p

    def find_profile(name):
        k = norm_name(name)
        return by_norm.get(ALIASES.get(k, k))

    acts_by_norm = {norm_name(a['name']): a for a in acts}

    def find_acts(title):
        k = norm_name(title)
        if k in acts_by_norm:
            return [acts_by_norm[k]]
        k2 = norm_name(re.sub(r'\(.*?\)', '', title))          # "Patrick Wolf (Acoustic)"
        if k2 in acts_by_norm:
            return [acts_by_norm[k2]]
        parts = re.split(r'\s*(?:&|\band\b)\s*', title)          # double bills
        found = [acts_by_norm[norm_name(p)] for p in parts if norm_name(p) in acts_by_norm]
        return found if len(parts) > 1 and len(found) == len(parts) else []

    out_events, speaker_index = [], defaultdict(lambda: {'speaks': [], 'hosts': []})
    for e in events:
        names, hosts = parse_speakers(e['speakers'])
        day, iso = day_of(e['date'])
        desc, desc_source = e['description'], ('programme' if e['description'] else None)
        matched = find_acts(e['title']) if e['type'] in PERFORMANCE_TYPES else []
        if not desc and matched and any(a['bio'] for a in matched):
            desc = '\n\n'.join((f"{a['name']}: {a['bio']}" if len(matched) > 1 else a['bio']) for a in matched if a['bio'])
            desc_source = 'artist profile'
        people = []
        for n in names:
            p = find_profile(n); people.append({'name': n, 'role': 'speaker', 'slug': p['slug'] if p else None})
            speaker_index[n]['speaks'].append(e['eventNo'])
        for n in hosts:
            p = find_profile(n); people.append({'name': n, 'role': 'host', 'slug': p['slug'] if p else None})
            speaker_index[n]['hosts'].append(e['eventNo'])
        out_events.append({
            'id': e['id'], 'eventNo': e['eventNo'], 'title': e['title'], 'type': e['type'], 'venue': e['venue'],
            'day': day, 'date': iso, 'time': to_24h(e['time']), 'timeLabel': e['time'],
            'speakers': names, 'hosts': hosts, 'people': people, 'speakersLabel': e['speakers'],
            'topics': e['topics'], 'description': desc, 'descriptionSource': desc_source,
            'links': [{'text': l['text'], 'href': absolute(l['href'])} for l in e['links']],
            'ticketing': e['ticketing'], 'fastPassPrice': e['fastPassPrice'], 'prices': e['prices'],
            'actSlugs': [a['slug'] for a in matched], 'url': absolute(e['url']), 'image': absolute(e['image']),
            'photo': local_photo('events', str(e['eventNo'])) or next((local_photo('acts', a['slug'] + '-wide') for a in matched if local_photo('acts', a['slug'] + '-wide')), None),
        })
    out_events.sort(key=lambda x: (x['date'], x['time'], x['eventNo']))

    out_speakers, seen = [], set()
    for name, idx in speaker_index.items():
        p = find_profile(name)
        key = p['slug'] if p else norm_name(name)
        if key in seen:
            continue
        seen.add(key)
        out_speakers.append({
            'name': p['name'] if p else name, 'slug': p['slug'] if p else None,
            'tagline': p['tagline'] if p else '', 'bio': p['bio'] if p else '',
            'image': absolute(p['image']) if p else None,
            'photo': local_photo('speakers', p['slug']) if p else None,
            'profileUrl': (BASE + 'talent/' + p['slug']) if p else None,
            'featured': bool(p and p.get('featured')),
            'speaks': sorted(set(idx['speaks'])), 'hosts': sorted(set(idx['hosts'])),
        })
    out_speakers.sort(key=lambda s: s['name'].split()[-1].lower())

    out_acts = [{
        'name': a['name'], 'slug': a['slug'], 'kind': a['kind'], 'bio': a['bio'], 'image': absolute(a['image']),
        'photo': local_photo('acts', a['slug']), 'photoWide': local_photo('acts', a['slug'] + '-wide'),
        'profileUrl': BASE + 'talent/' + a['slug'],
        'events': [e['eventNo'] for e in out_events if a['slug'] in e['actSlugs']],
    } for a in acts]

    days = sorted({e['date'] for e in out_events})
    meta = {
        'festival': 'HowTheLightGetsIn London 2026', 'dates': days,
        'location': 'Kenwood House, Hampstead Heath, London',
        'source': extract.get('source', BASE + 'festivals/london/programme'),
        'extractedAt': extract.get('extractedAt'), 'builtAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'eventCount': len(out_events), 'speakerCount': len(out_speakers), 'actCount': len(out_acts),
        'disclaimer': 'Unofficial, fan-made planner. Not affiliated with, endorsed by or connected to HowTheLightGetsIn or the Institute of Art and Ideas. Programme text and speaker biographies are © the Institute of Art and Ideas.',
        'notes': [
            'End times are not published on the website; only start times are given.',
            'ticketing: fast_pass = included with Festival Ticket, optional paid Fast Pass; included = included with Festival Ticket, no Fast Pass; separate_ticket = Inner Circle/Salon/Banquet events sold separately; sold_out = separately ticketed and sold out.',
            'Topics are the site\'s own "Search by Content" categories.',
            'Descriptions with descriptionSource=artist profile come from the artist\'s profile page because the programme entry had none.',
            'photo (and photoWide for acts) are thumbnails under img/ made from the festival site\'s images (image holds the original URL); they remain © the IAI and the photographers.',
        ],
    }
    return {'meta': meta, 'events': out_events, 'speakers': out_speakers, 'acts': out_acts}


SW_TEMPLATE = """// Service worker for the HTLGI London 2026 planner — generated by scripts/build.py
const CACHE = 'htlgi-__BUILD__';
const IMG_CACHE = 'htlgi-img-v1';   // photos are immutable, so they live in a cache that survives page updates
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const IMAGES = __IMAGES__;
self.addEventListener('install', e => {
  const core = caches.open(CACHE).then(c => c.addAll(ASSETS));
  // best effort: fetch the photos that are not cached yet, one failure does not fail the install
  const photos = caches.open(IMG_CACHE).then(c => Promise.all(IMAGES.map(u => c.match(u).then(hit => hit || c.add(u).catch(() => {})))));
  e.waitUntil(Promise.all([core, photos]).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('htlgi-') && k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
  if (isPage) {
    // network first so updates arrive; the cached page is the offline fallback
    e.respondWith(fetch(req).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put('./index.html', r.clone())); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.includes('/img/')) {
    // cache first for photos
    e.respondWith(caches.open(IMG_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }))));
    return;
  }
  const cacheable = url.origin === self.location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!cacheable) return;
  // stale-while-revalidate for fonts and static files
  e.respondWith(caches.match(req).then(cached => {
    const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') caches.open(CACHE).then(c => c.put(req, r.clone())); return r; }).catch(() => cached);
    return cached || net;
  }));
});
"""

MANIFEST = {
    'name': 'HTLGI London 2026 Planner', 'short_name': 'HTLGI 2026',
    'description': 'Unofficial planner for the HowTheLightGetsIn London festival, 19–20 September 2026.',
    'start_url': './', 'scope': './', 'display': 'standalone',
    'background_color': '#F3F4F1', 'theme_color': '#17191C',
    'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
              {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
              {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}],
}


def page_payload(data, briefings, media, extra, inline_images=False):
    ev = [{k: e[k] for k in ('id', 'eventNo', 'title', 'type', 'venue', 'date', 'time', 'speakers', 'hosts', 'people', 'topics',
                             'description', 'descriptionSource', 'links', 'ticketing', 'fastPassPrice', 'prices', 'actSlugs', 'url', 'photo')} for e in data['events']]
    sp = [{k: s[k] for k in ('name', 'slug', 'tagline', 'bio', 'profileUrl', 'speaks', 'hosts', 'photo')} for s in data['speakers']]
    ac = [{k: a[k] for k in ('name', 'slug', 'kind', 'bio', 'profileUrl', 'events', 'photo')} for a in data['acts']]
    meta = {k: data['meta'][k] for k in ('festival', 'dates', 'location', 'extractedAt', 'eventCount')}
    brief = {k: v for k, v in briefings.items() if not k.startswith('_')}
    payload = {'meta': meta, 'events': ev, 'speakers': sp, 'acts': ac,
               'briefings': brief, 'briefingNote': briefings.get('_meta', {}).get('note', ''),
               'media': {'acts': media.get('acts', {}), 'films': media.get('films', {})}, 'playlist': media.get('_meta', {}).get('playlist'),
               'speakersExtra': extra.get('speakers', {})}
    if inline_images:
        # the artifact copy cannot load external files, so every referenced photo goes in as a data: URI (deduplicated)
        import base64
        paths = sorted({o['photo'] for o in ev + sp + ac if o.get('photo')})
        payload['photos'] = {p: 'data:image/webp;base64,' + base64.b64encode((ROOT / p).read_bytes()).decode('ascii') for p in paths}
    return json.dumps(payload, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')


def main():
    extract = json.load(open(ROOT / 'data' / 'extract.json', encoding='utf-8'))
    briefings = json.load(open(ROOT / 'data' / 'briefings.json', encoding='utf-8')) if (ROOT / 'data' / 'briefings.json').exists() else {}
    media = json.load(open(ROOT / 'data' / 'media.json', encoding='utf-8')) if (ROOT / 'data' / 'media.json').exists() else {}
    extra = json.load(open(ROOT / 'data' / 'speakers-extra.json', encoding='utf-8')) if (ROOT / 'data' / 'speakers-extra.json').exists() else {}
    data = build(extract)
    (ROOT / 'programme.json').write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')

    template = (ROOT / 'scripts' / 'template.html').read_text(encoding='utf-8')
    counts = Counter(e['date'] for e in data['events'])

    def fill(payload):
        h = template.replace('/*__DATA__*/', payload)
        h = h.replace('__EXTRACTED__', datetime.fromisoformat(data['meta']['extractedAt'].replace('Z', '+00:00')).strftime('%-d %B %Y'))
        h = h.replace('__COUNT_SAT__', str(counts.get('2026-09-19', 0))).replace('__COUNT_SUN__', str(counts.get('2026-09-20', 0)))
        h = h.replace('__TOTAL__', str(len(data['events']))).replace('__SPEAKERS__', str(len(data['speakers']))).replace('__ACTS__', str(len(data['acts'])))
        assert '__' not in re.sub(r'__(proto|dirname|filename)__', '', h.split('<script id="data"')[0]), 'unfilled placeholder'
        return h

    html = fill(page_payload(data, briefings, media, extra))
    (ROOT / 'index.html').write_text(html, encoding='utf-8')

    # offline support: versioned service worker (photos listed for precaching) + web app manifest
    build_id = hashlib.sha1(html.encode('utf-8')).hexdigest()[:10]
    images = sorted(str(p.relative_to(ROOT)).replace('\\', '/') for p in (ROOT / 'img').glob('*/*.webp')) if (ROOT / 'img').exists() else []
    sw = SW_TEMPLATE.replace('__BUILD__', build_id).replace('__IMAGES__', json.dumps(['./' + i for i in images], separators=(',', ':')))
    (ROOT / 'sw.js').write_text(sw, encoding='utf-8')
    (ROOT / 'manifest.webmanifest').write_text(json.dumps(MANIFEST, indent=1), encoding='utf-8')

    if '--artifact' in sys.argv:
        out = Path(sys.argv[sys.argv.index('--artifact') + 1])
        # body-only, self-contained copy for publishing as a claude.ai artifact (the publisher adds doctype/head/body;
        # external images are blocked there, so the photos go in as data: URIs)
        ahtml = fill(page_payload(data, briefings, media, extra, inline_images=True))
        head = re.search(r'<title>.*?</title>', ahtml, re.S).group(0)
        links = ''.join(re.findall(r'<link rel="stylesheet"[^>]*>', ahtml))
        style = re.search(r'<style>.*?</style>', ahtml, re.S).group(0)
        body = re.search(r'<body[^>]*>(.*)</body>', ahtml, re.S).group(1)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(head + '\n' + links + '\n' + style + body, encoding='utf-8')

    c = Counter(e['type'] for e in data['events'])
    print(f"{len(data['events'])} events ({dict(counts)}), {len(data['speakers'])} speakers/hosts, {len(data['acts'])} acts")
    print('types:', dict(c))
    print('events without description:', [e['title'] for e in data['events'] if not e['description']])


if __name__ == '__main__':
    main()
