// Browser history owns navigation; the store still owns the currently rendered stack.
// Only public sheet descriptors go into history.state. Notes, picks and invitation tokens never do.
import {byNo, spkBySlug, actBySlug, VENUES} from './data/index.js';
import {usePlanner} from './store/planner.js';
import {attachSheetNavigation, useSheet} from './store/sheet.js';

export const HISTORY_KEY = 'htlgiNavigation';
const id = () => crypto.randomUUID();
const ANCHORS = ['', '#about', '#privacy', '#main'];
const nearestEvent = stack => [...stack].reverse().find(e => e.kind === 'event');

function validEntry(e){
  if (!e || typeof e.id !== 'string' || !e.id || e.id.length > 64) return false;
  if (e.mode !== undefined && !['notes', 'edit-note', 'crew', 'mine'].includes(e.mode)) return false;
  if (e.kind === 'event') return byNo.has(e.key);
  if (e.kind === 'speaker') return spkBySlug.has(e.key);
  if (e.kind === 'act') return actBySlug.has(e.key);
  if (e.kind === 'map') return VENUES.includes(e.key);
  return ['hub', 'stats', 'reading'].includes(e.kind) && e.key === undefined;
}

function readRecord(){
  const record = history.state?.[HISTORY_KEY];
  if (!record || record.version !== 1 || typeof record.chain !== 'string' ||
      !Number.isSafeInteger(record.index) || record.index < 0 || record.index >= history.length ||
      !Array.isArray(record.stack) || record.stack.length !== record.index ||
      !record.stack.every(validEntry) || new Set(record.stack.map(e => e.id)).size !== record.stack.length || typeof record.base !== 'string' ||
      !record.base.startsWith(location.pathname + location.search) ||
      !ANCHORS.includes(record.base.slice((location.pathname + location.search).length))) return null;
  return record;
}

