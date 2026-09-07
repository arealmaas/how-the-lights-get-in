# Crew mode, Phase 2: Crews and invites — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any signed-in user can create a crew, invite friends by link, and see who is going where: badges, a Crew filter, "Going" rows, verdict tallies, shared notes, a crew section in My festival, a crew calendar and a crew reading list. Removal sticks, closing is final.

**Architecture:** A crew is `crews/{crewId}` with one member projection per person (`members/{uid}`), invites under `invites/{token}` and block records under `removed/{uid}`; the rules enforce membership, the block list, the tombstone and the "shared notes only" projection (spec sections 3–5). The page gains a `crew` section inside its IIFE that subscribes to the crew, keeps a cache for offline boots, and feeds the overlay; pure summaries live in `scripts/crew-core.js`. Every crew write goes through the batches described in spec section 3.

**Tech Stack:** as Phase 1, plus `crypto.getRandomValues`, the Web Share API, `sessionStorage` for the pending invite.

**Spec:** `CREW-SPEC.md` sections 3, 4, 5, 6 (subscriptions), 7, 10, 11. Phases 0 and 1 must be done first.

## Global Constraints

- Everything from Phase 1's Global Constraints still applies (SDK pin, field-level writes, `esc()`, `data-*` dispatch, British English, commit trailer, no stash).
- Batches exactly as spec section 3: create = crew + member + pointer; join = member (with `invite`) + pointer, then a second write drops `invite`; leave = member delete + pointer; remove = member delete + block record; close = other documents in chunks of at most nine, then own member delete + `deleted: true` + pointer.
- The crew document is never deleted. `crewName` and `createdByName` on an invite must equal the crew's name and the inviter's member name, or the rules reject it.
- Invite tokens: 16 bytes from `crypto.getRandomValues`, base64url, 22 characters; expiry 14 days; links are `PUBLIC_URL + '#join=' + crewId + '.' + token`.
- The pending invite lives in `sessionStorage` key `htlgi-l26-join` for at most one hour; the crew cache in `localStorage` key `htlgi-l26-crew-cache`.
- Member colours come from the strand colour variables in join order: `--debates`, `--talks`, `--music`, `--cinema`, `--inner`, `--kids` (repeating).
- All crew-supplied strings (names, crew name, invite fields, shared notes) go through `esc()` or `paras()` before `innerHTML`.

---

## File structure

| File | Responsibility |
|---|---|
| `scripts/crew-core.js` | Adds `projectForCrew`, `parseJoinHash`, `memberColour`, `pickedBy`, `crewSummary`. |
| `scripts/test/crew-core.test.mjs` | Tests for the above. |
| `firebase/firestore.rules`, `CREW-SPEC.md` | Block records gain a `name` field (rules and spec kept in sync). |
| `firebase/test/rules.test.mjs` | Tests for crews, members, invites and block records. |
| `scripts/template.html` | CSS for badges, member lists, going row, tally, crew notes, share checkbox, split rows; a `// ---------- crew ----------` section replacing Phase 1's no-ops; hooks in `checkHash`, `renderList`, `renderGrid`, `renderChips`, `matches`, `hasFilters`, `showEvent`, `showHub`, `showReadingList`, `readingList`, `calDescription`, `vevent`, `icsFile`, `init`, the click handler and a new `change` handler. |
| `README.md`, `ROADMAP.md`, `CREW-SPEC.md` | Crew section; Batch 5 done; spec status. |

---

### Task 1: `crew-core.js`: projection, join-link parsing, colours, summaries

**Files:**
- Modify: `scripts/crew-core.js`, `scripts/test/crew-core.test.mjs`

**Interfaces:**
- Produces:
  - `CrewCore.projectForCrew(state): {picks, verdicts, notes}` — `notes` keeps only keys present in `state.shared`
  - `CrewCore.parseJoinHash(hash: string): {crew, token} | null`
  - `CrewCore.memberColour(index: number): string` — one of the six strand names
  - `CrewCore.pickedBy(members, myUid, eventNo): member[]` — members other than me who picked it
  - `CrewCore.crewSummary(members, myUid, events): {all, split, onlyMe, onlyThem}` where `members` are `{uid, name, picks: map}` in join order, `all/onlyMe/onlyThem` are event arrays sorted by date and time, and `split` is `[{slot: 'YYYY-MM-DD HH:MM', choices: [{no, names: string[]}]}]`

- [ ] **Step 1: Add the failing tests**

Append to `scripts/test/crew-core.test.mjs`:

```js
test('projectForCrew drops notes that are not shared', () => {
  const p = CrewCore.projectForCrew({picks: {3: true}, verdicts: {6: 'Draw'}, notes: {3: 'private', 6: 'shared one', 7: '  '}, shared: {6: true, 7: true}});
  assert.deepEqual(p, {picks: {3: true}, verdicts: {6: 'Draw'}, notes: {6: 'shared one'}});
  assert.deepEqual(CrewCore.projectForCrew(null), {picks: {}, verdicts: {}, notes: {}});
});

test('parseJoinHash accepts only well-formed links', () => {
  const crew = 'AbCdEfGhIjKlMnOpQrSt', token = 'abcdefghijklmnopqrstu_';
  assert.deepEqual(CrewCore.parseJoinHash(`#join=${crew}.${token}`), {crew, token});
  assert.deepEqual(CrewCore.parseJoinHash(`#event=3&join=${crew}.${token}&x=1`), {crew, token});
  assert.equal(CrewCore.parseJoinHash('#join=short.token'), null);
  assert.equal(CrewCore.parseJoinHash(`#join=${crew}.${token}extra`), null);
  assert.equal(CrewCore.parseJoinHash(''), null);
});

