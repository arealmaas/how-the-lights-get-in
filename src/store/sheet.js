// src/store/sheet.js — the sheet stack. An entry is {kind, key} plus an optional `mode`, which a sheet
// may read as its opening state: the hub's "Crew reading list" opens the reading sheet on its Crew tab
// (CREW-SPEC section 7). The field is only present when a caller asks for it, so every other entry keeps
// exactly the shape it had.
import {create} from 'zustand';
const entry = (kind, key, mode) => (mode === undefined ? {kind, key} : {kind, key, mode});
export const useSheet = create((set, get) => ({
  stack: [],
  open(kind, key, mode){ set({stack: [...get().stack, entry(kind, key, mode)]}); },
  replaceTop(kind, key, mode){ const s = get().stack.slice(0, -1); set({stack: [...s, entry(kind, key, mode)]}); },
  back(){ set({stack: get().stack.slice(0, -1)}); },
  close(){ set({stack: []}); },
}));
export const topSheet = () => useSheet.getState().stack.at(-1) || null;
