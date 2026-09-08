import test, {before, after, beforeEach} from 'node:test';
import fs from 'node:fs';
import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, Timestamp, writeBatch} from 'firebase/firestore';

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

test('users: the remaining clauses — non-owner create, every map cap and type, crew length, boundaries', async () => {
  const big = n => Object.fromEntries(Array.from({length: n}, (_, i) => [i + 1, true]));
  await admin(db => setDoc(doc(db, 'users', 'alice'), fullUser()));
  await assertFails(setDoc(doc(as('bob'), 'users', 'carol'), fullUser({name: 'Carol'})));               // only the owner creates
  await assertFails(setDoc(doc(anon(), 'users', 'carol'), fullUser({name: 'Carol'})));
  await assertSucceeds(setDoc(doc(as('carol'), 'users', 'carol'), fullUser({name: 'x'.repeat(40), picks: big(300), crew: 'y'.repeat(40)})));   // boundaries pass
  await assertFails(setDoc(doc(as('dave'), 'users', 'dave'), fullUser({name: 'Dave', picks: big(301)})));
  await assertFails(setDoc(doc(as('dave'), 'users', 'dave'), fullUser({name: 'Dave', verdicts: big(301)})));
  await assertFails(setDoc(doc(as('dave'), 'users', 'dave'), fullUser({name: 'Dave', notes: big(301)})));
  await assertFails(setDoc(doc(as('dave'), 'users', 'dave'), fullUser({name: 'Dave', shared: big(301)})));
  const me = doc(as('alice'), 'users', 'alice');
  await assertSucceeds(updateDoc(me, {'verdicts.6': 'Draw', 'notes.6': 'a note', 'shared.6': true, updatedAt: serverTimestamp()}));
  await assertSucceeds(updateDoc(me, {'verdicts.6': deleteField(), updatedAt: serverTimestamp()}));
  await assertFails(updateDoc(me, {crew: 'z'.repeat(41), updatedAt: serverTimestamp()}));                // pointer too long
  await assertFails(updateDoc(me, {verdicts: 'nope', updatedAt: serverTimestamp()}));                    // each map replaced by a scalar
  await assertFails(updateDoc(me, {notes: 'nope', updatedAt: serverTimestamp()}));
  await assertFails(updateDoc(me, {shared: 'nope', updatedAt: serverTimestamp()}));
});

// ---- crews ----
const CREW = 'AbCdEfGhIjKlMnOpQrSt', OTHER = 'OtherCrewIdAbcdefghi';
const TOKEN = 'abcdefghijklmnopqrstu_', TOKEN2 = 'ABCDEFGHIJKLMNOPQRSTU-';
const fullMember = (over = {}) => ({name: 'Are', joinedAt: serverTimestamp(), picks: {}, verdicts: {}, notes: {}, updatedAt: serverTimestamp(), v: 1, ...over});
const crewDoc = (over = {}) => ({name: 'The Heath Three', createdBy: 'alice', deleted: false, picks: {}, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), v: 1, ...over});
const inviteDoc = (over = {}) => ({crewName: 'The Heath Three', createdBy: 'alice', createdByName: 'Are', createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 14 * 864e5), revoked: false, v: 1, ...over});
const blockDoc = (name = 'Morten') => ({name, removedAt: serverTimestamp(), v: 1});
// alice owns CREW with bob (who shares note 6) as a member and a live invite; carol has an account and no crew;
// OTHER is a second crew owned by dave with its own live invite
async function seedCrew(){
  await admin(async db => {
    await setDoc(doc(db, 'users', 'alice'), fullUser({name: 'Are', crew: CREW}));
    await setDoc(doc(db, 'users', 'bob'), fullUser({name: 'Kari', crew: CREW, shared: {6: true}}));
    await setDoc(doc(db, 'users', 'carol'), fullUser({name: 'Morten'}));
    await setDoc(doc(db, 'users', 'dave'), fullUser({name: 'Dave', crew: OTHER}));
    await setDoc(doc(db, 'crews', CREW), crewDoc());
    await setDoc(doc(db, 'crews', CREW, 'members', 'alice'), fullMember({name: 'Are'}));
    await setDoc(doc(db, 'crews', CREW, 'members', 'bob'), fullMember({name: 'Kari'}));
    await setDoc(doc(db, 'crews', CREW, 'invites', TOKEN), inviteDoc());
    await setDoc(doc(db, 'crews', OTHER), crewDoc({name: 'Other', createdBy: 'dave'}));
    await setDoc(doc(db, 'crews', OTHER, 'members', 'dave'), fullMember({name: 'Dave'}));
    await setDoc(doc(db, 'crews', OTHER, 'invites', TOKEN2), inviteDoc({crewName: 'Other', createdBy: 'dave', createdByName: 'Dave'}));
  });
}
// the join batch exactly as the client writes it
function join(db, uid, crew, token, name = 'Morten'){
  const b = writeBatch(db);
  b.set(doc(db, 'crews', crew, 'members', uid), fullMember({name, ...(token ? {invite: token} : {})}));
  b.update(doc(db, 'users', uid), {crew, updatedAt: serverTimestamp()});
  return b.commit();
}

