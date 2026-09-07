// src/ui/Status.jsx — ported from the old renderStatus(): the "Showing N of M events" line and the
// clear-filters link, visible only while a filter is narrowing the day's list.
import {EVENTS, DAYS} from '../data/index.js';
import {usePlanner} from '../store/planner.js';
import {hasFilters} from '../core/filters.js';

export default function Status({shown, onClear}){
  const day = usePlanner(s => s.day);
  const groups = usePlanner(s => s.groups);
  const venue = usePlanner(s => s.venue);
  const topic = usePlanner(s => s.topic);
  const picksOnly = usePlanner(s => s.picksOnly);
  const crewOnly = usePlanner(s => s.crewOnly);
  const q = usePlanner(s => s.q);
  const filters = {groups, venue, topic, picksOnly, crewOnly, q};
  const active = hasFilters(filters);
  const total = EVENTS.filter(e => e.date === day).length;

  return (
    <div className="status" id="status" hidden={!active}>
      {active && (
        <>
          <span>Showing <b>{shown}</b> of {total} {DAYS[day]} events</span>
          <button type="button" className="linkbtn" onClick={onClear}>Clear filters</button>
        </>
      )}
    </div>
  );
}
