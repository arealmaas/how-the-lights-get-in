// src/core/time.js — the clock: real London time, the ?now= preview override, and duration arithmetic.
// Pure: SIM/NOW are functions of a `search` string rather than reading `location` directly, so tests can pass one.
import {DAYS} from '../data/index.js';

export function londonNow(){
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false}).formatToParts(new Date());
  const g = t => parts.find(p => p.type === t).value;
  return {date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`, simulated: false};
}
export function simulatedNow(search){
  const v = new URLSearchParams(search).get('now');
  return v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) ? {date: v.slice(0, 10), time: v.slice(11, 16), simulated: true} : null;
}
export function currentNow(search){ return simulatedNow(search) || londonNow(); }
export const minutes = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const DURATION = {};   // minutes by type; everything is assumed to last 60 — the site publishes start times only
export const dur = e => DURATION[e.type] || 60;
export function addMinutes(time, mins){ const t = minutes(time) + mins; return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }
export const isFestivalDay = date => !!DAYS[date];