test('crews: a non-member cannot read the crew, its members, invites or block records; members can', async () => {
  await seedCrew();
  const carol = as('carol');
  await assertFails(getDoc(doc(carol, 'crews', CREW)));
  await assertFails(getDocs(collection(carol, 'crews', CREW, 'members')));
  await assertFails(getDocs(collection(carol, 'crews', CREW, 'invites')));
  await assertFails(getDocs(collection(carol, 'crews', CREW, 'removed')));
  await assertFails(getDocs(collection(carol, 'crews')));
  await assertFails(getDocs(collection(as('bob'), 'crews', CREW, 'removed')));   // only the creator reads block records
  await assertSucceeds(getDoc(doc(as('bob'), 'crews', CREW)));
  await assertSucceeds(getDocs(collection(as('bob'), 'crews', CREW, 'members')));
  await assertSucceeds(getDocs(collection(as('bob'), 'crews', CREW, 'invites')));
  await assertSucceeds(getDocs(collection(as('alice'), 'crews', CREW, 'removed')));
});

test('crews: creating a crew needs the creator member document in the same batch', async () => {
  await admin(db => setDoc(doc(db, 'users', 'carol'), fullUser({name: 'Morten'})));
  const db = as('carol'); const id = 'NewCrewIdAbcdefghijk';
  await assertFails(setDoc(doc(db, 'crews', id), crewDoc({createdBy: 'carol'})));
  const wrong = writeBatch(db);
  wrong.set(doc(db, 'crews', id), crewDoc({createdBy: 'alice'}));
  wrong.set(doc(db, 'crews', id, 'members', 'carol'), fullMember({name: 'Morten'}));
  await assertFails(wrong.commit());
  // the plan, when written, must be a map; a client from before the plan existed writes none and may
  // still create a crew (the rules go live before that client is replaced)
  const notMap = writeBatch(db);
  notMap.set(doc(db, 'crews', id), crewDoc({createdBy: 'carol', picks: 'nope'}));
  notMap.set(doc(db, 'crews', id, 'members', 'carol'), fullMember({name: 'Morten'}));
  await assertFails(notMap.commit());
  const b = writeBatch(db);
  b.set(doc(db, 'crews', id), crewDoc({createdBy: 'carol'}));
  b.set(doc(db, 'crews', id, 'members', 'carol'), fullMember({name: 'Morten'}));
  b.update(doc(db, 'users', 'carol'), {crew: id, updatedAt: serverTimestamp()});
  await assertSucceeds(b.commit());
  const {picks, ...noPlan} = crewDoc({createdBy: 'carol'});
  const old = 'OldClientCrewIdAbcde';
  const legacy = writeBatch(db);
  legacy.set(doc(db, 'crews', old), noPlan);
  legacy.set(doc(db, 'crews', old, 'members', 'carol'), fullMember({name: 'Morten'}));
  await assertSucceeds(legacy.commit());
});

