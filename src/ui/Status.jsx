// src/ui/Status.jsx — ported from the old renderStatus(): the "Showing N of M events" line and the
// clear-filters link, visible only while a filter is narrowing the day's list.
import {EVENTS, DAYS} from '../data/index.js';
import {usePlanner} from '../store/planner.js';
import {hasFilters} from '../core/filters.js';
import {useInCrew} from './useFiltered.js';

export default function Status({shown, onClear}){
  const day = usePlanner(s => s.day);
  const groups = usePlanner(s => s.groups);
  const venue = usePlanner(s => s.venue);
  const topic = usePlanner(s => s.topic);
  const picksOnly = usePlanner(s => s.picksOnly);
  const crewOnly = usePlanner(s => s.crewOnly);
  const q = usePlanner(s => s.q);
  const inCrew = useInCrew();
  // the same reading of crewOnly that useFiltered applies, so a persisted flag left over from a crew that
  // has gone cannot offer "Clear filters" over a list nothing is filtering
  const filters = {groups, venue, topic, picksOnly, crewOnly: crewOnly && inCrew, q};
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
