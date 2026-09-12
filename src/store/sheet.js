// src/store/sheet.js — the sheet stack. An entry is {kind, key} plus an optional `mode`, which a sheet
// may read as its opening state: the hub's "Crew reading list" opens the reading sheet on its Crew tab
// (CREW-SPEC section 7). The field is only present when a caller asks for it, so every other entry keeps
// exactly the shape it had.
import {create} from 'zustand';
const entry = (kind, key, mode) => (mode === undefined ? {kind, key} : {kind, key, mode});
// The browser bridge is installed at boot. Component/unit use remains an in-memory stack.
let navigation = null;
export function attachSheetNavigation(next){
  navigation = next;
  return () => { if (navigation === next) navigation = null; };
}
export const useSheet = create((set, get) => ({
  stack: [],
  open(kind, key, mode){ const next = entry(kind, key, mode); if (navigation) return navigation.open(next); set({stack: [...get().stack, next]}); },
  replaceTop(kind, key, mode){ const next = entry(kind, key, mode); if (navigation) return navigation.replaceTop(next); set({stack: [...get().stack.slice(0, -1), next]}); },
  back(){ if (navigation) return navigation.back(); set({stack: get().stack.slice(0, -1)}); },
  close(){ if (navigation) return navigation.close(); set({stack: []}); },
}));
export const topSheet = () => useSheet.getState().stack.at(-1) || null;