// The crew's plan (CREW-SPEC section 3, "The crew plan"): the picks map on the crew document, which any
// member may add to or take from with a field-level update, one event at a time. It is the crew's, not
// the creator's: a member removes an event someone else added just as they would rename the crew.
test('crews: any member adds to and removes from the plan; a non-member cannot; nothing else rides along', async () => {
  await seedCrew();
  const bob = as('bob'); const ref = doc(bob, 'crews', CREW);
  await assertSucceeds(updateDoc(ref, {'picks.41': 'bob', updatedAt: serverTimestamp()}));
  await assertSucceeds(updateDoc(ref, {'picks.6': 'bob', 'picks.41': deleteField(), updatedAt: serverTimestamp()}));
  await assertSucceeds(updateDoc(doc(as('alice'), 'crews', CREW), {'picks.6': deleteField(), updatedAt: serverTimestamp()}));   // someone else's entry
  await assertFails(updateDoc(doc(as('carol'), 'crews', CREW), {'picks.41': 'carol', updatedAt: serverTimestamp()}));            // not a member
  await assertFails(updateDoc(doc(as('dave'), 'crews', CREW), {'picks.41': 'dave', updatedAt: serverTimestamp()}));              // a member of another crew
  await assertFails(updateDoc(doc(anon(), 'crews', CREW), {'picks.41': 'x', updatedAt: serverTimestamp()}));
  await assertFails(updateDoc(ref, {'picks.41': 'bob'}));                                                                        // no updatedAt
  await assertFails(updateDoc(ref, {'picks.41': 'bob', name: 'Renamed too', updatedAt: serverTimestamp()}));                      // one thing per write
  await assertFails(updateDoc(ref, {'picks.41': 'bob', createdBy: 'bob', updatedAt: serverTimestamp()}));                        // the plan is not a way to the creator's powers
  await assertFails(updateDoc(ref, {picks: 'nope', updatedAt: serverTimestamp()}));                                              // the map replaced by a scalar
  const big = Object.fromEntries(Array.from({length: 301}, (_, i) => ['picks.' + (i + 1), 'bob']));
  await assertFails(updateDoc(ref, {...big, updatedAt: serverTimestamp()}));                                                     // over the cap
  // a crew from before the plan existed has no picks field: the first add creates the map
  await admin(db => updateDoc(doc(db, 'crews', CREW), {picks: deleteField()}));
  await assertSucceeds(updateDoc(ref, {'picks.41': 'bob', updatedAt: serverTimestamp()}));
  // and a closed crew takes no more
  await admin(db => updateDoc(doc(db, 'crews', CREW), {deleted: true}));
  await assertFails(updateDoc(ref, {'picks.12': 'bob', updatedAt: serverTimestamp()}));
});

test('members: joining with a live token works; expired, revoked, foreign, missing or no token fails', async () => {
  await seedCrew();
  await admin(async db => {
    await setDoc(doc(db, 'crews', CREW, 'invites', 'expiredexpiredexpired1'), inviteDoc({expiresAt: Timestamp.fromMillis(Date.now() - 1000)}));
    await setDoc(doc(db, 'crews', CREW, 'invites', 'revokedrevokedrevoked1'), inviteDoc({revoked: true}));
  });
  const db = as('carol');
  await assertFails(join(db, 'carol', CREW, 'expiredexpiredexpired1'));
  await assertFails(join(db, 'carol', CREW, 'revokedrevokedrevoked1'));
  await assertFails(join(db, 'carol', CREW, 'missingmissingmissing1'));
  await assertFails(join(db, 'carol', CREW, TOKEN2));   // the other crew's token
  await assertFails(join(db, 'carol', CREW, null));
  await assertSucceeds(join(db, 'carol', CREW, TOKEN));
  await assertSucceeds(updateDoc(doc(db, 'crews', CREW, 'members', 'carol'), {invite: deleteField(), updatedAt: serverTimestamp()}));
});

