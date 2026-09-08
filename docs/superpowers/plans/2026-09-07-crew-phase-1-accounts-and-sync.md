# Crew mode, Phase 1: Accounts and sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sign in with Google or email + password and get the same picks, verdicts and notes on every device, with the planner still local-first and offline-capable.

**Architecture:** Firebase Authentication is the identity; one private Firestore document per account (`users/{uid}`) is the sync layer; `localStorage` stays the boot-time source so the page renders instantly and works offline. Pure logic (merge, map conversion) lives in `scripts/crew-core.js` with Node tests; the page gains an `account` section inside its IIFE; the rules for `users/{uid}` are tested in the emulator. Every change is a field-level batched write, and each snapshot is applied in place with two guards (the note being typed wins; a missing document never wipes local state).

**Tech Stack:** Firebase JS SDK 12.18.0 (modular, from gstatic), Firestore persistent cache, Node 22 tests, Firestore emulator with `@firebase/rules-unit-testing`.

**Spec:** `CREW-SPEC.md` sections 2, 4, 5 (the `users/{uid}` rules), 6, 7 (Account card, privacy paragraph), 10, 11. Phase 0 (`2026-09-07-crew-phase-0-hosting-and-tooling.md`) must be done first: it provides `CrewCore`, the Node and emulator test harnesses, and the new hosting.

## Global Constraints

- `PROJECT_ID` is the Firebase project id from Phase 0; the site is `https://PROJECT_ID.firebaseapp.com/`.
- SDK modules come only from `https://www.gstatic.com/firebasejs/12.18.0/` (`firebase-app.js`, `firebase-auth.js`, `firebase-firestore.js`), loaded with `import()` only when needed (spec section 6). Nobody without a session downloads them.
- The first write to `users/{uid}` is the complete document: `name`, `picks`, `verdicts`, `notes`, `shared`, `updatedAt: serverTimestamp()`, `v: 1`. Every later write is a field-level `updateDoc` that includes `updatedAt: serverTimestamp()`. Never write a whole map after the first write (spec section 6).
- Snapshots are applied only when the document exists. The note being typed is authoritative. Sign-out and delete detach listeners first.
- `localStorage` keys stay as they are (`htlgi-l26-picks`, `-notes`, `-verdicts`, `-state`); new keys are `htlgi-l26-account` (the uid this device syncs with), `htlgi-l26-shared`, and `sessionStorage` `htlgi-l26-redirect`.
- All page code lives inside the IIFE in `scripts/template.html`; buttons are `type="button"` dispatched by the single click handler via `data-*`; every user-supplied string reaching `innerHTML` goes through `esc()`.
- No root-level dependencies; `python3 scripts/build.py` keeps working without `data/firebase.json` (it prints a note and hides the account UI).
- Copy is British English, sentence case; the privacy paragraph in Task 8 is the wording from spec section 7.
- Commit after every task with a message ending in `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; never `git stash`.

---

## File structure

| File | Responsibility |
|---|---|
| `scripts/crew-core.js` | Adds `picksToMap`, `mapToPicks`, `mergeState` (pure, tested). |
| `scripts/test/crew-core.test.mjs` | Tests for the above. |
| `scripts/build.py` | Injects `data/firebase.json` into the page payload as `DATA.firebase`. |
| `data/firebase.json` (new, owner) | Public web config: `apiKey`, `authDomain`, `projectId`, `appId`. |
| `scripts/template.html` | New CSS for the Account card; an `// ---------- account ----------` section (SDK loader, auth, sign-in sequence, subscription, sync writes, sign-out, delete, name, password); hooks in `togglePick`, the verdict handler, `setNote`, the note input handler, `closeSheet`, `showHub`, `init`; privacy copy. |
| `firebase/test/rules.test.mjs` | Tests for the `users/{uid}` rules. |
| `firebase/firestore.rules`, `CREW-SPEC.md` | Only if a test finds a rules bug (keep both in sync). |
| `README.md` | Account section and privacy line. |

---

### Task 1: `crew-core.js`: picks conversion and the account merge

**Files:**
- Modify: `scripts/crew-core.js`
- Modify: `scripts/test/crew-core.test.mjs`

**Interfaces:**
- Produces:
  - `CrewCore.picksToMap(picks: Iterable<number>): {[eventNo]: true}`
  - `CrewCore.mapToPicks(map: object): Set<number>`
  - `CrewCore.mergeState(local, remote): {picks, verdicts, notes, shared, added: number}` where both inputs are `{picks: map, verdicts: map, notes: map, shared: map}` and `added` is the number of picks the local side contributed.

- [ ] **Step 1: Add the failing tests**

Append to `scripts/test/crew-core.test.mjs`:

