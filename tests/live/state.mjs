// tests/live/state.mjs — prints what the live project holds for the two test accounts: name, crew pointer,
// and the crew's document, members, plan and invites. Read-only. `npm run test:live:state`.
import {doc, getDoc, getDocs, collection} from 'firebase/firestore';
import {accounts, signIn} from './accounts.mjs';

const {A, B} = accounts();
for (const who of [A, B]) {
  const {user, db} = await signIn(who);
  const u = (await getDoc(doc(db, 'users', user.uid))).data() || {};
  console.log(`${who.label} ${who.email}  uid=${user.uid}  name=${JSON.stringify(u.name)}  picks=${Object.keys(u.picks || {}).length}  crew=${u.crew || '(none)'}`);
  if (!u.crew) continue;
  try {
    const c = (await getDoc(doc(db, 'crews', u.crew))).data() || {};
    const ms = await getDocs(collection(db, 'crews', u.crew, 'members'));
    const inv = await getDocs(collection(db, 'crews', u.crew, 'invites'));
    console.log(`   crew: name=${JSON.stringify(c.name)} deleted=${c.deleted} createdBy=${c.createdBy} plan=${JSON.stringify(c.picks || {})}`);
    console.log(`   members: ${ms.docs.map(d => d.id + ':' + d.data().name).join(', ')}   invites: ${inv.size}`);
  } catch (e) {
    console.log(`   crew ${u.crew}: cannot read it (${e.code}) — a stale pointer; test:live:reset clears it`);
  }
}
process.exit(0);