test('members: a removed person cannot rejoin until the block record is deleted; a closed crew takes nobody', async () => {
  await seedCrew();
  await admin(db => setDoc(doc(db, 'crews', CREW, 'removed', 'carol'), blockDoc()));
  await assertFails(join(as('carol'), 'carol', CREW, TOKEN));
  await assertSucceeds(deleteDoc(doc(as('alice'), 'crews', CREW, 'removed', 'carol')));   // the creator re-admits
  await assertSucceeds(join(as('carol'), 'carol', CREW, TOKEN));
  await admin(db => updateDoc(doc(db, 'crews', CREW), {deleted: true}));
  await admin(db => setDoc(doc(db, 'users', 'erin'), fullUser({name: 'Erin'})));
  await assertFails(join(as('erin'), 'erin', CREW, TOKEN));
});

test('members: the projection may only carry notes the owner marked shared', async () => {
  await seedCrew();
  const db = as('bob');
  const me = doc(db, 'crews', CREW, 'members', 'bob');
  await assertSucceeds(updateDoc(me, {'notes.6': 'shared note', updatedAt: serverTimestamp()}));
  await assertFails(updateDoc(me, {'notes.7': 'private note', updatedAt: serverTimestamp()}));
  const b = writeBatch(db);   // sharing a new note updates both documents together
  b.update(doc(db, 'users', 'bob'), {'shared.7': true, 'notes.7': 'now shared', updatedAt: serverTimestamp()});
  b.update(me, {'notes.7': 'now shared', updatedAt: serverTimestamp()});
  await assertSucceeds(b.commit());
});

test('members: own document only; joinedAt and invite are fixed, invite may be dropped; leaving works', async () => {
  await seedCrew();
  await admin(db => updateDoc(doc(db, 'crews', CREW, 'members', 'bob'), {invite: TOKEN}));
  const bob = as('bob');
  const me = doc(bob, 'crews', CREW, 'members', 'bob');
  await assertSucceeds(updateDoc(me, {'picks.41': true, name: 'Kari B', updatedAt: serverTimestamp()}));
  await assertFails(updateDoc(me, {joinedAt: serverTimestamp(), updatedAt: serverTimestamp()}));
  await assertFails(updateDoc(me, {invite: 'anotheranotheranother1', updatedAt: serverTimestamp()}));
  await assertSucceeds(updateDoc(me, {invite: deleteField(), updatedAt: serverTimestamp()}));
  await assertFails(updateDoc(doc(bob, 'crews', CREW, 'members', 'alice'), {'picks.41': true, updatedAt: serverTimestamp()}));
  await assertFails(deleteDoc(doc(bob, 'crews', CREW, 'members', 'alice')));
  const b = writeBatch(bob);
  b.delete(me); b.update(doc(bob, 'users', 'bob'), {crew: deleteField(), updatedAt: serverTimestamp()});
  await assertSucceeds(b.commit());
});