```js
test('picks convert between a Set and a map', () => {
  assert.deepEqual(CrewCore.picksToMap(new Set([3, 41])), {3: true, 41: true});
  assert.deepEqual([...CrewCore.mapToPicks({3: true, 41: true, abc: true})].sort((a, b) => a - b), [3, 41]);
  assert.deepEqual(CrewCore.picksToMap(['x', 2.5, 7]), {7: true});
});

test('mergeState unions picks, lets local verdicts win and keeps both note texts', () => {
  const local = {picks: {3: true, 6: true}, verdicts: {6: 'Draw'}, notes: {6: 'from phone', 9: 'phone only'}, shared: {}};
  const remote = {picks: {6: true, 41: true}, verdicts: {6: 'Sabine Hossenfelder', 43: 'Draw'}, notes: {6: 'from laptop', 41: 'laptop only'}, shared: {41: true}};
  const m = CrewCore.mergeState(local, remote);
  assert.deepEqual(m.picks, {3: true, 6: true, 41: true});
  assert.deepEqual(m.verdicts, {6: 'Draw', 43: 'Draw'});
  assert.deepEqual(m.notes, {6: 'from phone\n\n---\n\nfrom laptop', 9: 'phone only', 41: 'laptop only'});
  assert.deepEqual(m.shared, {41: true});
  assert.equal(m.added, 1);
  assert.deepEqual(CrewCore.mergeState({}, {}), {picks: {}, verdicts: {}, notes: {}, shared: {}, added: 0});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/test/*.test.mjs`
Expected: 2 failures, `CrewCore.picksToMap is not a function`.

- [ ] **Step 3: Implement**

In `scripts/crew-core.js`, before the line `  return {b64u, mergeNoteText, encodeNotesParam, decodeNotesParam};` insert:

```js
  // ---- account state ----
  // picks are a Set of event numbers in the page and a map {eventNo: true} in Firestore
  const picksToMap = picks => Object.fromEntries([...(picks || [])].filter(n => Number.isInteger(n)).map(n => [n, true]));
  const mapToPicks = map => new Set(Object.keys(map || {}).filter(isEventKey).map(Number));
  // First sync of a device with an account: union of picks, local wins a verdict conflict, both note texts kept.
  // `added` counts the picks this device contributed, for the "Merged N picks" line.
  function mergeState(local, remote){
    const l = local || {}, r = remote || {};
    const picks = {...(r.picks || {}), ...(l.picks || {})};
    const verdicts = {...(r.verdicts || {}), ...(l.verdicts || {})};
    const notes = {...(r.notes || {})};
    for (const [no, mine] of Object.entries(l.notes || {})) { if (mine && mine.trim()) notes[no] = mergeNoteText(mine, notes[no]); }
    const shared = {...(r.shared || {}), ...(l.shared || {})};
    const added = Object.keys(picks).filter(no => !(r.picks || {})[no]).length;
    return {picks, verdicts, notes, shared, added};
  }
```

and change the return line to:

```js
  return {b64u, mergeNoteText, encodeNotesParam, decodeNotesParam, picksToMap, mapToPicks, mergeState};
```

- [ ] **Step 4: Run the tests**

Run: `node --test scripts/test/*.test.mjs`
Expected: `# fail 0` (nine tests across both files).

- [ ] **Step 5: Commit**

```bash
python3 scripts/build.py >/dev/null
git add scripts/crew-core.js scripts/test/crew-core.test.mjs index.html sw.js
git commit -m "crew-core: picks map conversion and the first-sync merge

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Rules tests for `users/{uid}`

**Files:**
- Modify: `firebase/test/rules.test.mjs`
- Modify only if a test fails: `firebase/firestore.rules` and the rules block in `CREW-SPEC.md` section 5

**Interfaces:**
- Consumes: the harness from Phase 0 (`as`, `anon`, `admin`, `fullUser`).

- [ ] **Step 1: Add the tests**

Extend the import line in `firebase/test/rules.test.mjs` to:

```js
import {doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, Timestamp} from 'firebase/firestore';
```

Append:

```js
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
```

- [ ] **Step 2: Run the rules tests**

Run: `cd firebase/test && npm test; cd ../..`
Expected: `# pass 6`, `# fail 0`. If a case fails, the rules are wrong, not the test: fix `firebase/firestore.rules`, copy the change into the rules block of `CREW-SPEC.md` section 5, and rerun.

- [ ] **Step 3: Commit**

```bash
git add firebase/test/rules.test.mjs firebase/firestore.rules CREW-SPEC.md
git commit -m "Rules tests for the private user document

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Build injects `data/firebase.json`; the page knows whether cloud features are on

**Files:**
- Modify: `scripts/build.py` (`page_payload`, `main`)
- Create (owner): `data/firebase.json`
- Modify: `scripts/template.html` (constants after `const EXTRA = …`, currently line 470)

**Interfaces:**
- Produces: `DATA.firebase` (object or absent); page constants `FIREBASE`, `CLOUD`, `SDK`, `STANDALONE`, `IOS`, `PHONE`, `LS_ACCOUNT`, `LS_SHARED`, `SS_REDIRECT`, and `let shared` (map of shared note keys).

- [ ] **Step 1: Owner: save the web config**

Firebase console → Project settings → Your apps → Add app → Web (name it `planner`, no hosting checkbox) → copy the four values into `data/firebase.json`:

```json
{"apiKey": "…", "authDomain": "PROJECT_ID.firebaseapp.com", "projectId": "PROJECT_ID", "appId": "…"}
```

It is public by design; the rules are the security.

- [ ] **Step 2: Inject it in `scripts/build.py`**

Change the signature and body of `page_payload`:

```python
def page_payload(data, briefings, media, extra, inline_images=False, firebase=None):
```

and, just before `    if inline_images:` inside it, add:

```python
    if firebase:
        payload['firebase'] = {k: firebase[k] for k in ('apiKey', 'authDomain', 'projectId', 'appId')}