export function startSheetHistory(route){
  // IDs let Back/Forward reuse the actual entry objects that Sheet's reading-position cache keys on.
  const entries = new Map();
  const ids = new WeakMap();
  let current = null;
  let routing = false;
  let pending = false;
  let queued = [];
  const previousRestoration = history.scrollRestoration;
  history.scrollRestoration = 'manual';

  const stackNow = () => useSheet.getState().stack;
  const describe = e => {
    if (!ids.has(e)) { const key = id(); ids.set(e, key); entries.set(key, e); }
    return {id: ids.get(e), kind: e.kind, key: e.key, ...(e.mode === undefined ? {} : {mode: e.mode})};
  };
  const materialize = e => {
    const cached = entries.get(e.id);
    if (cached && (cached.kind !== e.kind || cached.key !== e.key || cached.mode !== e.mode)) entries.delete(e.id);
    if (!entries.has(e.id)) {
      const entry = {kind: e.kind, key: e.key, ...(e.mode === undefined ? {} : {mode: e.mode})};
      entries.set(e.id, entry);
      ids.set(entry, e.id);
    }
    return entries.get(e.id);
  };
  const urlFor = (stack, base) => {
    const event = nearestEvent(stack);
    return event ? base.split('#')[0] + '#event=' + event.key : base;
  };
  const show = stack => {
    const event = nearestEvent(stack);
    if (event) {
      const day = byNo.get(event.key).date;
      if (usePlanner.getState().day !== day) usePlanner.getState().setFilter({day});
    }
    useSheet.setState({stack});
  };
  function write(stack, replace){
    const record = {...current, index: stack.length, stack: stack.map(describe)};
    const state = history.state && typeof history.state === 'object' ? history.state : {};
    history[replace ? 'replaceState' : 'pushState']({...state, [HISTORY_KEY]: record}, '', urlFor(stack, record.base));
    current = record;
    show(stack);
  }
  function restore(record){
    current = record;
    show(record.stack.map(materialize));
  }
  function establishBase(stack){
    // An unknown arrival is a new boundary. Never guess how far it is safe to rewind.
    const anchor = ANCHORS.includes(location.hash) ? location.hash : '';
    current = {version: 1, chain: id(), index: 0, stack: [], base: location.pathname + location.search + anchor};
    write([], true);
    for (let i = 1; i <= stack.length; i++) write(stack.slice(0, i), false);
  }
  function readArrival(event){
    if (event?.type === 'hashchange' && event.newURL !== location.href) return false;
    const record = readRecord();
    if (record && location.pathname + location.search + location.hash === urlFor(record.stack, record.base)) {
      restore(record);
      return true;
    }
    const previousURL = current && new URL(urlFor(current.stack, current.base), location.origin).href;
    // Native hash assignments emit popstate followed by hashchange. Wait for the latter's
    // oldURL before adopting the new entry as a continuation of the known current visit.
    if (!record && current && event?.type === 'popstate' && location.href !== previousURL) return false;
    const continues = event?.type === 'hashchange' && event.oldURL === previousURL;
    // Process a new hash exactly once. Replacing it with an owned entry makes the following
    // hashchange (browsers also emit popstate) an idempotent restore, not a second route action.
    const fragment = location.hash;
    const previousStack = stackNow();
    routing = true;
    try { route(); } finally { routing = false; }
    const hasPayload = /(?:^#|&)(?:picks|verdicts|notes|join)=/.test(fragment);
    const hasEvent = /(?:^#|&)event=\d+(?:&|$)/.test(fragment);
    const nextStack = stackNow();
    if (continues && nextStack.length === previousStack.length + 1 &&
        previousStack.every((entry, i) => entry === nextStack[i])) {
      // The browser already pushed this event URL; adopt it rather than pushing a duplicate.
      write(nextStack, true);
      return true;
    }
    if (continues && hasPayload && nextStack.length === previousStack.length) {
      // An import/invite is a transient action, not another detail panel. Scrub its entry
      // before returning to the prior owned visit; Forward can only reach a clean programme.
      const base = location.pathname + location.search;
      const clean = {version: 1, chain: id(), index: 0, stack: [], base};
      history.replaceState({...history.state, [HISTORY_KEY]: clean}, '', base);
      pending = true;
      history.back();
      return false;
    }
    establishBase(hasPayload || hasEvent ? stackNow() : []);
    return true;
  }
  function onNavigation(event){
    if (!readArrival(event)) return;
    pending = false;
    const actions = queued;
    queued = [];
    actions.forEach(action => action());
  }
  function change(next, replace){
    if (routing) {
      useSheet.setState({stack: [...(replace ? stackNow().slice(0, -1) : stackNow()), next]});
      return;
    }
    if (pending) { queued.push(() => change(next, replace)); return; }
    // A hash can be assigned immediately before an action, before its browser event arrives.
    if (!readRecord()) readArrival();
    const stack = [...(replace ? stackNow().slice(0, -1) : stackNow()), next];
    write(stack, replace && current.index > 0);
  }
  function leave(all){
    if (pending) return; // repeated close/back clicks must not walk beyond the planner's base
    const record = readRecord();
    if (!record || record.chain !== current.chain || record.index !== current.index) {
      readArrival();
    }
    if (!current.index) return;
    const distance = all ? current.index : 1;
    pending = true;
    // Close synchronously so callers can return focus/scroll to the programme as before.
    show(all ? [] : stackNow().slice(0, -1));
    history.go(-distance);
  }

  readArrival();
  const detach = attachSheetNavigation({
    open: next => change(next, false),
    replaceTop: next => change(next, true),
    back: () => leave(false),
    close: () => leave(true),
  });
  window.addEventListener('popstate', onNavigation);
  window.addEventListener('hashchange', onNavigation);
  return () => {
    detach();
    window.removeEventListener('popstate', onNavigation);
    window.removeEventListener('hashchange', onNavigation);
    history.scrollRestoration = previousRestoration;
    queued = [];
  };
}