test('crews: the creator removes members and hands over; a creator who left has no powers', async () => {
  await seedCrew();
  const alice = as('alice');
  let b = writeBatch(alice);
  b.delete(doc(alice, 'crews', CREW, 'members', 'bob')); b.set(doc(alice, 'crews', CREW, 'removed', 'bob'), blockDoc('Kari'));
  await assertSucceeds(b.commit());
  await assertFails(setDoc(doc(alice, 'crews', CREW, 'removed', 'alice'), blockDoc('Are')));            // not yourself
  await assertFails(setDoc(doc(alice, 'crews', CREW, 'removed', 'carol'), {removedAt: serverTimestamp(), v: 1}));   // name required
  await admin(db => setDoc(doc(db, 'crews', CREW, 'members', 'bob'), fullMember({name: 'Kari'})));
  await assertFails(setDoc(doc(as('bob'), 'crews', CREW, 'removed', 'carol'), blockDoc()));              // members cannot block
  await assertFails(updateDoc(doc(alice, 'crews', CREW), {createdBy: 'carol', updatedAt: serverTimestamp()}));   // not a member
  await assertFails(updateDoc(doc(as('bob'), 'crews', CREW), {createdBy: 'bob', updatedAt: serverTimestamp()}));  // not the creator
  await assertSucceeds(updateDoc(doc(as('bob'), 'crews', CREW), {name: 'Renamed', updatedAt: serverTimestamp()}));   // any member renames
  await assertSucceeds(updateDoc(doc(alice, 'crews', CREW), {createdBy: 'bob', updatedAt: serverTimestamp()}));
  await assertFails(deleteDoc(doc(alice, 'crews', CREW, 'members', 'bob')));   // alice is no longer the creator
  await admin(db => deleteDoc(doc(db, 'crews', CREW, 'members', 'bob')));      // the new creator leaves…
  await assertFails(deleteDoc(doc(as('bob'), 'crews', CREW, 'members', 'alice')));   // …and keeps no powers
});

test('crews: closing tombstones the crew; nothing can be re-created or changed afterwards', async () => {
  await seedCrew();
  const alice = as('alice');
  await assertFails(deleteDoc(doc(alice, 'crews', CREW)));
  await assertFails(updateDoc(doc(as('bob'), 'crews', CREW), {deleted: true, updatedAt: serverTimestamp()}));
  let b = writeBatch(alice);
  b.delete(doc(alice, 'crews', CREW, 'members', 'bob')); b.delete(doc(alice, 'crews', CREW, 'invites', TOKEN));
  await assertSucceeds(b.commit());
  b = writeBatch(alice);
  b.delete(doc(alice, 'crews', CREW, 'members', 'alice'));
  b.update(doc(alice, 'crews', CREW), {deleted: true, updatedAt: serverTimestamp()});
  b.update(doc(alice, 'users', 'alice'), {crew: deleteField(), updatedAt: serverTimestamp()});
  await assertSucceeds(b.commit());
  const carol = as('carol');
  b = writeBatch(carol);
  b.set(doc(carol, 'crews', CREW), crewDoc({createdBy: 'carol'})); b.set(doc(carol, 'crews', CREW, 'members', 'carol'), fullMember({name: 'Morten'}));
  await assertFails(b.commit());   // the id is burned
  await admin(db => setDoc(doc(db, 'crews', CREW, 'members', 'alice'), fullMember({name: 'Are'})));
  await assertFails(updateDoc(doc(alice, 'crews', CREW), {name: 'Back', updatedAt: serverTimestamp()}));
});

test('invites: members mint valid invites; names must match; expiry is bounded; revoke is one-way', async () => {
  await seedCrew();
  const bob = as('bob'); const ref = t => doc(bob, 'crews', CREW, 'invites', t);
  const mine = over => inviteDoc({createdBy: 'bob', createdByName: 'Kari', ...over});
  await assertSucceeds(setDoc(ref('validtokenvalidtoken12'), mine()));
  await assertFails(setDoc(ref('validtokenvalidtoken13'), mine({createdByName: 'Someone else'})));
  await assertFails(setDoc(ref('validtokenvalidtoken14'), mine({crewName: 'Not our name'})));
  await assertFails(setDoc(ref('validtokenvalidtoken15'), mine({expiresAt: Timestamp.fromMillis(Date.now() - 1000)})));
  await assertFails(setDoc(ref('validtokenvalidtoken16'), mine({expiresAt: Timestamp.fromMillis(Date.now() + 31 * 864e5)})));
  await assertFails(setDoc(ref('short'), mine()));
  await assertFails(setDoc(doc(as('carol'), 'crews', CREW, 'invites', 'validtokenvalidtoken17'), inviteDoc({createdBy: 'carol', createdByName: 'Morten'})));
  await assertSucceeds(getDoc(doc(as('carol'), 'crews', CREW, 'invites', TOKEN)));   // anyone signed in who has the token may read it
  await assertFails(getDoc(doc(anon(), 'crews', CREW, 'invites', TOKEN)));
  await assertSucceeds(updateDoc(ref(TOKEN), {revoked: true}));
  await assertFails(updateDoc(ref(TOKEN), {revoked: false}));
  await assertFails(updateDoc(ref(TOKEN), {crewName: 'x'}));
  await assertSucceeds(deleteDoc(ref(TOKEN)));
});

