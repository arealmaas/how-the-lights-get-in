// src/core/calendar.js — .ics export and Google Calendar links. Pure text building: download() stays in the
// UI layer, not here. The .ics output is byte-for-byte what the old page produced for the same input.
import {DAYS, BRIEFINGS, LONDON_OFFSET_MIN, PUBLIC_URL} from '../data/index.js';
import {whoPlain, ticketLine, cleanDesc, slug} from './labels.js';
import {addMinutes, dur} from './time.js';

function utcStamp(date, time){
  const [y, mo, d] = date.split('-').map(Number); const [h, mi] = time.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - LONDON_OFFSET_MIN * 60000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
export function eventTimes(e){ return {start: utcStamp(e.date, e.time), end: utcStamp(e.date, addMinutes(e.time, dur(e))), dur: dur(e)}; }
// prefix (eg. "Going: Are, Kari" for a crew calendar) goes first, then the usual event detail.
export function calDescription(e, prefix = ''){
  const lines = [];
  if (prefix) lines.push(prefix, '');
  lines.push(`${e.type} · ${e.venue} · ${DAYS[e.date]} ${e.time} (London time)`);
  if (whoPlain(e)) lines.push(whoPlain(e));
  lines.push('');
  if (cleanDesc(e.description)) lines.push(cleanDesc(e.description), '');
  const b = BRIEFINGS[e.eventNo];
  if (b) lines.push(`Briefing: ${b.question}`, '');
  lines.push(`Tickets: ${ticketLine(e)}`, `Topics: ${e.topics.join(', ')}`);
  if (e.url) lines.push(`Event page: ${e.url}`);
  lines.push(`Planner: ${PUBLIC_URL}#event=${e.eventNo}`);
  lines.push('', `End time is an estimate (${dur(e)} min) — the festival publishes start times only. From an unofficial planner, not affiliated with HowTheLightGetsIn.`);
  return lines.join('\n');
}
export const calLocation = e => `${e.venue}, HowTheLightGetsIn London, Kenwood House, Hampstead Lane, London NW3 7JR`;
const icsText = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function fold(line){
  const enc = new TextEncoder(); let out = '', cur = '', limit = 75;
  for (const ch of line) {
    if (enc.encode(cur + ch).length > limit) { out += cur + '\r\n '; cur = ch; limit = 74; }
    else cur += ch;
  }
  return out + cur;
}
function vevent(e, stamp, prefixFor){
  const {start, end} = eventTimes(e);
  const prefix = prefixFor ? prefixFor(e) : '';
  return ['BEGIN:VEVENT', `UID:htlgi-london-2026-${e.id}@arealmaas.github.io`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${icsText(e.title)}`, `LOCATION:${icsText(calLocation(e))}`, 'GEO:51.5712;-0.1676', `DESCRIPTION:${icsText(calDescription(e, prefix))}`,
    e.url ? `URL:${e.url}` : null, `CATEGORIES:${icsText(e.type)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT15M', `DESCRIPTION:${icsText(e.title + ' starts in 15 minutes · ' + e.venue)}`, 'END:VALARM', 'END:VEVENT'].filter(Boolean);
}
// prefixFor(e), when given, returns a per-event description prefix (eg. a crew calendar's "Going: …").
export function icsFile(events, name, prefixFor = null){
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//arealmaas//HTLGI London 2026 Planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsText(name)}`, 'X-WR-TIMEZONE:Europe/London'];
  events.forEach(e => lines.push(...vevent(e, stamp, prefixFor)));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
export function gcalLink(e){
  const {start, end} = eventTimes(e);
  const p = new URLSearchParams({action:'TEMPLATE', text:e.title, dates:`${start}/${end}`, details:calDescription(e).slice(0, 1800), location:calLocation(e), ctz:'Europe/London'});
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}
export const icsFilename = e => `htlgi-${e.date.slice(5)}-${slug(e.title)}.ics`;
