// src/cloud/platform.js — the three platform tests the old page kept as globals. They decide the sign-in
// method (popup or redirect) and the order of the two sign-in buttons; nothing else reads them.
// Evaluated once at module load, exactly as the old page did.
export const STANDALONE = (typeof window !== 'undefined' && window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
export const IOS = /iP(hone|ad|od)/.test(navigator.userAgent);
export const PHONE = /Mobi|Android|iP(hone|ad|od)/.test(navigator.userAgent);
