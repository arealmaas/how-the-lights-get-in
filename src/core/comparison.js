import {overlapMin} from './clashes.js';
import {minutes} from './time.js';

const chronological = (a, b) => a.date.localeCompare(b.date) || minutes(a.time) - minutes(b.time) || a.eventNo - b.eventNo;
const uniqueEvents = events => [...new Map(events.map(e => [e.eventNo, e])).values()];

// A later pick can bridge two sessions that do not overlap each other. Keep the
// entire connected group together so a comparison does not hide that tradeoff.
export function conflictGroups(events, picks){
  const picked = uniqueEvents(events).filter(e => picks.has(e.eventNo)).sort(chronological);
  const visited = new Set(), groups = [];
  for (const first of picked) {
    if (visited.has(first.eventNo)) continue;
    const connected = [first];
    visited.add(first.eventNo);
    for (let i = 0; i < connected.length; i++) {
      for (const candidate of picked) {
        if (visited.has(candidate.eventNo) || !overlapMin(connected[i], candidate)) continue;
        visited.add(candidate.eventNo);
        connected.push(candidate);
      }
    }
    if (connected.length < 2) continue;
    connected.sort(chronological);
    groups.push({id: connected[0].eventNo, date: connected[0].date, events: connected});
  }
  return groups;
}

// Choosing one session clears only its direct clashes, not every event in its
// connected group: the user can still attend both ends of an overlap chain.
export function resolveChoice(events, picks, no){
  const chosen = events.find(e => e.eventNo === no);
  if (!chosen) return {changes: {}, removed: []};
  const removed = uniqueEvents(events)
    .filter(e => e.eventNo !== no && picks.has(e.eventNo) && overlapMin(chosen, e) > 0)
    .sort(chronological);
  const changes = {[no]: true};
  for (const e of removed) changes[e.eventNo] = false;
  return {changes, removed};
}
