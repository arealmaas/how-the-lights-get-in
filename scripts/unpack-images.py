#!/usr/bin/env python3
"""Write the thumbnails downloaded by scripts/fetch-images.js into public/img/.

    python3 scripts/unpack-images.py ~/Downloads/images.json

Creates public/img/speakers/<slug>.webp, public/img/acts/<slug>.webp, public/img/acts/<slug>-wide.webp
and public/img/events/<eventNo>.webp. public/ is Vite's static folder: everything in it is copied to the
root of dist/, so the paths programme.json records stay img/<kind>/<name>.webp.
If Pillow is installed, heroes larger than 32 KB are re-encoded at a lower quality so the whole set stays small.
"""
import base64, json, sys
from pathlib import Path

IMG = Path(__file__).resolve().parent.parent / 'public' / 'img'
CAP = 32000


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    payload = json.load(open(sys.argv[1], encoding='utf-8'))
    images = payload.get('images', payload)
    written = 0
    for key, b64 in images.items():
        kind, name = key.split('/', 1)
        if kind not in ('speakers', 'acts', 'events') or '/' in name or '..' in name:
            print('skipping odd key', key)
            continue
        out = IMG / kind / (name + '.webp')
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(base64.b64decode(b64))
        written += 1
    print(f'wrote {written} files under public/img/')
    for key, url, err in payload.get('failed', []):
        print('failed:', key, url, err)

    try:
        from PIL import Image
    except ImportError:
        print('Pillow not installed — large heroes were not re-encoded (optional).')
        return
    shrunk = 0
    for f in list((IMG / 'events').glob('*.webp')) + list((IMG / 'acts').glob('*-wide.webp')):
        if f.stat().st_size > CAP:
            im = Image.open(f).convert('RGB')
            for q in (62, 54, 46):
                im.save(f, 'WEBP', quality=q, method=6)
                if f.stat().st_size <= CAP:
                    break
            shrunk += 1
    print(f're-encoded {shrunk} large heroes')


if __name__ == '__main__':
    main()
