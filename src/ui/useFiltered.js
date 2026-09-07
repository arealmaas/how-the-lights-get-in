// src/ui/useFiltered.js — the toolbar's filtered list plus the clash maps, recomputed only when the
// planner store's filters, picks or search text change. `crewAny` is a stable stub until Task 10 wires
// the cloud store's crew into it.
import {useMemo} from 'react';
import {usePlanner} from '../store/planner.js';
import {EVENTS} from '../data/index.js';
import {matches} from '../core/filters.js';
import {computeClashes} from '../core/clashes.js';
import {currentNow} from '../core/time.js';

// The frozen "now" the shell was loaded with — used to mark past time slots in the list and grid.
// (NowNext keeps its own live-updating clock; this one only needs to be right once per page load.)
export const NOW = currentNow(typeof window !== 'undefined' ? window.location.search : '');

const crewAny = () => false;   // Task 10 replaces this with a lookup into the cloud store's crew

export function useFiltered(){
  const day = usePlanner(s => s.day);
  const groups = usePlanner(s => s.groups);
  const venue = usePlanner(s => s.venue);
  const topic = usePlanner(s => s.topic);
  const picksOnly = usePlanner(s => s.picksOnly);
  const crewOnly = usePlanner(s => s.crewOnly);
  const q = usePlanner(s => s.q);
  const picks = usePlanner(s => s.picks);

  return useMemo(() => {
    const filters = {day, groups, venue, topic, picksOnly, crewOnly, q};
    const list = EVENTS.filter(e => matches(e, filters, picks, crewAny));
    const {clashes, soft} = computeClashes(EVENTS, picks);
    return {list, clashes, soft, crewAny};
  }, [day, groups, venue, topic, picksOnly, crewOnly, q, picks]);
}
