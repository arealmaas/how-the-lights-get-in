// Fetches the speaker, act and event photos from howthelightgetsin.org and shrinks them to thumbnails.
//
// The festival site's images are same-origin only from the site itself, so this runs in the browser:
//   1. open any page on https://howthelightgetsin.org/ and open the developer console,
//   2. paste this whole file and press Enter,
//   3. after a minute it downloads images.json (base64 WebP thumbnails, ~5 MB),
//   4. run  python3 scripts/unpack-images.py ~/Downloads/images.json  to write them into public/img/,
//   5. run  npm run data  — the build picks up whatever exists under public/img/.
//
// Sizes: portraits 240×300 (the site's own 480×600 crop, halved), event and act heroes 640×360 from the 1200×675 originals.
// The photos remain © the Institute of Art and Ideas and the respective photographers.

(async () => {
  const PROGRAMME = 'https://raw.githubusercontent.com/arealmaas/how-the-lights-get-in/main/programme.json';   // or paste the JSON into `data` below
  const data = await fetch(PROGRAMME).then(r => r.json());
  const original = u => u.replace(/_resampled\/[A-Za-z0-9]+\//, '');
  const jobs = [];
  for (const s of data.speakers) if (s.image && s.slug) jobs.push({key: 'speakers/' + s.slug, url: s.image, w: 240, h: 300, q: 0.78});
  for (const a of data.acts) if (a.image) {
    jobs.push({key: 'acts/' + a.slug, url: a.image, w: 240, h: 300, q: 0.78});
    jobs.push({key: 'acts/' + a.slug + '-wide', url: original(a.image), w: 640, h: 360, q: 0.68});
  }
  for (const e of data.events) if (e.image) jobs.push({key: 'events/' + e.eventNo, url: original(e.image), w: 640, h: 360, q: 0.68});

  async function shrink(job) {
    const r = await fetch(job.url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const bm = await createImageBitmap(await r.blob());
    const c = document.createElement('canvas'); c.width = job.w; c.height = job.h;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const s = Math.max(job.w / bm.width, job.h / bm.height), dw = bm.width * s, dh = bm.height * s;   // cover-crop, centred
    ctx.drawImage(bm, (job.w - dw) / 2, (job.h - dh) / 2, dw, dh);
    const blob = await new Promise(res => c.toBlob(res, 'image/webp', job.q));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  const out = {}, failed = [];
  let i = 0;
  async function worker() {
    while (i < jobs.length) {
      const j = jobs[i++];
      try { out[j.key] = await shrink(j); } catch (e) { failed.push([j.key, j.url, String(e)]); }
      if ((Object.keys(out).length + failed.length) % 20 === 0) console.log(`${Object.keys(out).length + failed.length} / ${jobs.length}`);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  console.log(`done: ${Object.keys(out).length} images, ${failed.length} failed`, failed);

  const blob = new Blob([JSON.stringify({generatedAt: new Date().toISOString(), source: 'https://howthelightgetsin.org/', images: out, failed})], {type: 'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'images.json'; document.body.appendChild(a); a.click(); a.remove();
})();
