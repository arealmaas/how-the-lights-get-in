// Keep the day's result count visible; offer a reset while filters narrow the programme.
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
  const picks = usePlanner(s => s.picks);
  const inCrew = useInCrew();
  // the same reading of crewOnly that useFiltered applies, so a persisted flag left over from a crew that
  // has gone cannot offer "Clear filters" over a list nothing is filtering
  const filters = {groups, venue, topic, picksOnly, crewOnly: crewOnly && inCrew, q};
  const active = hasFilters(filters);
  const total = EVENTS.filter(e => e.date === day).length;

  return (
    <div className="status" id="status">
      <span role="status" aria-live="polite" aria-atomic="true">{active ? <>Showing <b>{shown}</b> of {total} {DAYS[day]} events</> : <><b>{shown}</b> {DAYS[day]} events</>}</span>
      {active ? <button type="button" className="linkbtn" onClick={onClear}>Clear filters</button> : <span className="status-hint">{picks.size ? 'Your picks are marked with a star.' : 'Star events to plan your weekend.'}</span>}
    </div>
  );
}
