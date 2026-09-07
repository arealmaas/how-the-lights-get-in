import test, {before, after, beforeEach} from 'node:test';
import fs from 'node:fs';
import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, Timestamp} from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-htlgi',
    firestore: {rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')},
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

// helpers shared by every rules test
export const as = uid => env.authenticatedContext(uid).firestore();
export const anon = () => env.unauthenticatedContext().firestore();
export const admin = fn => env.withSecurityRulesDisabled(ctx => fn(ctx.firestore()));
export const fullUser = (over = {}) => ({name: 'Are', picks: {}, verdicts: {}, notes: {}, shared: {}, updatedAt: serverTimestamp(), v: 1, ...over});

test('harness: an unauthenticated client cannot read a user document', async () => {
  await admin(db => setDoc(doc(db, 'users', 'alice'), fullUser()));
  await assertFails(getDoc(doc(anon(), 'users', 'alice')));
});

test('harness: the owner can read their own user document', async () => {
  await admin(db => setDoc(doc(db, 'users', 'alice'), fullUser()));
  await assertSucceeds(getDoc(doc(as('alice'), 'users', 'alice')));
});

test('users: the owner creates the complete document, a partial create is denied', async () => {
  await assertFails(setDoc(doc(as('alice'), 'users', 'alice'), {name: 'Alice', updatedAt: serverTimestamp(), v: 1}));
  await assertSucceeds(setDoc(doc(as('alice'), 'users', 'alice'), fullUser({name: 'Alice'})));
});

test('users: another account cannot read, write or delete it', async () => {
  await admin(db => setDoc(doc(db, 'users', 'alice'), fullUser()));
  await assertFails(getDoc(doc(as('bob'), 'users', 'alice')));
  await assertFails(updateDoc(doc(as('bob'), 'users', 'alice'), {'picks.3': true, updatedAt: serverTimestamp()}));
  await assertFails(deleteDoc(doc(as('bob'), 'users', 'alice')));
  await assertFails(getDocs(collection(as('bob'), 'users')));
  await assertFails(getDocs(collection(as('alice'), 'users')));
});

test('users: field-level updates with a server timestamp pass, everything else fails', async () => {
  await admin(db => setDoc(doc(db, 'users', 'alice'), fullUser()));
  const me = doc(as('alice'), 'users', 'alice');
  await assertSucceeds(updateDoc(me, {'picks.41': true, updatedAt: serverTimestamp()}));
  await assertSucceeds(updateDoc(me, {'picks.41': deleteField(), 'notes.41': 'a note', 'shared.41': true, updatedAt: serverTimestamp()}));
  await assertSucceeds(updateDoc(me, {crew: 'AbCdEfGhIjKlMnOpQrSt', updatedAt: serverTimestamp()}));
  await assertSucceeds(updateDoc(me, {crew: deleteField(), updatedAt: serverTimestamp()}));
  await assertFails(updateDoc(me, {'picks.41': true}));                                             // no updatedAt
  await assertFails(updateDoc(me, {'picks.41': true, updatedAt: Timestamp.fromMillis(Date.now())}));  // client timestamp
  await assertFails(updateDoc(me, {extra: 1, updatedAt: serverTimestamp()}));                       // unknown key
  await assertFails(updateDoc(me, {name: 'x'.repeat(41), updatedAt: serverTimestamp()}));           // name too long
  await assertFails(updateDoc(me, {crew: 7, updatedAt: serverTimestamp()}));                        // pointer not a string
  await assertFails(updateDoc(me, {v: 2, updatedAt: serverTimestamp()}));                           // version pinned
  await assertFails(updateDoc(me, {picks: 'nope', updatedAt: serverTimestamp()}));                  // map replaced by a string
});

test('users: the owner can delete their document', async () => {
  await admin(db => setDoc(doc(db, 'users', 'alice'), fullUser()));
  await assertSucceeds(deleteDoc(doc(as('alice'), 'users', 'alice')));
});