```

In `main()`, after the `extra = …` line add:

```python
    firebase_path = ROOT / 'data' / 'firebase.json'
    firebase = json.load(open(firebase_path, encoding='utf-8')) if firebase_path.exists() else None
    if not firebase:
        print('note: data/firebase.json not found; the account and crew features are hidden in this build')
```

and change `    html = fill(page_payload(data, briefings, media, extra))` to:

```python
    html = fill(page_payload(data, briefings, media, extra, firebase=firebase))
```

(The artifact build keeps `firebase=None`: the artifact copy has no cloud features.)

- [ ] **Step 3: Page constants**

In `scripts/template.html`, directly after the line `const EXTRA = (DATA.speakersExtra || {});` add:

```js
const LS_ACCOUNT = 'htlgi-l26-account', LS_SHARED = 'htlgi-l26-shared', SS_REDIRECT = 'htlgi-l26-redirect';
const FIREBASE = DATA.firebase || null;
const CLOUD = !IN_ARTIFACT && !!FIREBASE && typeof CrewCore !== 'undefined';   // accounts and crews need the config and the inlined helpers
const SDK = 'https://www.gstatic.com/firebasejs/12.18.0/';
const STANDALONE = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent);
const PHONE = /Mobi|Android|iP(hone|ad|od)/.test(navigator.userAgent);
```

and after the line `let verdicts = load(LS_VERDICTS, {}) || {};` add:

```js
let shared = load(LS_SHARED, {}) || {};   // notes marked "share with crew" (the checkbox arrives in Phase 2; the map is part of the account document from the start)
```

- [ ] **Step 4: Build twice and check both modes**

Run: `mv data/firebase.json /tmp/fb.json && python3 scripts/build.py | grep note; mv /tmp/fb.json data/firebase.json && python3 scripts/build.py >/dev/null && grep -c '"firebase":{"apiKey"' index.html`
Expected: the note line, then `1`.

- [ ] **Step 5: Commit**

```bash
git add scripts/build.py scripts/template.html data/firebase.json index.html sw.js
git commit -m "Inject the public Firebase config into the page; cloud feature flag

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: SDK loader, auth state, Account card, sign-in and sign-up

**Files:**
- Modify: `scripts/template.html`: CSS (after the `/* ---------- notes & verdicts ---------- */` block), a new `// ---------- account ----------` section inserted just before `// ---------- events ----------`, additions to `showHub`, the click handler and `init`.

**Interfaces:**
- Produces (page scope): `fb` (`{A, F, auth, db}` once loaded), `user`, `accountName`, `crewId` (always `null` in this phase), `loadFirebase(): Promise`, `refreshSheet()`, `accountCard(): string`, `authText(e): string`, `authMessage(e)`, `signInGoogle()`, `emailAction(t, d)`, and the no-ops Phase 2 replaces: `crewCard()`, `crewSection()`, `onCrewPointer()`, `unsubscribeCrew()`, `onCrewDenied()`, `crewOwnedByMe()`, `pendingJoin()`, `afterSubscribe()`.
- Consumes: constants from Task 3.

- [ ] **Step 1: CSS**

After the `.verdict button[aria-pressed="true"]{…}` line add:

```css
/* ---------- account ---------- */
.hub-card.account,.hub-card.crew{grid-column:1/-1}
.authform{display:grid;gap:6px;margin-top:4px}
.authform input{border:1px solid var(--line-strong);border-radius:6px;padding:7px 9px;font:inherit;font-size:14px;background:var(--surface);color:var(--ink)}
.authform input:focus{outline:2px solid var(--focus);outline-offset:1px}
.authform .src{margin:0}
```

- [ ] **Step 2: The account section (part one: loading, auth state, the card, sign-in)**

Insert before `// ---------- events ----------`:

