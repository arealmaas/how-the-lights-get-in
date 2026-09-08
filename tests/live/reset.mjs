// tests/live/reset.mjs — puts both test accounts back to "no crew" on the live project, so a run always
// starts from a known state and never leaves an orphan crew behind. The owner closes their crew exactly
// as the app does (CREW-SPEC section 3: other members, invites and block records in batches of at most
// nine, then the tombstone batch); a member leaves; a stale pointer to a crew the account can no longer
// read is simply cleared. `npm run test:live:reset`; `npm run test:live` runs it first.
import {doc, getDoc, getDocs, collection, writeBatch, serverTimestamp, deleteField} from 'firebase/firestore';
import {accounts, signIn} from './accounts.mjs';

const {A, B} = accounts();
for (const who of [A, B]) {
  const {user, db} = await signIn(who);
  const id = (await getDoc(doc(db, 'users', user.uid))).data()?.crew;
  if (!id) { console.log(`${who.label} ${who.email}: no crew`); continue; }
  // a member the owner has already closed out may no longer read the crew document: only the pointer is left
  let crew = null;
  try { crew = (await getDoc(doc(db, 'crews', id))).data() || null; } catch (e) { if (e.code !== 'permission-denied') throw e; }
  if (crew && crew.createdBy === user.uid && !crew.deleted) {
    const [ms, inv, rem] = await Promise.all([
      getDocs(collection(db, 'crews', id, 'members')),
      getDocs(collection(db, 'crews', id, 'invites')),
      getDocs(collection(db, 'crews', id, 'removed')),
    ]);
    const refs = [...ms.docs.filter(d => d.id !== user.uid).map(d => d.ref), ...inv.docs.map(d => d.ref), ...rem.docs.map(d => d.ref)];
    for (let i = 0; i < refs.length; i += 9) { const b = writeBatch(db); refs.slice(i, i + 9).forEach(r => b.delete(r)); await b.commit(); }
    const b = writeBatch(db);
    b.delete(doc(db, 'crews', id, 'members', user.uid));
    b.update(doc(db, 'crews', id), {deleted: true, updatedAt: serverTimestamp()});
    b.update(doc(db, 'users', user.uid), {crew: deleteField(), updatedAt: serverTimestamp()});
    await b.commit();
    console.log(`${who.label} ${who.email}: closed crew ${id} (${JSON.stringify(crew.name)}, ${ms.size - 1} other member(s), ${inv.size} invite(s))`);
  } else {
    const b = writeBatch(db);
    b.delete(doc(db, 'crews', id, 'members', user.uid));
    b.update(doc(db, 'users', user.uid), {crew: deleteField(), updatedAt: serverTimestamp()});
    await b.commit();
    console.log(`${who.label} ${who.email}: left crew ${id}${crew ? '' : ' (a stale pointer)'}`);
  }
}
process.exit(0);
