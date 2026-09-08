import {create} from 'zustand';
export const useCloud = create(set => ({
  user: null, accountName: '', marker: null, syncPending: false, syncStopped: false, syncPaused: false, signInBranch: '',
  crewId: null, crew: null,
  stats: {writes: 0, snapshots: 0},   // spec section 10, quota sanity (the old page's window.htlgiSyncStats)
  patch(p){ set(p); },
}));
// Who I am, for everything that only needs an identity to compare against crew members. On a cold start
// the Firebase SDK has not loaded yet and `user` is null for a second or two — or for the whole visit, if
// the device is offline — while hydrateCrewCache() has already painted the cached crew (CREW-SPEC section
// 6, "Failure modes"). The account marker {uid} written by sync.js is that identity in the meantime, so
// the overlay gates on this rather than on `user`. Anything that writes still checks `user` itself.
export const selectMyUid = s => (s.user && s.user.uid) || (s.marker && s.marker.uid) || null;