```js
// ---------- account (Firebase Authentication + the private user document) ----------
let fb = null, fbLoading = null;          // {A: auth module, F: firestore module, auth, db} once the SDK is loaded
let user = null, accountName = '', crewId = null, crew = null;
let unsubUser = null, deleting = false, syncPaused = false;
const syncStats = {writes: 0, snapshots: 0};   // spec section 10, quota sanity: shown by ?selftest and as window.htlgiSyncStats
window.htlgiSyncStats = syncStats;
const userRef = () => fb.F.doc(fb.db, 'users', user.uid);
const accountMarker = () => load(LS_ACCOUNT, null);   // {uid}: the account this device last synced with
// Phase 2 replaces these; Phase 1 has no crews.
function crewCard(){ return ''; }
function crewSection(){ return ''; }
function onCrewPointer(){}
function unsubscribeCrew(){}
function onCrewDenied(){}
function crewOwnedByMe(){ return false; }
function afterSubscribe(){}
const pendingJoin = () => null;

function loadFirebase(){
  if (!CLOUD) return Promise.reject(new Error('cloud features are off'));
  if (fbLoading) return fbLoading;
  fbLoading = Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]).then(([app, A, F]) => {
    const inst = app.initializeApp(FIREBASE);
    const db = F.initializeFirestore(inst, {localCache: F.persistentLocalCache({tabManager: F.persistentMultipleTabManager()})});
    fb = {A, F, auth: A.getAuth(inst), db};
    A.onAuthStateChanged(fb.auth, onAuth);
    if (sessionStorage.getItem(SS_REDIRECT)) { sessionStorage.removeItem(SS_REDIRECT); A.getRedirectResult(fb.auth).catch(e => authMessage(e)); }
    return fb;
  }).catch(e => {
    fbLoading = null;
    showBanner(`<span>Sign-in is unavailable right now (${esc(e.message)}). Your picks stay on this device.</span><button type="button" class="btn" data-dismiss>OK</button>`);
    throw e;
  });
  return fbLoading;
}
function onAuth(u){
  const was = user; user = u;
  if (u) { accountName = (u.displayName || accountName || 'Me').slice(0, 40); afterSignIn(u).catch(e => authMessage(e)); }
  else { if (unsubUser) { unsubUser(); unsubUser = null; } accountName = ''; }
  if (was !== u) refreshSheet();
}
// Re-render whatever sheet is open without pushing it again; never while someone is typing in it.
function refreshSheet(){
  const top = sheetStack[sheetStack.length - 1]; if (!top) return;
  if (document.activeElement && document.activeElement.matches('input, textarea')) return;
  if (top.kind === 'event') showEvent(top.no, false); else if (top.kind === 'speaker') showSpeaker(top.key, false); else if (top.kind === 'act') showAct(top.key, false);
  else if (top.kind === 'reading') showReadingList(false); else if (top.kind === 'stats') showStats(false); else if (top.kind === 'hub') showHub(false);
}
function accountCard(){
  if (!CLOUD) return '';
  if (!user) {
    const google = `<button type="button" class="btn primary" data-auth-google>Continue with Google</button>`;
    const email = `<button type="button" class="btn" data-auth-email>Use email and password</button>`;
    return `<div class="hub-card account"><span class="hc-k">Account</span><span class="hc-d">Keep your picks, verdicts and notes on every device, and join a crew.</span>
      <div class="actions">${STANDALONE && IOS ? email + google : google + email}</div>
      ${STANDALONE && IOS ? '<span class="hc-d">In the installed app, email and password is the reliable way in.</span>' : ''}
      <form class="authform" data-auth-form hidden>
        <input type="email" name="email" placeholder="Email" autocomplete="email" required>
        <input type="password" name="password" placeholder="Password (8 or more characters)" autocomplete="current-password" minlength="8">
        <input type="text" name="name" placeholder="Your name (for a new account)" maxlength="40" autocomplete="name">
        <div class="actions"><button type="button" class="btn primary" data-auth-signin>Sign in</button><button type="button" class="btn" data-auth-create>Create account</button><button type="button" class="btn" data-auth-reset>Forgot password?</button></div>
        <p class="src" data-auth-msg></p>
      </form></div>`;
  }
  const hasPw = user.providerData.some(p => p.providerId === 'password');
  return `<div class="hub-card account"><span class="hc-k">Account</span><span class="hc-d">Signed in as <b>${esc(accountName)}</b>${user.email ? ` · ${esc(user.email)}` : ''}. Your picks, verdicts and notes follow this account.</span>
    <div class="actions"><button type="button" class="btn" data-auth-name>Change name</button>${hasPw ? '' : '<button type="button" class="btn" data-auth-addpw>Add a password</button>'}<button type="button" class="btn" data-auth-signout>Sign out</button><button type="button" class="btn" data-auth-clear>Sign out and clear this device</button><button type="button" class="btn" data-auth-delete>Delete account</button></div>
    <form class="authform" data-auth-form hidden><input type="email" name="email" value="${esc(user.email || '')}" placeholder="Email" autocomplete="email"><input type="password" name="password" placeholder="New password (8 or more characters)" autocomplete="new-password" minlength="8"><div class="actions"><button type="button" class="btn primary" data-auth-link>Save password</button></div><p class="src" data-auth-msg></p></form></div>`;
}
async function signInGoogle(){
  try {
    const {A, auth} = await loadFirebase();
    const provider = new A.GoogleAuthProvider();
    if (PHONE || STANDALONE) { sessionStorage.setItem(SS_REDIRECT, '1'); await A.signInWithRedirect(auth, provider); }
    else await A.signInWithPopup(auth, provider);
  } catch (e) { authMessage(e); }
}
async function emailAction(t, d){
  const form = t.closest('[data-auth-form]');
  const email = form.email.value.trim(), password = form.password.value, name = (form.name ? form.name.value.trim() : '').slice(0, 40);
  const msg = s => { form.querySelector('[data-auth-msg]').textContent = s; };
  try {
    const {A, auth} = await loadFirebase();
    if ('authReset' in d) { if (!email) return msg('Enter your email first.'); await A.sendPasswordResetEmail(auth, email); return msg('Password reset email sent. Check your inbox.'); }
    if (!email || password.length < 8) return msg('Enter your email and a password of 8 or more characters.');
    if ('authSignin' in d) { await A.signInWithEmailAndPassword(auth, email, password); return; }
    if ('authCreate' in d) { if (name) accountName = name; const cred = await A.createUserWithEmailAndPassword(auth, email, password); if (name) await A.updateProfile(cred.user, {displayName: name}); return; }
    if ('authLink' in d) { await A.linkWithCredential(auth.currentUser, A.EmailAuthProvider.credential(email, password)); msg('Password added: you can now sign in with email and password too.'); refreshSheet(); return; }
  } catch (e) { msg(authText(e)); }
}
function authText(e){
  const c = (e && e.code) || '';
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found') return 'Wrong email or password. New here? Use “Create account”.';
  if (c === 'auth/email-already-in-use') return 'That email already has an account. Sign in with Google, then add a password from the Account card.';
  if (c === 'auth/weak-password') return 'Use a longer password (8 or more characters).';
  if (c === 'auth/popup-blocked') return 'The sign-in window was blocked. Allow pop-ups for this site, or use email and password.';
  if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return 'Sign-in was cancelled.';
  if (c === 'auth/network-request-failed') return 'No connection. Try again when you are online.';
  if (c === 'auth/requires-recent-login') return 'Please sign in again first.';
  if (c === 'auth/invalid-email') return 'That does not look like an email address.';
  return (e && e.message) || 'Something went wrong.';
}
function authMessage(e){ showBanner(`<span>${esc(authText(e))}</span><button type="button" class="btn" data-dismiss>OK</button>`); }
```

