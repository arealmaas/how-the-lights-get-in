import {create} from 'zustand';
export const useCloud = create(set => ({
  user: null, accountName: '', marker: null, syncPending: false, syncStopped: false, syncPaused: false, signInBranch: '',
  crewId: null, crew: null,
  stats: {writes: 0, snapshots: 0},   // spec section 10, quota sanity (the old page's window.htlgiSyncStats)
  patch(p){ set(p); },
}));
