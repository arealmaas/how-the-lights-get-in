import {create} from 'zustand';
export const useSheet = create((set, get) => ({
  stack: [],
  open(kind, key){ set({stack: [...get().stack, {kind, key}]}); },
  replaceTop(kind, key){ const s = get().stack.slice(0, -1); set({stack: [...s, {kind, key}]}); },
  back(){ set({stack: get().stack.slice(0, -1)}); },
  close(){ set({stack: []}); },
}));
export const topSheet = () => useSheet.getState().stack.at(-1) || null;
