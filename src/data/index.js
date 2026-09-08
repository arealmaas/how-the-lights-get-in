// src/data/index.js — the JSON imports and the derived lookups the rest of the app reads from.
// Build-time data only: no DOM, no Firebase SDK. `data/firebase.json` is optional (see FIREBASE below),
// so the build succeeds without it and CLOUD is false.
import programme from '../../programme.json';
import briefingsRaw from '../../data/briefings.json';
import mediaRaw from '../../data/media.json';
import extraRaw from '../../data/speakers-extra.json';

export const EVENTS = programme.events, SPEAKERS = programme.speakers, ACTS = programme.acts;
export const BRIEFINGS = Object.fromEntries(Object.entries(briefingsRaw).filter(([k]) => !k.startsWith('_')));
export const BRIEF_NOTE = briefingsRaw._meta.note;
export const MEDIA = {acts: mediaRaw.acts, films: mediaRaw.films};
export const PLAYLIST = mediaRaw._meta.playlist;
export const PUBLIC_URL = 'https://how-the-light-gets-in.firebaseapp.com/';
export const EXTRACTED_AT = programme.meta.extractedAt;   // ISO string; the footer formats it for display

export const byNo = new Map(EVENTS.map(e => [e.eventNo, e]));
export const spkBySlug = new Map(SPEAKERS.filter(s => s.slug).map(s => [s.slug, s]));
export const spkByName = new Map(SPEAKERS.map(s => [s.name.toLowerCase(), s]));
export const actBySlug = new Map(ACTS.map(a => [a.slug, a]));
export const GROUP = {'Debates':'debates','Talks':'talks','IAI Academy':'talks','Inner Circle':'inner','Long Table Banquet':'inner','DokBox':'cinema',"Children's Programme":'kids','Music':'music','Music & Acoustic':'music','Comedy':'music','Cabaret':'music'};
export const GROUPS = [['debates','Debates'],['talks','Talks & Academy'],['music','Music & Comedy'],['cinema','Cinema'],['inner','Inner Circle & Banquets'],['kids',"Children's"]];
export const VENUES = ['Arena','International','Ring','Hat','Academy','Stage','Cinema','Inner Circle Tent',"Children's Tent",'Waterfront'];
export const PERFORMANCE = new Set(['Music','Music & Acoustic','Comedy','Cabaret']);
export const TOPICS = [...new Set(EVENTS.flatMap(e => e.topics))].sort();
export const DAYS = {'2026-09-19':'Saturday','2026-09-20':'Sunday'};
export const LONDON_OFFSET_MIN = 60;                                      // BST (UTC+1) on 19–20 September 2026
export const EXTRA = extraRaw.speakers;

// data/firebase.json is optional: a glob (not a static import) so the build succeeds without it.
export const FIREBASE = Object.values(import.meta.glob('/data/firebase.json', {eager: true}))[0]?.default ?? null;
export const CLOUD = !!FIREBASE;
