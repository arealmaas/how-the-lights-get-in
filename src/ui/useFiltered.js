// src/ui/useFiltered.js — the toolbar's filtered list plus the clash maps, recomputed only when the
// planner store's filters, picks or search text change. `crewPlan` is the set of event numbers in the
// crew's plan — the picks map on the crew document (CREW-SPEC section 3, "The crew plan"): it backs the
// Crew chip's count, the crewOnly filter, the card and tile highlight, the crew calendar and the reading
// list's Crew tab. Without a crew it is empty and crewOnly is ignored, so nothing here changes what a
// signed-out or CLOUD-off visitor sees.
import {useMemo} from 'react';
import {usePlanner} from '../store/planner.js';
import {useCloud, selectMyUid} from '../store/cloud.js';
import {EVENTS, byNo} from '../data/index.js';
import {matches} from '../core/filters.js';
import {crewPlan} from '../core/crew.js';
import {computeClashes} from '../core/clashes.js';
import {currentNow} from '../core/time.js';

// The frozen "now" the shell was loaded with — used to mark past time slots in the list and grid.
// (NowNext keeps its own live-updating clock; this one only needs to be right once per page load.)
export const NOW = currentNow(typeof window !== 'undefined' ? window.location.search : '');

const EMPTY = new Set();

// In a crew and knowing who I am: the one condition the whole overlay hangs on. It is deliberately
// selectMyUid and not `user`, so a cold or offline start paints the cached crew (see store/cloud.js).
// Both selectors are read unconditionally and combined afterwards: `&&` between two useCloud calls would
// skip the second one whenever there is no crew, so the render that first sees a crew — the moment you
// create or join one — would run one hook more than the render before it (React error #310).
export const useInCrew = () => {
  const crew = useCloud(s => s.crew);
  const myUid = useCloud(selectMyUid);
  return !!(crew && myUid);
};

// the plan on its own, for the components that want it without the filtered list (the Crew chip, the
// masthead, the hub, the grid). Memoised on the map itself, which a snapshot replaces as a whole.
export function useCrewPlan(){
  const picks = useCloud(s => (s.crew ? s.crew.picks : null));
  const myUid = useCloud(selectMyUid);
  return useMemo(() => (picks && myUid ? new Set([...crewPlan(picks)].filter(no => byNo.has(no))) : EMPTY), [picks, myUid]);
}

// one event's membership of the plan, for a card: a boolean selector, so a card re-renders only when
// its own entry changes, not on every snapshot of the crew document
export const useInPlan = no => {
  const inCrew = useInCrew();
  const on = useCloud(s => !!(s.crew && s.crew.picks && s.crew.picks[no]));
  return inCrew && on;
};

export function useFiltered(){
  const day = usePlanner(s => s.day);
  const groups = usePlanner(s => s.groups);
  const venue = usePlanner(s => s.venue);
  const topic = usePlanner(s => s.topic);
  const picksOnly = usePlanner(s => s.picksOnly);
  const crewOnly = usePlanner(s => s.crewOnly);
  const q = usePlanner(s => s.q);
  const picks = usePlanner(s => s.picks);
  const plan = useCrewPlan();
  const inCrew = useInCrew();

  return useMemo(() => {
    // crewOnly only bites while there is a crew to filter by — the same condition the chip is rendered
    // under. cloud/crew.js clears the flag whenever the crew goes away, but it is also persisted, so a
    // boot that finds no crew (signed out, offline before the SDK loads, a build with no Firebase config)
    // must not leave an un-pressable chip hiding the whole programme.
    const filters = {day, groups, venue, topic, picksOnly, crewOnly: crewOnly && inCrew, q};
    const list = EVENTS.filter(e => matches(e, filters, picks, no => plan.has(no)));
    const {clashes, soft} = computeClashes(EVENTS, picks);
    return {list, clashes, soft, crewPlan: plan};
  }, [day, groups, venue, topic, picksOnly, crewOnly, q, picks, plan, inCrew]);
}