- [ ] **Step 3: A temporary `afterSignIn` so the card works before Task 5**

Directly after `authMessage`, add (Task 5 replaces this function):

```js
async function afterSignIn(u){ afterSubscribe(); }
```

- [ ] **Step 4: Hook the hub, the click handler and boot**

In `showHub`, change the `openSheet(` call's template so that after `${cards}${days}` it reads:

```js
    ${cards}${days}
    ${CLOUD ? `<h3 class="sub">Account${crew ? ' and crew' : ''}</h3><div class="hub-cards">${accountCard()}${crewCard()}</div>${crewSection()}` : ''}
```

In the same function, in the `hub-empty` block, after `everything is saved in this browser.</span>` insert:

```js
${CLOUD && !user ? '<span>Sign in (below) to keep your picks on every device.</span>' : ''}
```

In the click handler, before the line `  if ('hub' in d || 'share' in d) { showHub(); return; }` add:

```js
  if ('authGoogle' in d) { signInGoogle(); return; }
  if ('authEmail' in d) { const f = t.closest('.hub-card').querySelector('[data-auth-form]'); f.hidden = !f.hidden; if (!f.hidden) f.querySelector('input').focus(); return; }
  if ('authSignin' in d || 'authCreate' in d || 'authReset' in d || 'authLink' in d) { emailAction(t, d); return; }
  if ('authAddpw' in d) { const f = t.closest('.hub-card').querySelector('[data-auth-form]'); f.hidden = false; f.querySelector('input[name=password]').focus(); return; }
```

In `init()`, before `  render();` add:

```js
  if (CLOUD && (accountMarker() || sessionStorage.getItem(SS_REDIRECT) || pendingJoin())) loadFirebase().catch(() => {});
```

- [ ] **Step 5: Build and try it**

Run: `python3 scripts/build.py && python3 -m http.server 8123` and open `http://localhost:8123/` (a server, not `file://`, because the SDK loads as ES modules and `localhost` is an authorized domain).

Check:
- Network tab: no `gstatic.com/firebasejs` request on load.
- My festival → Account card → *Continue with Google*: a popup; after it closes the card says "Signed in as …" with your Google name and email.
- *Sign out* is not wired yet (Task 7); reload the page instead: the SDK loads on boot only once Task 5 records the account marker, so for now the card shows signed-out again. That is expected at this point.
- *Use email and password* → *Create account* with a throwaway address, 8+ character password and a name: the card shows "Signed in as <name>". In another private window, *Sign in* with the same details works; a wrong password shows "Wrong email or password…"; *Forgot password?* sends the email.

- [ ] **Step 6: Commit**

