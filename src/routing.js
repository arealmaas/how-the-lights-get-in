// src/routing.js — hash-route handling. For now, only #event=: opens the event sheet on boot and on
// hashchange, switching the day first if the event isn't on the currently-selected one. #join= and the
// picks/verdicts/notes import banner are added in later tasks (this file grows, not replaces).
import {byNo} from './data/index.js';
import {usePlanner} from './store/planner.js';
import {useSheet} from './store/sheet.js';

function applyEventHash(){
  const m = location.hash.match(/event=(\d+)/);
  if (!m) return;
  const no = +m[1];
  const e = byNo.get(no);
  if (!e) return;
  if (usePlanner.getState().day !== e.date) usePlanner.getState().setFilter({day: e.date});
  useSheet.getState().open('event', no);
}

export function boot(){
  applyEventHash();
}

export function onHashChange(){
  applyEventHash();
}
