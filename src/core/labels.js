// src/core/labels.js — small label and text-shaping helpers with no DOM: they return plain data or plain
// strings, never markup (ticketBadge used to render a <span>; here it is data only, for a component to render).
export function ticketBadge(e){
  if (e.ticketing === 'sold_out') return {cls: 'badge sold', text: 'Sold out'};
  if (e.ticketing === 'separate_ticket') {
    const p = e.prices || {}; const from = Math.min(...Object.values(p).filter(Number.isFinite));
    return {cls: 'badge sep', text: `Separate ticket${Number.isFinite(from) ? ' · from £' + from : ''}`};
  }
  if (e.ticketing === 'fast_pass') return {cls: 'badge', text: 'Included · optional Fast Pass'};
  return {cls: 'badge', text: 'Included'};
}
export function ticketLine(e){
  if (e.ticketing === 'sold_out') return 'Separately ticketed · sold out';
  if (e.ticketing === 'separate_ticket') {
    const p = e.prices || {}; const bits = ['earlybird','advance','standard'].filter(k => k in p).map(k => `${k[0].toUpperCase() + k.slice(1)} £${p[k]}`);
    return 'Not included with the Festival Ticket' + (bits.length ? ' · ' + bits.join(' / ') + ' (+ VAT)' : '');
  }
  if (e.ticketing === 'fast_pass') return `Included with the Festival Ticket · optional Fast Pass${e.fastPassPrice ? ' £' + e.fastPassPrice + ' + VAT' : ''} (skip the queue, reserved seat)`;
  return 'Included with the Festival Ticket';
}
export const whoPlain = e => [e.speakers.join(', '), e.hosts.length ? 'hosted by ' + e.hosts.join(' & ') : ''].filter(Boolean).join(' · ');
export const initials = n => { const w = String(n).split(/\s+/).filter(Boolean); return (w.length ? w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '') : '?').toUpperCase().replace(/[^\p{L}\p{N}]/gu, ''); };
export const slug = s => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
export const cleanDesc = s => (s || '').replace(/\s*Click here to view the [^.]*menu\.?/g, '').trim();
export const ytId = url => { const m = String(url).match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([\w-]{6,})/); return m ? m[1] : null; };
