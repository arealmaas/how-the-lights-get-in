// src/cloud/firebase.js — the only module in the app that imports firebase/*. It is reached exclusively
// through import('./firebase.js') in cloud/auth.js, so Rollup gives the SDK its own async chunk and a
// visitor without an account never downloads it (design section 2, CREW-SPEC section 6 "Loading").
//
// Firestore is initialised with a persistent, multi-tab local cache: reads work from cache offline and
// writes queue until the phone is back online, in every tab.
import {initializeApp} from 'firebase/app';
import * as A from 'firebase/auth';
import * as F from 'firebase/firestore';

let instance = null;

// Memoised: initializeApp/initializeFirestore must run once per page, and loadFirebase() may be called
// from several places (boot, the Account card, a pending invite) before the first one settles.
export async function init(config){
  if (instance) return instance;
  const app = initializeApp(config);
  const db = F.initializeFirestore(app, {localCache: F.persistentLocalCache({tabManager: F.persistentMultipleTabManager()})});
  instance = {app, auth: A.getAuth(app), db, A, F};
  return instance;
}