```bash
git add scripts/template.html index.html sw.js
git commit -m "Account card: lazy Firebase loader, Google and email sign-in

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The sign-in sequence, the user-document subscription and in-place apply

**Files:**
- Modify: `scripts/template.html` (account section; the note input handler near `document.addEventListener('input', …)`; `closeSheet`)

**Interfaces:**
- Produces: `localState(): {picks, verdicts, notes, shared}` (maps), `afterSignIn(u)`, `subscribeUser()`, `applyUserData(d)`, `stopSync(msg)`, `flushNote()`, `pendingNote`.
- Consumes: `CrewCore.mergeState`, `picksToMap`, `mapToPicks`.

- [ ] **Step 1: Replace the temporary `afterSignIn` with the real sequence**

Replace `async function afterSignIn(u){ afterSubscribe(); }` with:

```js
const localState = () => ({picks: CrewCore.picksToMap(picks), verdicts: {...verdicts}, notes: {...notes}, shared: {...shared}});
// Spec section 6, "Signing in": create from local, merge once per device and account, or replace when the device
// belonged to a different account; only then subscribe.
async function afterSignIn(u){
  const marker = accountMarker();
  if (marker && marker.uid === u.uid) { subscribeUser(); afterSubscribe(); return; }
  const {F} = fb; const ref = userRef();
  let snap;
  try { snap = await F.getDocFromServer(ref); }
  catch (e) { showBanner('<span>Signing in for the first time on this device needs a connection. Try again when you are online.</span><button type="button" class="btn" data-dismiss>OK</button>'); return; }
  const local = localState();
  if (!snap.exists()) {
    await F.setDoc(ref, {name: accountName, ...local, updatedAt: F.serverTimestamp(), v: 1});
  } else if (!marker) {
    const remote = snap.data();
    const m = CrewCore.mergeState(local, remote);
    accountName = (remote.name || accountName).slice(0, 40);
    await F.setDoc(ref, {name: accountName, ...(remote.crew ? {crew: remote.crew} : {}), picks: m.picks, verdicts: m.verdicts, notes: m.notes, shared: m.shared, updatedAt: F.serverTimestamp(), v: 1});
    if (m.added) showBanner(`<span>Merged <b>${m.added} pick${m.added === 1 ? '' : 's'}</b> from this device into your account.</span><button type="button" class="btn" data-dismiss>OK</button>`);
  }
  // otherwise this device synced with a different account before: the first snapshot replaces local state
  save(LS_ACCOUNT, {uid: u.uid});
  subscribeUser();
  afterSubscribe();
}
function subscribeUser(){
  if (unsubUser) unsubUser();
  unsubUser = fb.F.onSnapshot(userRef(), snap => {
    syncStats.snapshots++;
    if (!snap.exists()) { if (!deleting) stopSync('Your account was deleted on another device. This device keeps its local copy.'); return; }
    applyUserData(snap.data());
  }, err => syncError(err));
}
function stopSync(msg){
  if (unsubUser) { unsubUser(); unsubUser = null; }
  localStorage.removeItem(LS_ACCOUNT);
  if (msg) showBanner(`<span>${esc(msg)}</span><button type="button" class="btn" data-dismiss>OK</button>`);
}
const sameState = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Apply a snapshot in place. Two guards: the note being typed wins, and nothing is rebuilt under a focused textarea.
function applyUserData(d){
  flushNote();
  const focused = document.activeElement && document.activeElement.matches('textarea[data-note]') ? +document.activeElement.dataset.note : null;
  const nextPicks = new Set([...CrewCore.mapToPicks(d.picks)].filter(n => byNo.has(n)));
  const nextVerdicts = Object.fromEntries(Object.entries(d.verdicts || {}).filter(([k, v]) => byNo.has(+k) && typeof v === 'string'));
  const nextNotes = Object.fromEntries(Object.entries(d.notes || {}).filter(([k, v]) => byNo.has(+k) && typeof v === 'string' && v.trim()));
  if (focused != null) { if (notes[focused] && notes[focused].trim()) nextNotes[focused] = notes[focused]; else delete nextNotes[focused]; }
  const nextShared = Object.fromEntries(Object.entries(d.shared || {}).filter(([k]) => byNo.has(+k)));
  accountName = (d.name || accountName).slice(0, 40);
  const nextCrew = typeof d.crew === 'string' ? d.crew : null;
  const changed = !sameState([[...picks].sort(), verdicts, notes, shared, crewId], [[...nextPicks].sort(), nextVerdicts, nextNotes, nextShared, nextCrew]);
  picks = nextPicks; verdicts = nextVerdicts; notes = nextNotes; shared = nextShared; crewId = nextCrew;
  save(LS_PICKS, [...picks]); save(LS_VERDICTS, verdicts); save(LS_NOTES, notes); save(LS_SHARED, shared);
  onCrewPointer();
  if (!changed) return;
  render();
  if (focused == null) refreshSheet();
}
function syncError(e){
  const code = (e && e.code) || '';
  if (code === 'resource-exhausted') {
    if (!syncPaused) { syncPaused = true; showBanner('<span>Sync is paused until tomorrow: the free daily limit is used up. Your planner keeps working on this device.</span><button type="button" class="btn" data-dismiss>OK</button>'); }
    return;
  }
  if (code === 'permission-denied' && crewId) { onCrewDenied(); return; }
  console.warn('sync', e);
}
```

- [ ] **Step 2: The pending note and its flush**

Replace the note input listener

```js
document.addEventListener('input', ev => {
  if (!ev.target.matches('textarea[data-note]')) return;
  const no = +ev.target.dataset.note, text = ev.target.value;
  clearTimeout(noteTimer); noteTimer = setTimeout(() => setNote(no, text), 250);
});
```

with:

```js
let pendingNote = null;
function flushNote(){ if (!pendingNote) return; clearTimeout(noteTimer); const {no, text} = pendingNote; pendingNote = null; setNote(no, text); }
document.addEventListener('input', ev => {
  if (!ev.target.matches('textarea[data-note]')) return;
  pendingNote = {no: +ev.target.dataset.note, text: ev.target.value};
  clearTimeout(noteTimer); noteTimer = setTimeout(flushNote, 250);
});
```

In `closeSheet()`, make the first line `  flushNote();` (before `sheetStack = [];`).

- [ ] **Step 3: Build and verify the sequence**

Run: `python3 scripts/build.py && python3 -m http.server 8123`

1. In a fresh private window, star three events and write a note on one. Open My festival → sign in with a new email account. Firebase console → Firestore: `users/<uid>` exists with `picks` as a map of three keys, the note, `shared: {}`, `v: 1`.
2. In a second private window (no local state), sign in with the same account: the three stars and the note appear without a reload (the snapshot). Reload: the SDK loads on boot (marker present) and the state is still there.
3. In the second window, star a fourth event *before* signing out, close it, then sign in again in a third window that already has two different local picks: the banner says "Merged 2 picks…" and the console document has six keys.
4. In the first window, open the noted event, put the cursor in the notes box and type; in the second window change the same note. The first window's box keeps what you are typing (guard 1); when you click elsewhere and reopen the event you see your text, and the other window shows your text after its next snapshot.

- [ ] **Step 4: Commit**

```bash
git add scripts/template.html index.html sw.js
git commit -m "Sign-in sequence, user document subscription, in-place snapshot apply

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Field-level sync writes from picks, verdicts and notes

