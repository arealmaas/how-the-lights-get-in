// src/ui/Chips.jsx — ported from the old renderChips(): the "My picks" chip (with a same-day clash
// count), one chip per event group, and a "Now" chip on festival days that jumps to the current time.
import {byNo, GROUPS} from '../data/index.js';
import {usePlanner} from '../store/planner.js';
import {isFestivalDay} from '../core/time.js';
import {NOW} from './useFiltered.js';

function jumpToNow(){
  usePlanner.getState().setFilter({day: NOW.date, view: 'list'});
  setTimeout(() => {
    const slots = [...document.querySelectorAll('.slot')];
    const el = slots.find(s => s.querySelector('.slot-time').textContent >= NOW.time) || document.querySelector('.slot:last-child');
    el?.scrollIntoView({behavior: 'smooth', block: 'start'});
  }, 0);
}

export default function Chips({clashes}){
  const day = usePlanner(s => s.day);
  const groups = usePlanner(s => s.groups);
  const picksOnly = usePlanner(s => s.picksOnly);
  const picks = usePlanner(s => s.picks);
  const setFilter = usePlanner(s => s.setFilter);

  const dayPicks = [...picks].filter(n => byNo.get(n).date === day);
  const dayClash = dayPicks.filter(n => clashes.has(n)).length;

  return (
    <div className="chips" id="chips">
      <button
        type="button"
        className="chip pickchip"
        aria-pressed={picksOnly}
        onClick={() => setFilter({picksOnly: !picksOnly})}
      >
        ★ My picks <span>({dayPicks.length})</span>
        {dayClash > 0 && <span className="warn">⚠ {dayClash} clash</span>}
      </button>
      {GROUPS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={`chip g-${key}`}
          aria-pressed={groups.includes(key)}
          onClick={() => setFilter({groups: groups.includes(key) ? groups.filter(x => x !== key) : [...groups, key]})}
        >
          <i></i>{label}
        </button>
      ))}
      {isFestivalDay(NOW.date) && (
        <button type="button" className="chip now" onClick={jumpToNow}>Now</button>
      )}
    </div>
  );
}
