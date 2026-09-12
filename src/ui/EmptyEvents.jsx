import {DAYS, EVENTS} from '../data/index.js';
import {matches} from '../core/filters.js';
import {usePlanner} from '../store/planner.js';
import {useCrewPlan, useInCrew} from './useFiltered.js';

export default function EmptyEvents(){
  const state = usePlanner();
  const plan = useCrewPlan();
  const inCrew = useInCrew();
  const otherDay = Object.keys(DAYS).find(d => d !== state.day);
  const filters = {...state, day: otherDay, crewOnly: state.crewOnly && inCrew};
  const otherCount = EVENTS.filter(e => matches(e, filters, state.picks, no => plan.has(no))).length;
  const noPicks = state.picksOnly && !EVENTS.some(e => e.date === state.day && state.picks.has(e.eventNo));

  return (
    <div className="empty">
      <span className="empty-symbol" aria-hidden="true">{noPicks ? '☆' : '⌕'}</span>
      <h2>{noPicks ? `No picks for ${DAYS[state.day]} yet` : `No matching events on ${DAYS[state.day]}`}</h2>
      <p>{noPicks ? 'Star the events you want to see, then find them here.' : 'Try a different search or reset your filters to see the full day.'}</p>
      <div className="empty-actions">
        <button type="button" className="btn primary" onClick={() => state.clearFilters()}>{noPicks ? 'Browse the programme' : 'Reset filters'}</button>
        {otherCount > 0 && <button type="button" className="btn" onClick={() => state.setFilter({day: otherDay})}>See {otherCount} on {DAYS[otherDay]}</button>}
      </div>
    </div>
  );
}