// A block record is the only thing standing between a removed person and the invite link they still hold,
// so it may be created and deleted by the creator and edited by nobody, including the creator.
test('removed: a block record cannot be edited, and only the creator can delete one', async () => {
  await seedCrew();
  await admin(db => setDoc(doc(db, 'crews', CREW, 'removed', 'carol'), blockDoc()));
  const ref = db => doc(db, 'crews', CREW, 'removed', 'carol');
  await assertFails(updateDoc(ref(as('alice')), {name: 'Someone else'}));            // not even the creator
  await assertFails(updateDoc(ref(as('alice')), {removedAt: serverTimestamp()}));
  await assertFails(updateDoc(ref(as('bob')), {name: 'Someone else'}));
  await assertFails(deleteDoc(ref(as('bob'))));                                       // a member is not the creator
  await assertFails(deleteDoc(ref(as('carol'))));                                     // least of all the blocked person
  await assertSucceeds(deleteDoc(ref(as('alice'))));
});

// The three fields the server owns on a create: a crew starts alive, and both stamps are request.time. A
// client that sets its own would be able to back-date an invite window or ship a crew born closed.
test('crews and members: a create cannot pre-set deleted, createdAt or joinedAt', async () => {
  await admin(db => setDoc(doc(db, 'users', 'carol'), fullUser({name: 'Morten'})));
  const db = as('carol'); const id = 'CarolsCrewIdAbcdefg1';
  const create = over => {
    const b = writeBatch(db);
    b.set(doc(db, 'crews', id), crewDoc({createdBy: 'carol', ...over.crew}));
    b.set(doc(db, 'crews', id, 'members', 'carol'), fullMember({name: 'Morten', ...over.member}));
    return b.commit();
  };
  await assertFails(create({crew: {deleted: true}, member: {}}));
  await assertFails(create({crew: {createdAt: Timestamp.fromMillis(Date.now())}, member: {}}));
  await assertFails(create({crew: {}, member: {joinedAt: Timestamp.fromMillis(Date.now())}}));
  await assertSucceeds(create({crew: {}, member: {}}));

  // joining an existing crew is the same rule on the member document alone
  await seedCrew();
  await admin(dba => setDoc(doc(dba, 'users', 'erin'), fullUser({name: 'Erin'})));
  const erin = as('erin');
  const backdated = writeBatch(erin);
  backdated.set(doc(erin, 'crews', CREW, 'members', 'erin'), fullMember({name: 'Erin', invite: TOKEN, joinedAt: Timestamp.fromMillis(Date.now())}));
  backdated.update(doc(erin, 'users', 'erin'), {crew: CREW, updatedAt: serverTimestamp()});
  await assertFails(backdated.commit());
  await assertSucceeds(join(erin, 'erin', CREW, TOKEN, 'Erin'));
});

// The token is the secret and its length is part of it: a 22-character base64url string is 128 bits, and
// nothing shorter is readable by someone who is not already a member.
test('invites: a get with a token of the wrong length is denied whatever it names', async () => {
  await seedCrew();
  await admin(db => setDoc(doc(db, 'crews', CREW, 'invites', 'short'), inviteDoc()));
  await admin(db => setDoc(doc(db, 'crews', CREW, 'invites', 'x'.repeat(23)), inviteDoc()));
  const carol = as('carol');
  await assertFails(getDoc(doc(carol, 'crews', CREW, 'invites', 'short')));
  await assertFails(getDoc(doc(carol, 'crews', CREW, 'invites', 'x'.repeat(23))));
  await assertSucceeds(getDoc(doc(carol, 'crews', CREW, 'invites', TOKEN)));
});

