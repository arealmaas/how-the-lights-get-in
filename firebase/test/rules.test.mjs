import test, {before, after, beforeEach} from 'node:test';
import fs from 'node:fs';
import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc, serverTimestamp} from 'firebase/firestore';

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