**Files:**
- Modify: `scripts/template.html`: `togglePick`, the `d.verdict` branch of the click handler, `setNote`, and the account section.

**Interfaces:**
- Produces: `syncChange(userFields: object, memberFields: object|null)`, `DEL(): FieldValue|null`; `syncStats.writes` counts committed batches.

- [ ] **Step 1: The batch writer**

Add to the account section (after `syncError`):

```js
// One batch per change: the user document, plus (while in a crew, Phase 2) the member projection.
const DEL = () => fb ? fb.F.deleteField() : null;
function syncChange(userFields, memberFields){
  if (!fb || !user || !accountMarker()) return;          // signed out, or sync stopped: local only
  const {F} = fb; const b = F.writeBatch(fb.db);
  b.update(userRef(), {...userFields, updatedAt: F.serverTimestamp()});
  if (crewId && memberFields) b.update(F.doc(fb.db, 'crews', crewId, 'members', user.uid), {...memberFields, updatedAt: F.serverTimestamp()});
  syncStats.writes++;
  b.commit().catch(syncError);
}
```

- [ ] **Step 2: Hook the three mutation points**

In `togglePick`, after `save(LS_PICKS, [...picks]);` add:

```js
  syncChange({['picks.' + no]: picks.has(no) ? true : DEL()}, {['picks.' + no]: picks.has(no) ? true : DEL()});
```

In the click handler's `if (d.verdict) { … }` line, after `save(LS_VERDICTS, verdicts);` insert:

```js
syncChange({['verdicts.' + no]: verdicts[no] || DEL()}, {['verdicts.' + no]: verdicts[no] || DEL()});
```

In `setNote`, after `save(LS_NOTES, notes); notesDirty = true;` add:

```js
  syncChange({['notes.' + no]: notes[no] || DEL()}, shared[no] ? {['notes.' + no]: notes[no] || DEL()} : null);
```

- [ ] **Step 3: Verify two devices converge, including offline**

Run: `python3 scripts/build.py && python3 -m http.server 8123`

- Two windows signed in as the same account: star in one, it appears in the other within a second; un-star; vote a verdict; type a note.
- DevTools → Network → Offline in window A: star two events, write a note; back online: window B receives all three (queued writes). Meanwhile star a different event in B while A was offline: after reconnect both windows show all picks (field-level updates merge; nothing was overwritten).
- Console → Firestore: the document has `updatedAt` refreshed and no whole-map rewrites (`picks` still holds only the expected keys).

- [ ] **Step 4: Commit**

```bash
git add scripts/template.html index.html sw.js
git commit -m "Sync picks, verdicts and notes with field-level batched writes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Sign out, clear device, change name, add a password, delete account

**Files:**
- Modify: `scripts/template.html` (account section, click handler)

**Interfaces:**
- Produces: `signOutUser(clearDevice: boolean)`, `changeName()`, `deleteAccount()`, `reauth()`.

- [ ] **Step 1: The functions**

Add to the account section:

```js
async function signOutUser(clearDevice){
  if (unsubUser) { unsubUser(); unsubUser = null; }
  unsubscribeCrew();
  localStorage.removeItem(LS_ACCOUNT);
  try { await fb.A.signOut(fb.auth); } catch (e) {}
  if (clearDevice) {
    Object.keys(localStorage).filter(k => k.startsWith('htlgi-l26-')).forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();
    try { await fb.F.terminate(fb.db); await fb.F.clearIndexedDbPersistence(fb.db); } catch (e) {}
    location.reload(); return;
  }
  crewId = null; crew = null; onCrewPointer(); refreshSheet();
}
async function changeName(){
  const name = (prompt('Your name, as your crew sees it', accountName) || '').trim().slice(0, 40);
  if (!name || name === accountName) return;
  accountName = name;
  try { await fb.A.updateProfile(user, {displayName: name}); } catch (e) {}
  syncChange({name}, {name});
  refreshSheet();
}
async function reauth(){
  const {A} = fb;
  if (user.providerData.some(p => p.providerId === 'google.com')) { await A.reauthenticateWithPopup(user, new A.GoogleAuthProvider()); return; }
  const pw = prompt('Confirm your password to continue'); if (!pw) throw new Error('Cancelled.');
  await A.reauthenticateWithCredential(user, A.EmailAuthProvider.credential(user.email, pw));
}
async function deleteAccount(){
  if (crewId && crewOwnedByMe()) { showBanner('<span>You created your crew: hand it over or close it before deleting your account.</span><button type="button" class="btn" data-dismiss>OK</button>'); return; }
  if (!confirm('Delete your account and everything stored in it? Picks and notes stay on this device only.')) return;
  if (!confirm('This cannot be undone. Delete the account?')) return;
  const {A, F} = fb;
  deleting = true;
  if (unsubUser) { unsubUser(); unsubUser = null; }
  unsubscribeCrew();
  try {
    const b = F.writeBatch(fb.db);
    if (crewId) b.delete(F.doc(fb.db, 'crews', crewId, 'members', user.uid));
    b.delete(userRef());
    await b.commit();
    try { await A.deleteUser(user); }
    catch (e) { if (e.code !== 'auth/requires-recent-login') throw e; await reauth(); await A.deleteUser(user); }
    localStorage.removeItem(LS_ACCOUNT); crewId = null; crew = null; onCrewPointer();
    showBanner('<span>Account deleted. This device keeps its local copy of your picks and notes.</span><button type="button" class="btn" data-dismiss>OK</button>');
  } catch (e) { authMessage(e); }
  deleting = false;
}
```

- [ ] **Step 2: Wire the buttons**

In the click handler, next to the other `auth*` lines, add:

```js
  if ('authName' in d) { changeName(); return; }
  if ('authSignout' in d) { signOutUser(false); return; }
  if ('authClear' in d) { if (confirm('Sign out and remove all picks, notes and crew data from this device?')) signOutUser(true); return; }
  if ('authDelete' in d) { deleteAccount(); return; }
