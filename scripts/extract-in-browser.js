/*
 * Extracts the full HowTheLightGetsIn London programme + speaker/act profiles.
 *
 * How to use:
 *   1. Open https://howthelightgetsin.org/festivals/london/programme in a browser.
 *   2. Open the developer console (Cmd/Ctrl+Shift+J) and paste this whole file, press Enter.
 *   3. Wait ~30 s. A file called extract.json downloads. Save it as data/extract.json.
 *   4. Run `python3 scripts/build.py` to regenerate programme.json and index.html.
 *
 * Why in the browser: the programme page lazy-loads HTML fragments of 40 events from
 * /FullEventListPage_Controller/getevents?offset=N&limit=40&festival=london. Running
 * here means same-origin fetches with no tooling, and the site's own DOMParser.
 */
(async () => {
  const FESTIVAL = 'london';
  const TOPICS = {7:'Art / Literature / Film', 1:'Culture / Society', 6:'Ethics / Religion', 5:'Human Body / Medicine', 8:'Metaphysics / Language', 2:'Mind / Psychology', 3:'Politics / Economics', 4:'Science / Technology'};
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  const htmlToText = el => {
    if (!el) return '';
    const c = el.cloneNode(true);
    c.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
    c.querySelectorAll('p,blockquote,h1,h2,h3,h4,li').forEach(p => p.append('\n'));
    return c.textContent.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  };
  const parseDoc = html => new DOMParser().parseFromString(html, 'text/html');
  const feedUrl = (offset, extra = '') => `/FullEventListPage_Controller/getevents?offset=${offset}&limit=40&isInternationalFestival=0&festival=${FESTIVAL}${extra}`;

  // ---- programme feed -------------------------------------------------------
  function parseItem(it) {
    const idA = it.querySelector('a[name^="product-id-"]');
    const details = it.querySelector('.product_details_inner');
    const divs = [...(details ? details.querySelectorAll(':scope > div') : [])];
    const venue = norm((divs.find(d => /^Venue:/.test(norm(d.textContent))) || {}).textContent || '').replace(/^Venue:\s*/, '');
    const evm = norm(details ? details.textContent : '').match(/Event \[(\d+)\]/);
    const typeEl = it.querySelector('h2.sessiontype');
    const titleA = it.querySelector('.product_text h2:not(.sessiontype) a.ht-fpe--product-title') || it.querySelector('.product_text h2:not(.sessiontype)');
    const img = it.querySelector('.programme-page--thumbnail-wrapper img');
    const content = it.querySelector('.product_content .full-text');
    const links = content ? [...content.querySelectorAll('a[href]')].map(a => ({text: norm(a.textContent), href: a.getAttribute('href')})) : [];
    const actions = it.querySelector('.product_actions');
    const actText = actions ? htmlToText(actions) : '';
    const priceRows = actions ? [...actions.querySelectorAll('table.ht-pp tr')].map(r => norm(r.textContent)) : [];
    let ticketing, prices = null;
    if (/sold out/i.test(actText)) ticketing = 'sold_out';
    else if (/not included with your Festival Ticket/i.test(actText)) {
      ticketing = 'separate_ticket';
      prices = Object.fromEntries(priceRows.map(r => { const m = r.match(/^(\w+):\s*£([\d.]+)/); return m ? [m[1].toLowerCase(), +m[2]] : null; }).filter(Boolean));
    } else if (/Fast Pass/i.test(actText)) ticketing = 'fast_pass';
    else ticketing = 'included';
    const fp = actText.match(/Fast Pass[\s\S]*?Price:\s*£([\d.]+)/);
    return {
      id: idA ? idA.getAttribute('name').replace('product-id-', '') : null,
      eventNo: evm ? +evm[1] : null,
      date: norm(it.querySelector('.programme-page--date')?.textContent),
      time: norm(it.querySelector('.programme-page--time')?.textContent),
      venue,
      type: norm(typeEl?.textContent),
      title: norm(titleA?.textContent),
      url: titleA?.getAttribute('href') || null,
      image: img?.getAttribute('src') || null,
      speakers: norm(it.querySelector('.product_speakers')?.textContent),
      description: content ? htmlToText(content) : '',
      links, ticketing, fastPassPrice: fp ? +fp[1] : null, prices, topics: []
    };
  }
  async function fetchIds(extra) {
    const ids = [];
    for (let offset = 0, guard = 0; guard < 20; offset += 40, guard++) {
      const html = await (await fetch(feedUrl(offset, extra))).text();
      const found = [...html.matchAll(/product-id-(\d+)/g)].map(m => m[1]);
      if (!found.length) break;
      ids.push(...found);
    }
    return ids;
  }
  console.log('Fetching programme…');
  const events = [];
  for (let offset = 0, guard = 0; guard < 20; offset += 40, guard++) {
    const html = await (await fetch(feedUrl(offset))).text();
    const items = [...parseDoc(html).querySelectorAll('.productItem')].map(parseItem);
    if (!items.length) break;
    events.push(...items);
  }
  const byId = Object.fromEntries(events.map(e => [e.id, e]));
  console.log(`${events.length} events. Tagging topics…`);
  for (const [cid, name] of Object.entries(TOPICS)) {
    (await fetchIds('&content=' + cid)).forEach(id => byId[id] && byId[id].topics.push(name));
  }

  // ---- profiles (speakers, hosts, acts) --------------------------------------
  async function talent(slug) {
    const r = await fetch('/talent/' + slug);
    if (!r.ok) return null;
    const doc = parseDoc(await r.text());
    const sp = doc.querySelector('.speaker-person');
    if (!sp) return null;
    const name = norm(sp.querySelector('.speaker-person__title')?.textContent);
    if (!name) return null; // empty stub page
    return {
      slug, name,
      tagline: norm(sp.querySelector('.speaker-person__subtitle')?.textContent),
      bio: htmlToText(sp.querySelector('.speaker-person__content')).replace(/^(book|explore) tickets now\s*/i, '').replace(/\s*book tickets now\s*$/i, '').trim(),
      image: sp.querySelector('.speaker-person__image-element')?.getAttribute('src') || sp.querySelector('.speaker-person__image img')?.getAttribute('src') || null,
      events: [...doc.querySelectorAll('.speaker-event')].map(e => ({when: norm(e.querySelector('.speaker-event__date')?.textContent), title: norm(e.querySelector('.speaker-event__title')?.textContent)}))
    };
  }
  async function pool(items, fn, n = 6) {
    const out = []; const q = [...items];
    await Promise.all(Array.from({length: n}, async () => { while (q.length) { const x = q.shift(); try { out.push(await fn(x)); } catch (e) { console.warn('failed', x, e); } } }));
    return out.filter(Boolean);
  }
  const cards = async path => [...parseDoc(await (await fetch(path)).text()).querySelectorAll('.three-grid-layout--item')]
    .map(it => ({name: norm(it.querySelector('.three-grid-layout--title')?.textContent), slug: (it.querySelector('a[href*="talent/"]')?.getAttribute('href') || '').replace(/\?.*$/, '').replace(/^\/?talent\//, ''), isNew: !!it.querySelector('.three-grid-layout--new')}))
    .filter(c => c.slug);
  console.log('Fetching speaker profiles…');
  const year = new Date().getFullYear();
  const speakerCards = await cards(`/festivals/${FESTIVAL}/big-ideas/speakers/${year}`);
  const featured = new Set(speakerCards.map(c => c.slug));
  const slugify = n => n.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/æ/g, 'ae').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // every name that appears in the programme, so hosts and non-featured speakers get a profile too
  const names = new Set();
  for (const e of events) {
    let s = e.speakers.trim(); if (!s) continue;
    const m = s.match(/\.\s+([^,.]+?)\s+hosts?\.?$/) || s.match(/^([^,.]+?)\s+hosts?\.?$/);
    if (m) { m[1].split(/,\s*|\s+and\s+/).forEach(h => names.add(h.trim())); s = s.slice(0, m.index); }
    s.replace(/\.$/, '').split(/,\s*/).forEach(n => n.trim() && names.add(n.trim()));
  }
  const featuredNames = new Set(speakerCards.map(c => slugify(c.name)));
  const extraSlugs = [...names].map(slugify).filter(s => !featured.has(s) && !featuredNames.has(s));
  const profiles = await pool([...featured, ...new Set(extraSlugs)], talent);
  profiles.forEach(p => { p.featured = featured.has(p.slug); p.isNew = !!speakerCards.find(c => c.slug === p.slug)?.isNew; });
  console.log(`${profiles.length} profiles. Fetching music & comedy…`);
  const musicCards = await cards(`/festivals/${FESTIVAL}/music-and-performance/music`);
  const comedyCards = await cards(`/festivals/${FESTIVAL}/music-and-performance/comedy/${year}`);
  const actSlugs = [...musicCards.map(c => [c.slug, 'music']), ...comedyCards.map(c => [c.slug, 'comedy'])];
  // acts in the programme but missing from those pages: try their title as a slug
  const known = new Set(actSlugs.map(a => a[0]));
  events.filter(e => /^(Music|Music & Acoustic|Comedy|Cabaret)$/.test(e.type)).forEach(e => { const s = slugify(e.title.replace(/\(.*?\)/, '')); if (!known.has(s)) { known.add(s); actSlugs.push([s, /Comedy|Cabaret/.test(e.type) ? 'comedy' : 'music']); } });
  const acts = (await pool(actSlugs, async ([slug, kind]) => { const t = await talent(slug); return t && {...t, kind}; })).filter(Boolean);

  const extract = {extractedAt: new Date().toISOString(), festival: FESTIVAL, source: location.href, events, profiles, acts};
  window.__extract = extract;
  console.log(`Done: ${events.length} events, ${profiles.length} profiles, ${acts.length} acts. Downloading extract.json…`);
  const blob = new Blob([JSON.stringify(extract, null, 1)], {type: 'application/json'});
  const a = Object.assign(document.createElement('a'), {href: URL.createObjectURL(blob), download: 'extract.json'});
  document.body.appendChild(a); a.click(); a.remove();
})();
