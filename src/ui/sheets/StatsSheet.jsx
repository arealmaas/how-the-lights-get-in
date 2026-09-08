// src/ui/sheets/StatsSheet.jsx — ports showStats()/barList(): festival-wide counts as horizontal bars
// (most-booked speakers, busiest start times, venues, types, topics), who-appears-together pairs, and
// (when you have picks) a one-line summary of your own. Bars for a speaker or an event open that sheet.
import {EVENTS, SPEAKERS, ACTS, DAYS} from '../../data/index.js';
import {usePlanner} from '../../store/planner.js';
import {useSheet} from '../../store/sheet.js';

function count(arr, key){
  const m = new Map();
  for (const x of arr) { const k = key(x); if (k == null) continue; m.set(k, (m.get(k) || 0) + 1); }
  return [...m].sort((a, b) => b[1] - a[1]);
}

function Bars({rows}){
  const max = Math.max(...rows.map(r => r.n), 1);
  return (
    <div className="bars">
      {rows.map(r => {
        const bar = (
          <>
            <span className="bar-l">{r.label}</span>
            <span className="bar-t"><i style={{width: Math.round(r.n / max * 100) + '%'}} /></span>
            <span className="bar-v">{r.n}</span>
          </>
        );
        if (r.no) return <button key={r.label} type="button" className="bar link" onClick={() => useSheet.getState().open('event', r.no)}>{bar}</button>;
        if (r.slug) return <button key={r.label} type="button" className="bar link" onClick={() => useSheet.getState().open('speaker', r.slug)}>{bar}</button>;
        return <div key={r.label} className="bar">{bar}</div>;
      })}
    </div>
  );
}

export default function StatsSheet(){
  const picks = usePlanner(s => s.picks);

  const people = SPEAKERS.map(s => ({label: s.name, n: s.speaks.length + s.hosts.length, slug: s.slug || s.name})).sort((a, b) => b.n - a.n).slice(0, 12);
  const slots = count(EVENTS, e => `${DAYS[e.date].slice(0, 3)} ${e.time}`).slice(0, 8).map(([k, n]) => ({label: k, n}));
  const venues = count(EVENTS, e => e.venue).map(([k, n]) => ({label: k, n}));
  const types = count(EVENTS, e => e.type).map(([k, n]) => ({label: k, n}));
  const topics = count(EVENTS.flatMap(e => e.topics), t => t).map(([k, n]) => ({label: k, n}));

  const pairs = new Map();
  for (const e of EVENTS) {
    const ppl = [...e.speakers, ...e.hosts];
    for (let i = 0; i < ppl.length; i++) for (let j = i + 1; j < ppl.length; j++) {
      const k = [ppl[i], ppl[j]].sort().join(' & ');
      pairs.set(k, (pairs.get(k) || 0) + 1);
    }
  }
  const together = [...pairs].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 12);

  const mine = EVENTS.filter(e => picks.has(e.eventNo));
  const mineTypes = count(mine, e => e.type).map(([k, n]) => `${k} ${n}`).join(' · ');

  return (
    <>
      <div className="kicker"><span>Stats</span></div>
      <h2 id="sheet-title" tabIndex={-1}>The festival in numbers</h2>
      <div className="tiles">
        <div className="tile-s"><b>{EVENTS.length}</b><span>events</span></div>
        <div className="tile-s"><b>{SPEAKERS.length}</b><span>speakers &amp; hosts</span></div>
        <div className="tile-s"><b>{venues.length}</b><span>venues</span></div>
        <div className="tile-s"><b>{ACTS.length}</b><span>music &amp; comedy acts</span></div>
      </div>
      {mine.length > 0 && (
        <p className="src">
          Your picks: {mine.length} events, {mine.filter(e => e.date === '2026-09-19').length} on Saturday and {mine.filter(e => e.date === '2026-09-20').length} on Sunday — {mineTypes}.
        </p>
      )}
      <h3 className="sub">Most booked</h3>
      <Bars rows={people} />
      <h3 className="sub">Busiest start times</h3>
      <Bars rows={slots} />
      <h3 className="sub">Events by venue</h3>
      <Bars rows={venues} />
      <h3 className="sub">Events by type</h3>
      <Bars rows={types} />
      <h3 className="sub">Topics (events carry several)</h3>
      <Bars rows={topics} />
      <h3 className="sub">Who appears together</h3>
      {together.length > 0 ? (
        <ul className="pairs">{together.map(([k, n]) => <li key={k}>{k} <span>· {n} events</span></li>)}</ul>
      ) : (
        <p className="src">No pair shares more than one event.</p>
      )}
    </>
  );
}
