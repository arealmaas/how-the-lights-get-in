// src/ui/NowNext.jsx — ported from the old renderNowNext(): what's on now, what's starting in the next
// 45 minutes, and a shortcut to your next pick. Hidden outside the festival dates. Refreshes once a minute
// while it's showing, via its own live clock (separate from the frozen NOW used to mark past time slots).
import {useEffect, useState} from 'react';
import {EVENTS, DAYS, GROUP} from '../data/index.js';
import {usePlanner} from '../store/planner.js';
import {useSheet} from '../store/sheet.js';
import {currentNow, minutes, dur, isFestivalDay} from '../core/time.js';

const search = () => (typeof window !== 'undefined' ? window.location.search : '');

function NNChip({e, isPicked}){
  return (
    <button type="button" className={`nn-chip g-${GROUP[e.type]}`} onClick={() => useSheet.getState().open('event', e.eventNo)}>
      <b>{e.time}</b><span>{e.venue}</span>{e.title}{isPicked && <span className="st">★</span>}
    </button>
  );
}

export default function NowNext(){
  const [now, setNow] = useState(() => currentNow(search()));
  const picks = usePlanner(s => s.picks);

  useEffect(() => {
    if (!isFestivalDay(now.date)) return undefined;
    const id = setInterval(() => setNow(currentNow(search())), 60000);
    return () => clearInterval(id);
  }, [now.date]);

  if (!isFestivalDay(now.date)) return null;

  const nowMin = minutes(now.time);
  const todays = EVENTS.filter(e => e.date === now.date);
  const on = todays.filter(e => { const s = minutes(e.time); return s <= nowMin && nowMin < s + dur(e); });
  const soon = todays.filter(e => { const s = minutes(e.time); return s > nowMin && s <= nowMin + 45; });
  const nextPick = todays.filter(e => picks.has(e.eventNo) && minutes(e.time) + 5 >= nowMin).sort((a, b) => a.time.localeCompare(b.time))[0];

  let pick = null;
  if (nextPick) {
    const diff = minutes(nextPick.time) - nowMin;
    const cd = diff > 0 ? `in ${diff} min` : diff === 0 ? 'starting now' : `started ${-diff} min ago`;
    pick = (
      <div className="nn-pick">
        ★ Your next pick: <button type="button" onClick={() => useSheet.getState().open('event', nextPick.eventNo)}>{nextPick.title}</button>
        <span>· {nextPick.venue} · {nextPick.time}</span>
        <span className="cd">{cd}</span>
      </div>
    );
  } else if (todays.some(e => picks.has(e.eventNo))) {
    pick = <div className="nn-empty">No more picks today — see what's on below.</div>;
  }

  return (
    <div className="nownext" id="nownext">
      <div className="nn">
        <div className="nn-head">
          <b>Now & next</b>
          <span className="nn-time">{DAYS[now.date]} {now.time}{now.simulated ? ' · preview' : ''}</span>
        </div>
        {pick}
        <div className="nn-row">
          <span className="nn-label">On now</span>
          <div className="nn-chips">
            {on.length ? on.map(e => <NNChip key={e.eventNo} e={e} isPicked={picks.has(e.eventNo)} />) : <span className="nn-empty">Nothing running right now.</span>}
          </div>
        </div>
        <div className="nn-row">
          <span className="nn-label">Next 45 min</span>
          <div className="nn-chips">
            {soon.length ? soon.map(e => <NNChip key={e.eventNo} e={e} isPicked={picks.has(e.eventNo)} />) : <span className="nn-empty">Nothing starting in the next 45 minutes.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