// Nothing outside users/ and crews/ is reachable at all: the catch-all is the last rule and denies both
// ways, so a collection nobody has thought of yet is closed rather than open.
test('the catch-all closes every other path, to everyone', async () => {
  await admin(db => setDoc(doc(db, 'sessions', 'anything'), {v: 1}));
  for (const db of [as('alice'), anon()]) {
    await assertFails(getDoc(doc(db, 'sessions', 'anything')));
    await assertFails(getDocs(collection(db, 'sessions')));
    await assertFails(setDoc(doc(db, 'sessions', 'mine'), {v: 1}));
    await assertFails(deleteDoc(doc(db, 'sessions', 'anything')));
    await assertFails(setDoc(doc(db, 'users', 'alice', 'private', 'x'), {v: 1}));   // not even under a document we own
  }
});

test('members: the shared-notes projection is enforced on create too; the remaining caps and allow-lists hold', async () => {
  await seedCrew();
  await admin(db => updateDoc(doc(db, 'users', 'carol'), {'shared.6': true, 'notes.6': 'shared', 'notes.7': 'private'}));
  const carol = as('carol');
  // joining with a projection that carries a private note is refused; with only the shared note it passes
  let b = writeBatch(carol);
  b.set(doc(carol, 'crews', CREW, 'members', 'carol'), fullMember({name: 'Morten', invite: TOKEN, notes: {6: 'shared', 7: 'private'}}));
  b.update(doc(carol, 'users', 'carol'), {crew: CREW, updatedAt: serverTimestamp()});
  await assertFails(b.commit());
  b = writeBatch(carol);
  b.set(doc(carol, 'crews', CREW, 'members', 'carol'), fullMember({name: 'Morten', invite: TOKEN, notes: {6: 'shared'}}));
  b.update(doc(carol, 'users', 'carol'), {crew: CREW, updatedAt: serverTimestamp()});
  await assertSucceeds(b.commit());
  // creating a crew: the creator's projection obeys the same rule, and the caps and allow-lists hold
  await admin(db => setDoc(doc(db, 'users', 'erin'), fullUser({name: 'Erin', shared: {6: true}, notes: {6: 'shared', 7: 'private'}})));
  const erin = as('erin'); const id = 'ErinsCrewIdAbcdefghi';
  const create = (crewOver, memberOver) => { const w = writeBatch(erin); w.set(doc(erin, 'crews', id), crewDoc({createdBy: 'erin', ...crewOver})); w.set(doc(erin, 'crews', id, 'members', 'erin'), fullMember({name: 'Erin', ...memberOver})); return w.commit(); };
  await assertFails(create({}, {notes: {6: 'shared', 7: 'private'}}));
  await assertFails(create({name: 'x'.repeat(61)}, {}));
  await assertFails(create({extra: true}, {}));
  await assertFails(create({}, {name: 'x'.repeat(41)}));
  await assertFails(create({}, {extra: true}));
  await assertSucceeds(create({}, {notes: {6: 'shared'}}));
  // invites and block records: type and length caps
  await assertFails(setDoc(doc(as('alice'), 'crews', CREW, 'invites', 'validtokenvalidtoken18'), inviteDoc({expiresAt: 'tomorrow'})));
  await assertFails(setDoc(doc(as('alice'), 'crews', CREW, 'invites', 'validtokenvalidtoken19'), inviteDoc({extra: true})));
  await assertFails(setDoc(doc(as('alice'), 'crews', CREW, 'removed', 'carol'), blockDoc('x'.repeat(41))));
  await assertFails(setDoc(doc(as('alice'), 'crews', CREW, 'removed', 'carol'), {...blockDoc(), extra: true}));
});
