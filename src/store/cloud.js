import {create} from 'zustand';
export const useCloud = create(set => ({
  user: null, accountName: '', marker: null, syncPending: false, syncStopped: false, syncPaused: false, signInBranch: '',
  crewId: null, crew: null,
  patch(p){ set(p); },
}));