test('crewSummary finds shared events, splits and one-sided picks', () => {
  const events = [
    {eventNo: 1, date: '2026-09-19', time: '10:00'}, {eventNo: 2, date: '2026-09-19', time: '10:00'},
    {eventNo: 3, date: '2026-09-19', time: '11:00'}, {eventNo: 4, date: '2026-09-20', time: '09:00'},
  ];
  const members = [
    {uid: 'me', name: 'Are', picks: {1: true, 3: true}},
    {uid: 'k', name: 'Kari', picks: {2: true, 3: true}},
    {uid: 'm', name: 'Morten', picks: {3: true, 4: true}},
  ];
  const s = CrewCore.crewSummary(members, 'me', events);
  assert.deepEqual(s.all.map(e => e.eventNo), [3]);
  assert.deepEqual(s.split, [{slot: '2026-09-19 10:00', choices: [{no: 1, names: ['Are']}, {no: 2, names: ['Kari']}]}]);
  assert.deepEqual(s.onlyMe.map(e => e.eventNo), [1]);
  assert.deepEqual(s.onlyThem.map(e => e.eventNo), [2, 4]);
  assert.deepEqual(CrewCore.pickedBy(members, 'me', 3).map(m => m.name), ['Kari', 'Morten']);
  assert.deepEqual(CrewCore.crewSummary([members[0]], 'me', events).all, []);
  assert.equal(CrewCore.memberColour(7), 'talks');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test scripts/test/*.test.mjs`
Expected: 3 failures (`projectForCrew is not a function`, …).

- [ ] **Step 3: Implement**

In `scripts/crew-core.js`, before the `return {…}` line, insert:

```js
  // ---- crews ----
  // the crew-visible projection of an account: picks, verdicts, and only the notes marked shared
  function projectForCrew(s){
    const shared = (s && s.shared) || {};
    return {
      picks: {...((s && s.picks) || {})},
      verdicts: {...((s && s.verdicts) || {})},
      notes: Object.fromEntries(Object.entries((s && s.notes) || {}).filter(([no, t]) => shared[no] && typeof t === 'string' && t.trim())),
    };
  }
  // #join=<crewId>.<token>: a 20-character auto-id and a 22-character base64url token
  function parseJoinHash(hash){
    const m = String(hash || '').match(/(?:^#|&)join=([A-Za-z0-9]{20})\.([A-Za-z0-9_-]{22})(?:&|$)/);
    return m ? {crew: m[1], token: m[2]} : null;
  }
  const COLOURS = ['debates', 'talks', 'music', 'cinema', 'inner', 'kids'];   // the strand colours, defined for light and dark
  const memberColour = i => COLOURS[((i % COLOURS.length) + COLOURS.length) % COLOURS.length];
  // members other than me who picked an event
  const pickedBy = (members, myUid, no) => (members || []).filter(m => m.uid !== myUid && m.picks && m.picks[no]);
  // members: [{uid, name, picks}] in join order; events: the programme. Returns event lists for the hub section.
  function crewSummary(members, myUid, events){
    const has = (m, no) => !!(m.picks && m.picks[no]);
    const me = members.find(m => m.uid === myUid) || null;
    const others = members.filter(m => m.uid !== myUid);
    const sorted = [...events].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const all = members.length > 1 ? sorted.filter(e => members.every(m => has(m, e.eventNo))) : [];
    const onlyMe = sorted.filter(e => me && has(me, e.eventNo) && !others.some(m => has(m, e.eventNo)));
    const onlyThem = sorted.filter(e => !(me && has(me, e.eventNo)) && others.some(m => has(m, e.eventNo)));
    const slots = new Map();
    for (const e of sorted) for (const m of members) {
      if (!has(m, e.eventNo)) continue;
      const k = e.date + ' ' + e.time;
      if (!slots.has(k)) slots.set(k, new Map());
      const s = slots.get(k);
      if (!s.has(e.eventNo)) s.set(e.eventNo, []);
      s.get(e.eventNo).push(m.name);
    }
    const split = [...slots].filter(([, s]) => s.size > 1).map(([slot, s]) => ({slot, choices: [...s].map(([no, names]) => ({no, names}))}));
    return {all, split, onlyMe, onlyThem};
  }
```

and make the return line:

```js
  return {b64u, mergeNoteText, encodeNotesParam, decodeNotesParam, picksToMap, mapToPicks, mergeState, projectForCrew, parseJoinHash, memberColour, pickedBy, crewSummary};
```

- [ ] **Step 4: Run the tests**

Run: `node --test scripts/test/*.test.mjs`
Expected: `# fail 0` (twelve tests across both files).

- [ ] **Step 5: Commit**

```bash
python3 scripts/build.py >/dev/null
git add scripts/crew-core.js scripts/test/crew-core.test.mjs index.html sw.js
git commit -m "crew-core: projection, join-link parsing, colours and crew summaries

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Rules: block records carry a name; tests for crews, members, invites, block records

**Files:**
- Modify: `firebase/firestore.rules` (the `match /removed/{uid}` block), `CREW-SPEC.md` (sections 4 and 5)
- Modify: `firebase/test/rules.test.mjs`

- [ ] **Step 1: Let a block record carry the removed person's name (so the creator can re-admit by name)**

In `firebase/firestore.rules`, replace

```
        allow create: if isCreator(crew) && uid != request.auth.uid
          && request.resource.data.keys().hasOnly(['removedAt', 'v'])
          && request.resource.data.removedAt == request.time
```

with

```
        allow create: if isCreator(crew) && uid != request.auth.uid
          && request.resource.data.keys().hasOnly(['name', 'removedAt', 'v'])
          && str(request.resource.data.name, 40)
          && request.resource.data.removedAt == request.time
```

Make the same change in the rules block of `CREW-SPEC.md` section 5, and in section 4 change the line `  removedAt, v` under `crews/{crewId}/removed/{uid}` to `  name, removedAt, v`.

- [ ] **Step 2: Add the tests**

Extend the import line in `firebase/test/rules.test.mjs` to:

```js
import {doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, Timestamp, writeBatch} from 'firebase/firestore';
```

Append the helpers and tests:

```js
// ---- crews ----
const CREW = 'AbCdEfGhIjKlMnOpQrSt', OTHER = 'OtherCrewIdAbcdefghi';
const TOKEN = 'abcdefghijklmnopqrstu_', TOKEN2 = 'ABCDEFGHIJKLMNOPQRSTU-';
const fullMember = (over = {}) => ({name: 'Are', joinedAt: serverTimestamp(), picks: {}, verdicts: {}, notes: {}, updatedAt: serverTimestamp(), v: 1, ...over});
const crewDoc = (over = {}) => ({name: 'The Heath Three', createdBy: 'alice', deleted: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), v: 1, ...over});
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
  const b = writeBatch(db);
  b.set(doc(db, 'crews', id), crewDoc({createdBy: 'carol'}));
  b.set(doc(db, 'crews', id, 'members', 'carol'), fullMember({name: 'Morten'}));
  b.update(doc(db, 'users', 'carol'), {crew: id, updatedAt: serverTimestamp()});
  await assertSucceeds(b.commit());
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
```

- [ ] **Step 3: Run the rules tests**

Run: `cd firebase/test && npm test; cd ../..`
Expected: `# pass 15`, `# fail 0`. A failing case means a rules bug: fix `firebase/firestore.rules`, mirror the change into `CREW-SPEC.md` section 5, rerun.

- [ ] **Step 4: Commit**

```bash
git add firebase/firestore.rules firebase/test/rules.test.mjs CREW-SPEC.md
git commit -m "Rules tests for crews, members, invites and block records; block records carry a name

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Crew state, subscriptions, cache, create, rename, leave, the Crew card

**Files:**
- Modify: `scripts/template.html`: CSS after the account block; delete Phase 1's no-ops in the account section; insert a `// ---------- crew ----------` section right after the account section (before `// ---------- events ----------`); hooks in the click handler and `init`.

**Interfaces:**
- Consumes: from Phase 1: `fb`, `user`, `accountName`, `crewId`, `crew`, `userRef()`, `localState()`, `syncChange()`, `DEL()`, `refreshSheet()`, `authMessage()`, `accountMarker()`, `initials()`, `esc()`.
- Produces: `crew` object `{id, name, createdBy, members: [{uid, name, joinedAt, picks, verdicts, notes}], invites: [...], removed: [{uid, name}], syncedAt, live}`; `subscribeCrew(id)`, `unsubscribeCrew()`, `onCrewPointer()`, `crewGone(msg)`, `onCrewDenied()`, `crewOwnedByMe()`, `others()`, `memberStyle(i)`, `crewCard()`, `createCrew()`, `renameCrew()`, `leaveCrew(silent)`, `liveInvites()`, `inviteLink(token)`, `crewRef(id)`, `memberRef(id, uid)`. Task 4 adds `pendingJoin`, `afterSubscribe`; Task 7 adds `crewSection`.

- [ ] **Step 1: CSS**

After the `.authform .src{margin:0}` line add:

```css
/* ---------- crew ---------- */
.cdot{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--c);color:#fff;font-size:9px;font-weight:700;font-style:normal;letter-spacing:.02em;flex:none}
.cbadges{display:inline-flex;gap:2px;margin-left:4px;vertical-align:middle}
.tile .cbadges{display:flex;margin:0 0 2px}
.members{list-style:none;margin:4px 0 0;padding:0;display:grid;gap:6px}
.members li{display:flex;align-items:center;gap:8px;font-size:13.5px;flex-wrap:wrap}
.members .cname{flex:1;min-width:0}
.members .cpicks{color:var(--ink-3);font-size:12.5px}
.cname-h{font-family:var(--display);font-size:17px}
.btn.small{padding:3px 8px;font-size:12px}
.going{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0;font-size:14px}
.going .lab{font-size:12px;color:var(--ink-3);letter-spacing:.04em;text-transform:uppercase;font-weight:600}
.tally{font-size:13px;color:var(--ink-2);margin:0 0 10px}
.crewnote{border-left:3px solid var(--line-strong);padding:2px 10px;margin:6px 0;font-size:14px}
.crewnote b{display:block;font-size:12.5px;color:var(--ink-3);margin-bottom:2px}
.share{display:flex;gap:8px;align-items:center;font-size:13px;margin:6px 0 0}
.splitrow{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:start}
.splitrow .t{grid-row:1/99}
.hub-more summary{cursor:pointer;font-family:var(--display);font-weight:600;font-size:15px;margin:14px 0 6px}
.chip.crewchip[aria-pressed="true"]{background:var(--talks);border-color:var(--talks);color:#fff}
```

- [ ] **Step 2: Remove Phase 1's no-ops**

In the account section delete these eight lines exactly:

```js
function crewCard(){ return ''; }
function crewSection(){ return ''; }
function onCrewPointer(){}
function unsubscribeCrew(){}
function onCrewDenied(){}
function crewOwnedByMe(){ return false; }
function afterSubscribe(){}
const pendingJoin = () => null;
```

- [ ] **Step 3: The crew section (part one)**

Insert before `// ---------- events ----------`:

```js
// ---------- crew (crews/{id}, its members, invites and block records) ----------
const LS_CREW_CACHE = 'htlgi-l26-crew-cache', SS_JOIN = 'htlgi-l26-join';
let crewUnsubs = [], removedUnsub = null, leaving = false;
const crewRef = id => fb.F.doc(fb.db, 'crews', id);
const memberRef = (id, uid) => fb.F.doc(fb.db, 'crews', id, 'members', uid);
const crewOwnedByMe = () => !!(crew && user && crew.createdBy === user.uid);
const others = () => (crew && user) ? crew.members.filter(m => m.uid !== user.uid) : [];
const memberStyle = i => `--c:var(--${CrewCore.memberColour(i)})`;
const liveInvites = () => crew ? crew.invites.filter(i => !i.revoked && i.expiresAt && i.expiresAt.toMillis() > Date.now()) : [];
const inviteLink = token => PUBLIC_URL + '#join=' + crew.id + '.' + token;
const saveCrewCache = () => save(LS_CREW_CACHE, {id: crew.id, name: crew.name, createdBy: crew.createdBy, members: crew.members, syncedAt: crew.syncedAt});
function crewSection(){ return ''; }   // Task 7 replaces this
function afterSubscribe(){}            // Task 4 replaces this
const pendingJoin = () => null;         // Task 4 replaces this

// Called after every user-document snapshot: the pointer decides whether we listen to a crew.
function onCrewPointer(){
  if (!user || !fb) return;
  if (crewId && (!crew || crew.id !== crewId || !crewUnsubs.length)) subscribeCrew(crewId);
  else if (!crewId && crew) { unsubscribeCrew(); crew = null; localStorage.removeItem(LS_CREW_CACHE); state.crewOnly = false; render(); }
}
function unsubscribeCrew(){ crewUnsubs.forEach(u => u()); crewUnsubs = []; if (removedUnsub) { removedUnsub(); removedUnsub = null; } }
function subscribeCrew(id){
  unsubscribeCrew();
  const {F} = fb;
  const cached = load(LS_CREW_CACHE, null);
  crew = cached && cached.id === id ? {...cached, invites: [], removed: [], live: false} : {id, name: '', createdBy: '', members: [], invites: [], removed: [], syncedAt: null, live: false};
  const opts = {serverTimestamps: 'estimate'};
  crewUnsubs.push(F.onSnapshot(crewRef(id), s => {
    if (!s.exists()) return;
    const d = s.data();
    if (d.deleted) { crewGone('The crew was closed.'); return; }
    crew.name = d.name; crew.createdBy = d.createdBy;
    if (crewOwnedByMe() && !removedUnsub) removedUnsub = F.onSnapshot(F.collection(fb.db, 'crews', id, 'removed'), r => { crew.removed = r.docs.map(x => ({uid: x.id, name: (x.data().name || '')})); refreshSheet(); }, () => {});
    if (!crewOwnedByMe() && removedUnsub) { removedUnsub(); removedUnsub = null; crew.removed = []; }
    saveCrewCache(); refreshSheet();
  }, crewError));
  crewUnsubs.push(F.onSnapshot(F.collection(fb.db, 'crews', id, 'members'), s => {
    const ms = s.docs.map(x => { const d = x.data(opts); return {uid: x.id, name: d.name || '', joinedAt: d.joinedAt ? d.joinedAt.toMillis() : 0, picks: d.picks || {}, verdicts: d.verdicts || {}, notes: d.notes || {}}; }).sort((a, b) => a.joinedAt - b.joinedAt);
    if (!s.metadata.fromCache && !leaving && !ms.some(m => m.uid === user.uid)) { crewGone('You are no longer in this crew.'); return; }
    crew.members = ms; crew.syncedAt = Date.now(); crew.live = !s.metadata.fromCache;
    saveCrewCache(); render(); refreshSheet();
  }, crewError));
  crewUnsubs.push(F.onSnapshot(F.collection(fb.db, 'crews', id, 'invites'), s => { crew.invites = s.docs.map(x => ({token: x.id, ...x.data(opts)})); refreshSheet(); }, () => {}));
}
function crewError(e){ if (e && e.code === 'permission-denied') crewGone('You are no longer in this crew.'); else console.warn('crew', e); }
function onCrewDenied(){ crewGone('You are no longer in this crew.'); }
// Removed, or the crew was closed: drop the overlay, clear the pointer, keep everything of your own.
function crewGone(msg){
  unsubscribeCrew(); crew = null; crewId = null; localStorage.removeItem(LS_CREW_CACHE); state.crewOnly = false;
  syncChange({crew: DEL()}, null);
  showBanner(`<span>${esc(msg)} Your own picks and notes are untouched.</span><button type="button" class="btn" data-dismiss>OK</button>`);
  render(); refreshSheet();
}
function createCrew(){
  const name = (prompt('Name your crew', 'The Heath Three') || '').trim().slice(0, 60);
  if (!name) return;
  const {F} = fb; const id = F.doc(F.collection(fb.db, 'crews')).id;
  const b = F.writeBatch(fb.db);
  b.set(crewRef(id), {name, createdBy: user.uid, deleted: false, createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp(), v: 1});
  b.set(memberRef(id, user.uid), {name: accountName, joinedAt: F.serverTimestamp(), ...CrewCore.projectForCrew(localState()), updatedAt: F.serverTimestamp(), v: 1});
  b.update(userRef(), {crew: id, updatedAt: F.serverTimestamp()});
  b.commit().catch(authMessage);
}
function renameCrew(){
  const name = (prompt('Crew name', crew.name) || '').trim().slice(0, 60);
  if (!name || name === crew.name) return;
  fb.F.updateDoc(crewRef(crew.id), {name, updatedAt: fb.F.serverTimestamp()}).catch(authMessage);
}
async function leaveCrew(silent){
  if (crewOwnedByMe() && others().length) { showBanner('<span>You created this crew: make someone else the owner, or close the crew, before leaving.</span><button type="button" class="btn" data-dismiss>OK</button>'); return false; }
  if (crewOwnedByMe()) return closeCrew(silent);   // alone in the crew: leaving closes it
  if (!silent && !confirm(`Leave ${crew.name}? Your picks and notes stay in your account.`)) return false;
  const {F} = fb; const id = crew.id;
  leaving = true; unsubscribeCrew();
  const b = F.writeBatch(fb.db);
  b.delete(memberRef(id, user.uid)); b.update(userRef(), {crew: F.deleteField(), updatedAt: F.serverTimestamp()});
  try { await b.commit(); } catch (e) { authMessage(e); }
  leaving = false;
  crew = null; crewId = null; localStorage.removeItem(LS_CREW_CACHE); state.crewOnly = false; render(); refreshSheet();
  return true;
}
async function closeCrew(silent){ return false; }   // Task 5 replaces this
function crewCard(){
  if (!CLOUD || !user) return '';
  if (!crew) return `<div class="hub-card crew"><span class="hc-k">Crew</span><span class="hc-d">See who’s going where, where you split, and the notes your friends share. Create a crew and send an invite link, or open the link a friend sent you.</span><div class="actions"><button type="button" class="btn primary" data-crew-create>Create a crew</button></div></div>`;
  const owner = crewOwnedByMe();
  const rows = crew.members.map((m, i) => `<li><i class="cdot" style="${memberStyle(i)}">${esc(initials(m.name))}</i><span class="cname">${esc(m.name)}${m.uid === user.uid ? ' (you)' : ''}${m.uid === crew.createdBy ? ' · owner' : ''}</span><span class="cpicks">${Object.keys(m.picks).length} picks</span>${owner && m.uid !== user.uid ? `<button type="button" class="btn small" data-crew-owner="${esc(m.uid)}">Make owner</button><button type="button" class="btn small" data-crew-remove="${esc(m.uid)}">Remove</button>` : ''}</li>`).join('');
  const inv = liveInvites().map(i => `<li><span class="cname">Invite by ${esc(i.createdByName)} · until ${new Date(i.expiresAt.toMillis()).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}</span><button type="button" class="btn small" data-copy-invite="${esc(inviteLink(i.token))}">Copy</button><button type="button" class="btn small" data-crew-revoke="${esc(i.token)}">Revoke</button></li>`).join('');
  const removed = owner && crew.removed.length ? `<p class="src">Removed: ${crew.removed.map(r => `${esc(r.name || 'someone')} <button type="button" class="linkbtn" data-crew-readmit="${esc(r.uid)}">re-admit</button>`).join(' · ')}</p>` : '';
  const synced = crew.syncedAt ? (crew.live ? 'live' : 'last synced ' + new Date(crew.syncedAt).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})) : 'not synced yet';
  return `<div class="hub-card crew"><span class="hc-k">Crew · ${esc(synced)}</span><b class="cname-h">${esc(crew.name)}</b>
    <ul class="members">${rows}</ul>
    ${inv ? `<ul class="members invites">${inv}</ul>` : ''}${removed}
    <div class="actions"><button type="button" class="btn primary" data-crew-invite>Invite link</button><button type="button" class="btn" data-crew-rename>Rename</button><button type="button" class="btn" data-crew-leave>Leave crew</button>${owner ? '<button type="button" class="btn" data-crew-close>Close crew</button>' : ''}</div></div>`;
}
```

- [ ] **Step 4: Click handler and boot**

In the click handler, next to the `auth*` lines, add:

```js
  if ('crewCreate' in d) { createCrew(); return; }
  if ('crewRename' in d) { renameCrew(); return; }
  if ('crewLeave' in d) { leaveCrew(false); return; }
```

In `init()`, before the `loadFirebase()` line from Phase 1, add:

```js
  if (CLOUD && accountMarker()) { const c = load(LS_CREW_CACHE, null); if (c && c.id) { crew = {...c, invites: [], removed: [], live: false}; crewId = c.id; } }   // overlay before the SDK loads
```

- [ ] **Step 5: Verify**

Run: `python3 scripts/build.py && python3 -m http.server 8123`

- Signed in: My festival → Crew card → *Create a crew* → name it. The card shows the crew name, you as "(you) · owner", "live", and your pick count. Console: `crews/<id>` with `deleted: false`, `members/<uid>` with your picks map, `users/<uid>.crew` set.
- *Rename* changes the name; a second window on the same account sees it.
- Reload offline (DevTools → Offline): the Crew card renders from the cache with "last synced …".
- *Leave crew* while alone: the crew is closed (Task 5 makes this real; for now the stub returns false and nothing happens, which is expected until Task 5).

- [ ] **Step 6: Commit**

```bash
git add scripts/template.html index.html sw.js
git commit -m "Crews: subscription, cache, create, rename, leave, the Crew card

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Invites and joining

**Files:**
- Modify: `scripts/template.html`: crew section; `checkHash`; the account section's `afterSubscribe`; click handler.

**Interfaces:**
- Produces: `newToken()`, `createInvite()`, `shareLink(url)`, `pendingJoin()`, `clearJoin()`, `offerJoin()`, `acceptJoin()`; `afterSubscribe()` now calls `offerJoin()`.

- [ ] **Step 1: Replace the two stubs and add the invite code**

In the crew section delete the lines `function afterSubscribe(){}            // Task 4 replaces this` and `const pendingJoin = () => null;         // Task 4 replaces this`, then append to the crew section:

```js
const newToken = () => { const b = new Uint8Array(16); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
async function createInvite(){
  if (!navigator.onLine) { showBanner('<span>Invite links need a connection.</span><button type="button" class="btn" data-dismiss>OK</button>'); return; }
  const {F} = fb; const token = newToken();
  try {
    await F.setDoc(F.doc(fb.db, 'crews', crew.id, 'invites', token), {crewName: crew.name, createdBy: user.uid, createdByName: accountName, createdAt: F.serverTimestamp(), expiresAt: F.Timestamp.fromMillis(Date.now() + 14 * 864e5), revoked: false, v: 1});
    shareLink(inviteLink(token));
  } catch (e) { authMessage(e); }
}
function shareLink(url){
  if (navigator.share && PHONE) { navigator.share({title: `Join ${crew.name}`, text: `Join my crew “${crew.name}” in the HowTheLightGetsIn planner:`, url}).catch(() => {}); return; }
  showBanner(`<span>Invite link — anyone with it can join until you revoke it:</span><input readonly value="${esc(url)}" aria-label="Invite link"><button type="button" class="btn primary" data-copy-invite="${esc(url)}">Copy</button><button type="button" class="btn" data-dismiss>Close</button>`);
}
// The pending invite survives the redirect sign-in round trip and a reload while creating an account, for an hour.
const pendingJoin = () => { try { const j = JSON.parse(sessionStorage.getItem(SS_JOIN) || 'null'); return j && j.crew && j.token && Date.now() - j.at < 36e5 ? j : null; } catch (e) { return null; } };
const clearJoin = () => sessionStorage.removeItem(SS_JOIN);
function afterSubscribe(){ offerJoin(); }
async function offerJoin(){
  const j = pendingJoin(); if (!j || !CLOUD) return;
  if (!user) { showBanner('<span>You’ve been invited to a crew. Sign in or create an account to join.</span><button type="button" class="btn primary" data-hub>Sign in</button><button type="button" class="btn" data-join-decline>Not now</button>'); return; }
  if (crewId === j.crew) { clearJoin(); showBanner(`<span>You’re already in ${esc(crew ? crew.name : 'this crew')}.</span><button type="button" class="btn" data-dismiss>OK</button>`); return; }
  let inv = null;
  try { const s = await fb.F.getDoc(fb.F.doc(fb.db, 'crews', j.crew, 'invites', j.token)); inv = s.exists() ? s.data() : null; } catch (e) { inv = null; }
  if (!inv || inv.revoked || !inv.expiresAt || inv.expiresAt.toMillis() < Date.now()) { clearJoin(); showBanner('<span>This invite link no longer works; ask for a new one.</span><button type="button" class="btn" data-dismiss>OK</button>'); return; }
  const lead = crewId ? `Leave ${esc(crew ? crew.name : 'your crew')} and join ` : 'Join ';
  const ios = IOS && !STANDALONE ? ' On iPhone, join here in Safari; the installed app picks it up when you sign in there.' : '';
  showBanner(`<span>${lead}<b>${esc(inv.crewName)}</b>? Invited by ${esc(inv.createdByName)}.${ios}</span><button type="button" class="btn primary" data-join-accept>Join</button><button type="button" class="btn" data-join-decline>Not now</button>`);
}
async function acceptJoin(){
  const j = pendingJoin(); if (!j || !user) return;
  if (!navigator.onLine) { showBanner('<span>Joining needs a connection.</span><button type="button" class="btn" data-dismiss>OK</button>'); return; }
  if (crewId) { const left = await leaveCrew(true); if (!left) return; }
  const {F} = fb; const mref = memberRef(j.crew, user.uid);
  const b = F.writeBatch(fb.db);
  b.set(mref, {name: accountName, joinedAt: F.serverTimestamp(), ...CrewCore.projectForCrew(localState()), invite: j.token, updatedAt: F.serverTimestamp(), v: 1});
  b.update(userRef(), {crew: j.crew, updatedAt: F.serverTimestamp()});
  try {
    await b.commit(); clearJoin(); hideBanner();
    F.updateDoc(mref, {invite: F.deleteField(), updatedAt: F.serverTimestamp()}).catch(() => {});   // the token need not stay readable by the crew
  } catch (e) { clearJoin(); showBanner('<span>This invite link no longer works; ask for a new one.</span><button type="button" class="btn" data-dismiss>OK</button>'); }
}
```

- [ ] **Step 2: `checkHash` learns `#join=`**

In `checkHash()`, directly after the `event=` line (`if (ev && byNo.has(+ev[1])) { … }`) add:

```js
  const j = CrewCore.parseJoinHash(location.hash);
  if (j) {
    sessionStorage.setItem(SS_JOIN, JSON.stringify({...j, at: Date.now()}));
    history.replaceState(null, '', location.pathname + location.search);   // the token must not sit in the address bar or history
    if (CLOUD) loadFirebase().then(() => { if (!user) offerJoin(); }).catch(() => {});
    return;
  }
```

(When the session is restored, `afterSignIn` → `afterSubscribe` → `offerJoin` shows the banner; the `if (!user)` branch covers the signed-out case.)

- [ ] **Step 3: Click handler**

Add next to the other crew lines:

```js
  if ('crewInvite' in d) { createInvite(); return; }
  if (d.crewRevoke) { fb.F.updateDoc(fb.F.doc(fb.db, 'crews', crew.id, 'invites', d.crewRevoke), {revoked: true}).catch(authMessage); return; }
  if (d.copyInvite) { try { navigator.clipboard.writeText(d.copyInvite).then(() => { t.textContent = 'Copied'; }, () => {}); } catch (e) {} return; }
  if ('joinAccept' in d) { acceptJoin(); return; }
  if ('joinDecline' in d) { clearJoin(); hideBanner(); return; }
```

- [ ] **Step 4: Verify with two accounts**

Run: `python3 scripts/build.py && python3 -m http.server 8123`

- Account A (owner): *Invite link* → on desktop a banner with the link and *Copy*; the Crew card lists the invite with its expiry.
- Private window, signed out: open the link. The address bar loses the fragment at once; the banner says "You've been invited to a crew. Sign in or create an account to join." Create an account B (email). The banner then says "Join <crew>? Invited by <A>". *Join*: the Crew card shows both members; A's window shows B within a second. Console: B's member document has no `invite` field after a moment.
- Open the same link again as B: "You're already in <crew>".
- A revokes the invite; a third account C opens the link: "This invite link no longer works".
- Reload the tab with a `#join=` link and wait more than an hour (or edit `sessionStorage` `htlgi-l26-join`'s `at`): no banner.

- [ ] **Step 5: Commit**

```bash
git add scripts/template.html index.html sw.js
git commit -m "Invite links: create, share, revoke; join flow with a pending invite

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Remove, re-admit, make owner, close; removal detection

**Files:**
- Modify: `scripts/template.html` (crew section, click handler)

**Interfaces:**
- Produces: `removeMember(uid)`, `readmit(uid)`, `makeOwner(uid)`, `closeCrew(silent)` (replaces the stub).

- [ ] **Step 1: Replace the `closeCrew` stub and add the owner actions**

Delete the line `async function closeCrew(silent){ return false; }   // Task 5 replaces this` and append to the crew section:

```js
function removeMember(uid){
  const m = crew.members.find(x => x.uid === uid); if (!m) return;
  if (!confirm(`Remove ${m.name} from ${crew.name}? Their invite links stop working; you can re-admit them later.`)) return;
  const {F} = fb; const b = F.writeBatch(fb.db);
  b.delete(memberRef(crew.id, uid));
  b.set(F.doc(fb.db, 'crews', crew.id, 'removed', uid), {name: m.name, removedAt: F.serverTimestamp(), v: 1});
  b.commit().catch(authMessage);
}
function readmit(uid){ fb.F.deleteDoc(fb.F.doc(fb.db, 'crews', crew.id, 'removed', uid)).catch(authMessage); }
function makeOwner(uid){
  const m = crew.members.find(x => x.uid === uid); if (!m) return;
  if (!confirm(`Make ${m.name} the owner of ${crew.name}? You stay a member.`)) return;
  fb.F.updateDoc(crewRef(crew.id), {createdBy: uid, updatedAt: fb.F.serverTimestamp()}).catch(authMessage);
}
// Close: other documents in chunks of at most nine (two rule lookups each, twenty allowed per batch),
// then one batch that deletes the own member document, sets the tombstone and clears the pointer.
async function closeCrew(silent){
  if (!silent && !confirm(`Close ${crew.name} for everyone? Members keep their own picks and notes.`)) return false;
  if (!navigator.onLine) { showBanner('<span>Closing a crew needs a connection.</span><button type="button" class="btn" data-dismiss>OK</button>'); return false; }
  const {F} = fb; const id = crew.id;
  const docs = [...others().map(m => memberRef(id, m.uid)), ...crew.invites.map(i => F.doc(fb.db, 'crews', id, 'invites', i.token)), ...crew.removed.map(r => F.doc(fb.db, 'crews', id, 'removed', r.uid))];
  try {
    for (let i = 0; i < docs.length; i += 9) { const b = F.writeBatch(fb.db); docs.slice(i, i + 9).forEach(r => b.delete(r)); await b.commit(); }
    leaving = true; unsubscribeCrew();
    const b = F.writeBatch(fb.db);
    b.delete(memberRef(id, user.uid));
    b.update(crewRef(id), {deleted: true, updatedAt: F.serverTimestamp()});
    b.update(userRef(), {crew: F.deleteField(), updatedAt: F.serverTimestamp()});
    await b.commit();
    crew = null; crewId = null; localStorage.removeItem(LS_CREW_CACHE); state.crewOnly = false; render(); refreshSheet();
    leaving = false; return true;
  } catch (e) { leaving = false; authMessage(e); return false; }
}
```

- [ ] **Step 2: Click handler**

Add:

```js
  if ('crewClose' in d) { closeCrew(false); return; }
  if (d.crewRemove) { removeMember(d.crewRemove); return; }
  if (d.crewReadmit) { readmit(d.crewReadmit); return; }
  if (d.crewOwner) { makeOwner(d.crewOwner); return; }
```

- [ ] **Step 3: Verify with accounts A (owner), B and C**

- A removes B: B's window shows "You are no longer in this crew. Your own picks and notes are untouched." within a second, its Crew card offers *Create a crew*, and B's picks are intact. B opens the old invite link: "This invite link no longer works".
- A's card lists "Removed: Kari re-admit"; *re-admit*, then B opens the link again and joins.
- A → *Make owner* on B: A's card loses *Remove*/*Close crew*; B's gains them. B hands it back.
- A → *Leave crew* with members present: the banner asks A to hand over or close first.
- A → *Close crew*: B's window says "The crew was closed."; console: the crew document has `deleted: true`, no members, no invites. A → *Create a crew* again works with a new id.

- [ ] **Step 4: Commit**

```bash
git add scripts/template.html index.html sw.js
git commit -m "Crews: remove, re-admit, hand over, close; removal detection

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The overlay: badges, Crew filter, Going row, tally, shared notes

**Files:**
- Modify: `scripts/template.html`: `state` defaults, `matches`, `hasFilters`, the `'clear' in d` handler, `renderChips`, `renderList`, `renderGrid`, `showEvent`, crew section, click handler, a new `change` listener.

**Interfaces:**
- Produces: `crewBadges(no): string`, `crewAny(no): boolean`, `crewRow(e): string`; `state.crewOnly`.

- [ ] **Step 1: Filter state**

Change the `state` defaults line to include `crewOnly:false`:

```js
const state = Object.assign({day:'2026-09-19', view:'list', groups:[], venue:'', topic:'', picksOnly:false, crewOnly:false}, load(LS_STATE, {}));
```

In `matches(e)`, after `  if (state.picksOnly && !picks.has(e.eventNo)) return false;` add:

```js
  if (state.crewOnly && !crewAny(e.eventNo)) return false;
```

Change `hasFilters` to:

```js
const hasFilters = () => state.groups.length || state.venue || state.topic || state.picksOnly || state.crewOnly || q;
```

In the click handler's `'clear' in d` line, add `state.crewOnly = false;` after `state.picksOnly = false;`. Add the chip toggle next to the other crew lines:

```js
  if ('crewOnly' in d) { state.crewOnly = !state.crewOnly; render(); return; }
```

- [ ] **Step 2: Badges and the chip**

Append to the crew section:

```js
const crewAny = no => !!(crew && user && CrewCore.pickedBy(crew.members, user.uid, no).length);
function crewBadges(no){
  if (!crew || !user) return '';
  const who = CrewCore.pickedBy(crew.members, user.uid, no);
  return who.length ? `<span class="cbadges">${who.map(m => `<i class="cdot" style="${memberStyle(crew.members.indexOf(m))}" title="${esc(m.name)}">${esc(initials(m.name))}</i>`).join('')}</span>` : '';
}
```

In `renderChips`, after the `let h = …pickchip…` line add:

```js
  if (crew && user) { const n = EVENTS.filter(e => e.date === state.day && crewAny(e.eventNo)).length; h += `<button type="button" class="chip crewchip" data-crew-only aria-pressed="${!!state.crewOnly}">Crew <span>(${n})</span></button>`; }
```

In `renderList`, in the `.ev-head` template, after `${BRIEFINGS[e.eventNo] ? '<span class="brief-badge">Briefing</span>' : ''}` insert `${crewBadges(e.eventNo)}`.

In `renderGrid`, in the tile template, after `${picks.has(e.eventNo) ? '<span class="star">★</span>' : ''}` insert `${crewBadges(e.eventNo)}`.

- [ ] **Step 3: The event sheet**

Append to the crew section:

```js
function crewRow(e){
  if (!crew || !user) return '';
  const no = e.eventNo;
  const going = CrewCore.pickedBy(crew.members, user.uid, no), notYet = others().filter(m => !m.picks[no]);
  const names = ms => ms.map(m => esc(m.name)).join(', ');
  const line = going.length ? `Going: ${names(going)}${notYet.length ? ` · not yet: ${names(notYet)}` : ''}` : (others().length ? 'Nobody in the crew has picked this yet.' : 'You are the only one in the crew so far.');
  const join = going.length && !picks.has(no) ? `<button type="button" class="btn primary" data-pick="${no}">Join them</button>` : '';
  const tally = e.type === 'Debates' ? others().filter(m => m.verdicts[no]).map(m => `${esc(m.name)}: ${esc(m.verdicts[no])}`).join(' · ') : '';
  const notesFrom = others().filter(m => m.notes[no] && String(m.notes[no]).trim()).map(m => `<div class="crewnote"><b>${esc(m.name)}</b>${paras(String(m.notes[no]).slice(0, 20000))}</div>`).join('');
  return `<div class="going"><span class="lab">Crew</span><span>${line}</span>${join}</div>${tally ? `<p class="tally">Crew verdicts — ${tally}</p>` : ''}${notesFrom ? `<h3 class="sub">Crew notes</h3>${notesFrom}` : ''}`;
}
```

In `showEvent`, in the `overview` template, after the closing `</div>` of the `actions` block (the line after `<p class="note">Calendar entries include …</p>`) insert `${crewRow(e)}`; and after the `<textarea class="notes" …></textarea>` line insert:

```js
      ${crew && user ? `<label class="share"><input type="checkbox" data-share="${e.eventNo}"${shared[e.eventNo] ? ' checked' : ''}> Share this note with the crew</label>` : ''}
```

Add the `change` listener after the `input` listener:

```js
document.addEventListener('change', ev => {
  if (!ev.target.matches('input[data-share]')) return;
  const no = +ev.target.dataset.share; flushNote();
  if (ev.target.checked) shared[no] = true; else delete shared[no];
  save(LS_SHARED, shared);
  syncChange({['shared.' + no]: shared[no] ? true : DEL()}, {['notes.' + no]: shared[no] && notes[no] ? notes[no] : DEL()});
});
```

- [ ] **Step 4: Verify with two accounts in one crew**

- B stars an event: A's list shows B's initials badge on that card and in the grid tile; the *Crew* chip count rises; pressing it filters to events anyone else picked, composing with the other filters.
- A opens that event: "Going: Kari · not yet: …" and *Join them*; pressing it stars the event.
- On a debate, B votes: A's sheet shows "Crew verdicts — Kari: …" under A's own buttons.
- B writes a note and ticks *Share this note with the crew*: A's sheet shows "Crew notes" with B's name; B unticks: it disappears. Console: B's member document `notes` holds only the shared note; B's user document holds both notes.
- A note with `<b>hi</b>` shared by B renders as literal text on A's side (escaped).

- [ ] **Step 5: Commit**

```bash
git add scripts/template.html index.html sw.js
git commit -m "Crew overlay: badges, Crew filter, going row, verdict tally, shared notes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: My festival crew section, crew calendar, crew reading list

**Files:**
- Modify: `scripts/template.html`: `calDescription`, `vevent`, `icsFile`, `readingList`, `showReadingList`, the reading export/copy handlers, crew section (`crewSection`), click handler.

**Interfaces:**
- Produces: `crewSection(): string` (replaces the stub), `downloadCrewPicks()`, `rlMode`, `rlSet()`; `icsFile(events, name, prefixFor?)`, `readingList(set = picks)`.

- [ ] **Step 1: Calendar with a "Going:" line**

Replace the whole `calDescription` function with:

```js
function calDescription(e, prefix = ''){
  const lines = prefix ? [prefix, ''] : [];
  lines.push(`${e.type} · ${e.venue} · ${DAYS[e.date]} ${e.time} (London time)`);
  if (whoPlain(e)) lines.push(whoPlain(e));
  lines.push('');
  if (cleanDesc(e.description)) lines.push(cleanDesc(e.description), '');
  const b = BRIEFINGS[e.eventNo];
  if (b) lines.push(`Briefing: ${b.question}`, '');
  lines.push(`Tickets: ${ticketLine(e)}`, `Topics: ${e.topics.join(', ')}`);
  if (e.url) lines.push(`Event page: ${e.url}`);
  lines.push(`Planner: ${PUBLIC_URL}#event=${e.eventNo}`);
  lines.push('', `End time is an estimate (${dur(e)} min) — the festival publishes start times only. From an unofficial planner, not affiliated with HowTheLightGetsIn.`);
  return lines.join('\n');
}
```

Replace the whole `vevent` function with:

```js
function vevent(e, stamp, prefix = ''){
  const {start, end} = eventTimes(e);
  return ['BEGIN:VEVENT', `UID:htlgi-london-2026-${e.id}@arealmaas.github.io`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${icsText(e.title)}`, `LOCATION:${icsText(calLocation(e))}`, 'GEO:51.5712;-0.1676', `DESCRIPTION:${icsText(calDescription(e, prefix))}`,
    e.url ? `URL:${e.url}` : null, `CATEGORIES:${icsText(e.type)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT15M', `DESCRIPTION:${icsText(e.title + ' starts in 15 minutes · ' + e.venue)}`, 'END:VALARM', 'END:VEVENT'].filter(Boolean);
}
```

Replace the whole `icsFile` function with:

```js
function icsFile(events, name, prefixFor = null){
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//arealmaas//HTLGI London 2026 Planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsText(name)}`, 'X-WR-TIMEZONE:Europe/London'];
  events.forEach(e => lines.push(...vevent(e, stamp, prefixFor ? prefixFor(e) : '')));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
```

- [ ] **Step 2: Reading list with a Mine / Crew toggle**

Change the signature of `readingList` from `function readingList(){` to `function readingList(set = picks){` and its first statement from `const evs = EVENTS.filter(e => picks.has(e.eventNo));` to `const evs = EVENTS.filter(e => set.has(e.eventNo));`.

Add before `function showReadingList`:

```js
let rlMode = 'mine';
const rlSet = () => rlMode === 'crew' && crew && user ? new Set([...picks, ...EVENTS.filter(e => crewAny(e.eventNo)).map(e => e.eventNo)]) : picks;
const goingNames = no => crew && user ? crew.members.filter(m => m.picks[no] || (m.uid === user.uid && picks.has(no))).map(m => m.uid === user.uid ? 'you' : m.name) : [];
```

In `showReadingList`, change `const items = readingList();` to `const items = readingList(rlSet());`, and in the `.rl-ev` template change `<div class="t">${DAYS[e.date].slice(0, 3)} ${e.time} · ${esc(e.venue)}</div>` to:

```js
<div class="t">${DAYS[e.date].slice(0, 3)} ${e.time} · ${esc(e.venue)}${rlMode === 'crew' ? ' · ' + esc(goingNames(e.eventNo).join(', ')) : ''}</div>
```

and insert, before `${items.length ? `<div class="actions">…` in the `openSheet` template:

```js
    ${crew && user ? `<div class="tabs"><button type="button" data-rl="mine" aria-pressed="${rlMode === 'mine'}">Mine</button><button type="button" data-rl="crew" aria-pressed="${rlMode === 'crew'}">Crew</button></div>` : ''}
```

In the click handler change the two reading exports to use the current set:

```js
  if ('exportReading' in d) { download('htlgi-london-2026-reading-list.md', readingMarkdown(readingList(rlSet())), 'text/markdown;charset=utf-8'); return; }
  if ('copyReading' in d) { try { navigator.clipboard.writeText(readingMarkdown(readingList(rlSet()))).then(() => { t.textContent = 'Copied'; }, () => {}); } catch (e) {} return; }
```

and add:

```js
  if (d.rl) { rlMode = d.rl; showReadingList(false); return; }
  if ('exportCrew' in d) { downloadCrewPicks(); return; }
```

- [ ] **Step 3: The hub section and the crew calendar**

In the crew section delete `function crewSection(){ return ''; }   // Task 7 replaces this` and append:

```js
function crewSection(){
  if (!crew || !user) return '';
  const s = CrewCore.crewSummary(crew.members, user.uid, EVENTS);
  const list = evs => evs.length ? hubList(evs) : '<p class="src">Nothing here yet.</p>';
  const split = s.split.length ? `<ul class="applist hub-list">${s.split.map(x => { const [date, time] = x.slot.split(' '); return `<li><div class="splitrow"><span class="t">${DAYS[date].slice(0, 3)} ${time}</span>${x.choices.map(c => `<button type="button" data-no="${c.no}"><span class="n">${esc(byNo.get(c.no).title)}</span><span class="v">${esc(c.names.join(', '))}</span></button>`).join('')}</div></li>`; }).join('')}</ul>` : '<p class="src">No slot where you split — either the crew agrees, or nobody has picked yet.</p>';
  const exportBtn = IN_ARTIFACT ? '' : '<button type="button" class="btn" data-export-crew>Crew calendar (.ics)</button>';
  return `<h3 class="sub">All of you · ${s.all.length}</h3>${list(s.all)}
    <h3 class="sub">Where you split · ${s.split.length}</h3>${split}
    <details class="hub-more"><summary>Only you · ${s.onlyMe.length}</summary>${list(s.onlyMe)}</details>
    <details class="hub-more"><summary>Only them · ${s.onlyThem.length}</summary>${list(s.onlyThem)}</details>
    <div class="actions">${exportBtn}<button type="button" class="btn" data-reading>Crew reading list</button></div>`;
}
function downloadCrewPicks(){
  const union = EVENTS.filter(e => picks.has(e.eventNo) || crewAny(e.eventNo));
  if (!union.length) { showBanner('<span>No picks in the crew yet.</span><button type="button" class="btn" data-dismiss>OK</button>'); return; }
  download('htlgi-london-2026-crew.ics', icsFile(union, `HTLGI London 2026 — ${crew.name}`, e => 'Going: ' + goingNames(e.eventNo).join(', ')), 'text/calendar;charset=utf-8');
}
```

- [ ] **Step 4: Verify**

- My festival with two members: "All of you" lists events both picked; "Where you split" shows a slot with two titles and who holds each; the expanders show one-sided picks.
- *Crew calendar (.ics)*: the file opens in a calendar app; each entry's description starts with "Going: you, Kari" (or the names); your own personal export is unchanged.
- Reading list: the Mine / Crew tabs appear only in a crew; Crew mode lists the union and each event's line ends with who is going; *Export (.md)* in Crew mode contains the union.

- [ ] **Step 5: Commit**

```bash
git add scripts/template.html index.html sw.js
git commit -m "My festival crew section, crew calendar and crew reading list

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Docs, the manual matrix, ship

**Files:**
- Modify: `README.md`, `ROADMAP.md`, `CREW-SPEC.md` (status line)

- [ ] **Step 1: README**

Under Features, after the Account bullet from Phase 1, add:

```markdown
- **Crew**: any signed-in user creates a crew (My festival → Crew) and invites friends with a link (multi-use, 14 days, revocable). The crew sees each other's picks as initials badges on cards and grid tiles, a **Crew** filter chip, a "Going: …" row and a *Join them* button in every event, a verdict tally on debates, and the notes each member chose to share. My festival gains *All of you*, *Where you split*, *Only you / only them*, a crew calendar export and a Mine / Crew reading-list toggle. The creator can remove members (removal sticks: the rules block their invite links), hand the crew over, or close it. Spec: `CREW-SPEC.md`.
```

- [ ] **Step 2: ROADMAP and spec status**

In `ROADMAP.md` change the Batch 5 line's 🔨 to ✅ and "in progress" to "done <date>". In `CREW-SPEC.md` change the status line's `revised draft for review` to `implemented <date>; the rules in section 5 are the ones deployed`.

- [ ] **Step 3: Run everything**

```bash
python3 scripts/build.py && node --test scripts/test/*.test.mjs && (cd firebase/test && npm test)
```

Expected: all green. Open `http://localhost:8123/?selftest`: `ok` lines only.

- [ ] **Step 4: The manual matrix (spec section 10) on the live site after merging**

Merge the PR, then with two real accounts on real devices:

- desktop Chrome: Google popup sign-in, create a crew, invite;
- Safari tab on iPhone: open the invite link signed out, Google redirect sign-in, join;
- installed iOS home-screen app: sign in (Google redirect first; if it does not return, email + password), the crew is there;
- Android Chrome: Google redirect sign-in, join;
- airplane mode on one phone: star two events and share a note, reconnect, the other device receives them;
- remove a member and watch their phone drop out; re-admit; hand over; close;
- open the old GitHub Pages address once more: the move page still carries picks across.

Record what the installed iOS app did with Google sign-in in `CREW-SPEC.md` section 2 (keep or drop the "email first in standalone iOS" ordering accordingly).

- [ ] **Step 5: Commit**

```bash
git add README.md ROADMAP.md CREW-SPEC.md
git commit -m "Docs: crew feature, roadmap batch 5 done, spec status

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Freeze on 17 September: after that only reverts ship (spec section 11).
