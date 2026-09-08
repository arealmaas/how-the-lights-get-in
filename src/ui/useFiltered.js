// src/ui/useFiltered.js — the toolbar's filtered list plus the clash maps, recomputed only when the
// planner store's filters, picks or search text change. `crewAny` is the set of event numbers picked by
// at least one crew member other than me (CREW-SPEC section 7 "Everywhere"): it backs the Crew chip's
// count, the crewOnly filter and the crew calendar's union. Without a crew it is empty and crewOnly is
// ignored, so nothing here changes what a signed-out or CLOUD-off visitor sees.
import {useMemo} from 'react';
import {usePlanner} from '../store/planner.js';
import {useCloud, selectMyUid} from '../store/cloud.js';
import {EVENTS} from '../data/index.js';
import {matches} from '../core/filters.js';
import {crewPicked} from '../core/crew.js';
import {computeClashes} from '../core/clashes.js';
import {currentNow} from '../core/time.js';

// The frozen "now" the shell was loaded with — used to mark past time slots in the list and grid.
// (NowNext keeps its own live-updating clock; this one only needs to be right once per page load.)
export const NOW = currentNow(typeof window !== 'undefined' ? window.location.search : '');

const EMPTY = new Set();

// In a crew and knowing who I am: the one condition the whole overlay hangs on. It is deliberately
// selectMyUid and not `user`, so a cold or offline start paints the cached crew (see store/cloud.js).
export const useInCrew = () => !!(useCloud(s => s.crew) && useCloud(selectMyUid));

// the set on its own, for the components that want it without the filtered list (the Crew chip, the hub)
export function useCrewAny(){
  const crew = useCloud(s => s.crew);
  const myUid = useCloud(selectMyUid);
  return useMemo(() => (crew && myUid ? crewPicked(crew.members, myUid) : EMPTY), [crew, myUid]);
}

export function useFiltered(){
  const day = usePlanner(s => s.day);
  const groups = usePlanner(s => s.groups);
  const venue = usePlanner(s => s.venue);
  const topic = usePlanner(s => s.topic);
  const picksOnly = usePlanner(s => s.picksOnly);
  const crewOnly = usePlanner(s => s.crewOnly);
  const q = usePlanner(s => s.q);
  const picks = usePlanner(s => s.picks);
  const crewAny = useCrewAny();
  const inCrew = useInCrew();

  return useMemo(() => {
    // crewOnly only bites while there is a crew to filter by — the same condition the chip is rendered
    // under. cloud/crew.js clears the flag whenever the crew goes away, but it is also persisted, so a
    // boot that finds no crew (signed out, offline before the SDK loads, a build with no Firebase config)
    // must not leave an un-pressable chip hiding the whole programme.
    const filters = {day, groups, venue, topic, picksOnly, crewOnly: crewOnly && inCrew, q};
    const list = EVENTS.filter(e => matches(e, filters, picks, no => crewAny.has(no)));
    const {clashes, soft} = computeClashes(EVENTS, picks);
    return {list, clashes, soft, crewAny};
  }, [day, groups, venue, topic, picksOnly, crewOnly, q, picks, crewAny, inCrew]);
}
