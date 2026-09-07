#!/usr/bin/env python3
"""Build programme.json from data/extract.json.

    python3 scripts/build.py            # writes programme.json in the repo root

data/extract.json is produced by scripts/extract-in-browser.js (see README).
"""
import json, re, unicodedata
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
    return rel if (ROOT / 'public' / rel).exists() else None


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


def main():
    extract = json.load(open(ROOT / 'data' / 'extract.json', encoding='utf-8'))
    data = build(extract)
    (ROOT / 'programme.json').write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')

    counts = Counter(e['date'] for e in data['events'])
    c = Counter(e['type'] for e in data['events'])
    print(f"{len(data['events'])} events ({dict(counts)}), {len(data['speakers'])} speakers/hosts, {len(data['acts'])} acts")
    print('types:', dict(c))
    print('events without description:', [e['title'] for e in data['events'] if not e['description']])


if __name__ == '__main__':
    main()