```

- [ ] **Step 3: Verify**

Run: `python3 scripts/build.py && python3 -m http.server 8123`

- *Change name* → the card and (in the console) `users/<uid>.name` update.
- Google account → *Add a password* → save: sign out, sign in with email + that password: same account, same picks.
- *Sign out*: picks remain on the device; the Account card is signed out; reload does not load the SDK (no gstatic request).
- *Sign out and clear this device*: after the reload the planner is empty and signed out.
- *Delete account* on a throwaway email account: both confirmations, the console shows the user document gone and the Authentication user gone; the device keeps its picks. With a Google account that signed in more than a few minutes ago, the re-authentication popup appears first.

- [ ] **Step 4: Commit**

```bash
git add scripts/template.html index.html sw.js
git commit -m "Account card: sign out, clear device, change name, add password, delete account

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Privacy copy, README, `?selftest`

**Files:**
- Modify: `scripts/template.html` (footer copy near `<div class="noprint">Ticketing: …`, the "Saved in this browser only" line in `showEvent`, the account section)
- Modify: `README.md`

- [ ] **Step 1: Copy in the page**

In the footer `<div class="noprint">Ticketing: …` paragraph, replace the sentence `Picks, notes and debate verdicts are saved in this browser.` with `Picks, notes and debate verdicts are saved in this browser, or in your account if you sign in.`

After that `</div>` add:

```html
  <div class="noprint" id="privacy">If you sign in, your email address, name, picks, debate verdicts, notes and crew are stored in Firebase (Google), in the EU. Only you can read them; people in your crew see your picks, verdicts and the notes you choose to share. The site sets no cookies and has no analytics; Google sign-in opens Google’s pages, which do. “Delete account” in My festival removes everything.</div>
```

In `showEvent`, replace `<p class="src">Saved in this browser only. “Export notes” in the header writes picks, notes and verdicts to a Markdown file.</p>` with:

```js
      <p class="src">${user ? 'Saved to your account.' : 'Saved in this browser only.'} “Export notes” in My festival writes picks, notes and verdicts to a Markdown file.</p>
```

- [ ] **Step 2: `?selftest`**

At the end of the account section add:

```js
if (new URLSearchParams(location.search).has('selftest')) {
  const ok = (name, cond) => console[cond ? 'log' : 'error'](`${cond ? 'ok' : 'FAIL'} ${name}`);
  ok('esc escapes hostile names', esc('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;');
  ok('merge keeps both notes', CrewCore.mergeNoteText('a', 'b') === 'a\n\n---\n\nb');
  ok('picks round-trip', [...CrewCore.mapToPicks(CrewCore.picksToMap(new Set([3, 6])))].join() === '3,6');
  ok('merge counts added picks', CrewCore.mergeState({picks: {1: true}}, {picks: {2: true}}).added === 1);
  console.log('selftest: standalone', STANDALONE, '· ios', IOS, '· cloud', CLOUD);
  setInterval(() => console.log('selftest: sync writes', syncStats.writes, '· snapshots', syncStats.snapshots), 60000);
}
```

- [ ] **Step 3: README**

In `README.md`, under Features, after the "Notes and verdicts" bullet add:

```markdown
- **Account**: sign in with Google or email + password (My festival → Account) and your picks, verdicts and notes follow you to every device; the planner still works offline and signed out. Signing in stores your email, name and planner data in Firebase (Google, EU region); nobody but you can read them, and *Delete account* removes everything.
```

Replace the sentence `Everything is one static `index.html` with the data embedded — no build step at runtime, nothing tracked, no cookies.` with:

```markdown
Everything is one static `index.html` with the data embedded — no build step at runtime, no analytics, no cookies set by the site (Google sign-in opens Google's pages, which do). Signed-in state lives in Firestore under rules that only let the owner read it (`firebase/firestore.rules`).
```

- [ ] **Step 4: Build, run all tests, check the selftest**

```bash
python3 scripts/build.py && node --test scripts/test/*.test.mjs && (cd firebase/test && npm test)
```

Open `http://localhost:8123/?selftest` (with the server running): the console shows four `ok` lines and the selftest summary.

- [ ] **Step 5: Commit, push, merge**

```bash
git add scripts/template.html index.html sw.js README.md
git commit -m "Privacy copy, README account section, in-page selftest

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Open a PR; on the preview channel, email sign-in works (Google sign-in does not on previews: their domains are not authorized, as expected). Merge; on the live site run through Task 7's checks once more on a phone (Safari tab) and, if you have one, the installed home-screen app with email + password. Phase 1 is done: continue with `docs/superpowers/plans/2026-09-07-crew-phase-2-crews-and-invites.md`.
