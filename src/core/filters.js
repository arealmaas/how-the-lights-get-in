// src/core/filters.js — whether an event matches the toolbar's filters. Pure: state and picks are arguments,
// not globals; inPlan(no) answers "is this in the crew's plan?" for the crewOnly filter (CREW-SPEC section 3).
import {GROUP} from '../data/index.js';

export function matches(e, f, picks, inPlan){
  if (e.date !== f.day) return false;
  if (f.groups.length && !f.groups.includes(GROUP[e.type])) return false;
  if (f.venue && e.venue !== f.venue) return false;
  if (f.topic && !e.topics.includes(f.topic)) return false;
  if (f.picksOnly && !picks.has(e.eventNo)) return false;
  if (f.crewOnly && !inPlan(e.eventNo)) return false;
  if (f.q) {
    const hay = [e.title, e.speakers.join(' '), e.hosts.join(' '), e.venue, e.type, e.topics.join(' '), e.description].join(' ').toLowerCase();
    if (!hay.includes(f.q)) return false;
  }
  return true;
}
export const hasFilters = f => f.groups.length || f.venue || f.topic || f.picksOnly || f.crewOnly || f.q;
