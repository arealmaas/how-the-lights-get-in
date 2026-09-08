// src/ui/Chips.jsx — ported from the old renderChips(): the "My picks" chip (with a same-day clash
// count), the "Crew" chip (only while in a crew; it filters to the crew's plan), one chip per event
// group, and a "Now" chip on festival days that jumps to the current time. The two plan chips are the
// ones that answer "where am I going" and "where are we going", so they are drawn heavier than the group
// chips — tinted at rest, filled when pressed — and a hairline separates them from the rest of the strip.
import {byNo, EVENTS, GROUPS} from '../data/index.js';
import {usePlanner} from '../store/planner.js';
import {isFestivalDay} from '../core/time.js';
import {NOW, useCrewPlan, useInCrew} from './useFiltered.js';
import CrewIcon from './CrewIcon.jsx';

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
  const crewOnly = usePlanner(s => s.crewOnly);
  const picks = usePlanner(s => s.picks);
  const setFilter = usePlanner(s => s.setFilter);
  const plan = useCrewPlan();
  const inCrew = useInCrew();

  const dayPicks = [...picks].filter(n => byNo.get(n).date === day);
  const dayClash = dayPicks.filter(n => clashes.has(n)).length;
  // the whole day's crew plan, not the currently visible part of it: the count says what pressing it would find
  const dayCrew = inCrew ? EVENTS.filter(e => e.date === day && plan.has(e.eventNo)).length : 0;

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
      {inCrew && (
        <button
          type="button"
          className="chip crewchip"
          aria-pressed={crewOnly}
          onClick={() => setFilter({crewOnly: !crewOnly})}
          title="The crew’s plan"
        >
          <CrewIcon />Crew <span>({dayCrew})</span>
        </button>
      )}
      <span className="chips-sep" aria-hidden="true"></span>
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
