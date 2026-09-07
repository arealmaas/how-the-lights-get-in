# Crew spec — review

Status: decisions 1–3, 5, 6 and 10 were taken on 7 September 2026 (Firebase Hosting, no encryption, notes synced, one crew per person, creator-only removal and closing, Spark for now) and `CREW-SPEC.md` was rewritten accordingly. This document stays as the record of the reasoning, frozen at the commit it reviewed: it describes the single-file `scripts/template.html` app, which has since been replaced by the Vite + React codebase in `src/` (`docs/superpowers/specs/2026-09-07-react-restructure-design.md`). Read its file and build-step references as history, not as instructions.

Reviewed on 7 September 2026: `CREW-SPEC.md` and `firebase/firestore.rules` at cc2f683, read against the app in `scripts/template.html` (state model, share links, sheet rendering, service worker, build and deploy workflows). A first draft of this review was then challenged by two independent reviewer passes (design critique and security review of the rules); their accepted findings are folded in below.

The review is written against the changed requirements:

- accounts — email + password, and a login provider (Google);
- the same state on every device you sign in on;
- any user can create a crew;
- membership by invite link, generated from inside the crew;
- an invitee who is not signed in is offered sign-in or account creation, then joins;
- hosting may move from GitHub Pages to Firebase Hosting if that simplifies things (your note during the review).

Kept from the spec, and assumed still wanted: local-first, works offline on the Heath, free tier only (Spark plan, so no Cloud Functions), no presence or chat, the claude.ai artifact copy stays without crew mode.

## 1. Verdict

The spec is a clean, well-argued design for what it set out to do: a passphrase-only, end-to-end-encrypted overlay with no accounts. The new requirements remove both of its foundations. A passphrase can no longer be the membership, because invites and accounts need an identity that survives a change of device. End-to-end encryption cannot survive "sign in on another device and get the same state", because Google sign-in cannot hand the device a decryption key. Patching the spec would leave two models in one document; sections 1–4 and 6–8 should be rewritten around Firebase Authentication plus security rules, and section 5 (the overlay UI) mostly stands.

Ranked findings:

1. The passphrase model and the encryption conflict with the requirements. Replace them with accounts, a plain-text data model and rules that are the whole security boundary (4.1–4.3, 4.7).
2. Sign-in and hosting go together. On GitHub Pages, Google sign-in must use the popup flow, and the installed iOS home-screen app is unreliable territory. Hosting the site on Firebase Hosting, which you have said is fine, makes the auth domain the site itself, so both flows work in every browser; the installed-app case still has to be tested on a phone, so email + password stays a required provider with an "add a password" path for Google accounts (4.8).
3. Removal has to be enforced by the rules, not the client: with multi-use invite links a removed member simply rejoins. The redesign adds a block record per removed member, tombstones crews instead of deleting them, and ties the creator's powers to membership (4.5, 4.7).
4. Own-state sync needs a defined first-sign-in sequence and field-level writes on maps. A naive "snapshot replaces local state" wipes the planner on a fresh account and can lose a note being typed (4.4).
5. Rules become the entire security model, so rules tests in the Firestore emulator are required, not optional (4.11). The current rules are unauthenticated; requiring sign-in makes abuse attributable but Spark quotas stay hard caps, so the plan needs a kill switch (F17).
6. A pre-existing bug on GitHub Pages: opening any PR preview evicts the live site's offline cache, because the service worker sweeps every `htlgi-*` cache on the shared origin (F16). Firebase Hosting removes it, since preview channels are separate origins.
7. Effort is about four days including the hosting move, not one; the festival is in twelve. Phase it, set a freeze date and a cut line (4.12).

## 2. What the new requirements change

| Spec says | Status | What replaces it |
|---|---|---|
| "No accounts, no sign-in: a crew is a passphrase" | Removed | Firebase Authentication (Google, email + password). A crew is a document any signed-in user can create; membership is a member document under it. |
| "Joining is typing a passphrase" | Removed | Opening an invite link while signed in (or signing in / creating an account first). |
| "The server never sees readable data" | Removed | Firestore holds readable picks, verdicts and notes per account. Privacy comes from rules: only you read your document; only crew members read the crew's projection; notes reach the crew only when you mark them shared, and the rules enforce that. |
| `memberId` per device, members grouped by display name | Removed | The account uid is the identity; one member document per person, however many devices. |
| "No admin roles. Everyone with the passphrase is equal" | Changed | Everyone can invite, rename and leave. Only the creator can remove members, hand the crew over, or close it (decision 6). |
| Rotation: "there is none" | Changed | Invite links expire and can be revoked; removal writes a block record that the join rule checks. |
| One `onSnapshot` on `members`, encrypted blobs | Changed | Three listeners: your own user document, the crew document, the members collection. Plain documents. |
| Own picks local-first, crew as an overlay | Kept | localStorage still renders first and works offline; Firestore is the sync layer once signed in. |
| Hosted on GitHub Pages; PR previews under `pr-preview/` on the same origin (§6–7) | Changed | Firebase Hosting: a live channel plus a preview channel per pull request, rules deployed from the same workflow; GitHub Pages keeps a move page (4.10). |
| Section 5 UI (badges, Crew chip, Going row, tally, shared notes, hub sections, crew calendar, reading-list toggle) | Kept | Reads from the members snapshot instead of decrypted payloads. Adds an Account card, invite links and a join banner. |

## 3. Findings on the spec as written

Severity in brackets. "Moot" means the redesign removes the problem; it is recorded so the reasoning is not lost.

- **F1 [blocking] Passphrase as membership.** Section 2 makes the passphrase the only identity. Invites, removal, "same state on every device" and "who is this" all need an identity that persists across devices. Replace with accounts (4.2).
- **F2 [blocking] End-to-end encryption versus cross-device state.** There are three options: the server holds readable state; every device holds a user secret (a sync passphrase typed on each device); or no cross-device state. The second breaks the requirement as stated, since Google sign-in alone could not restore anything, and storing the key in the account to fix that makes the encryption decorative. Recommend dropping encryption and stating the new privacy model in one honest paragraph in the UI and the README (4.9, 4.10).
- **F3 [high, security] World-writable rules.** Anyone on the internet can write to `crews/<any 43-character id>/members/*` with no auth, and anyone who once held a crew id can delete every member document. The spec accepts this as "world-writable at unguessable ids"; it also makes abuse unattributable. Requiring auth ties every write to a uid you can disable in the console. It does not bound abuse: sign-up is open and the Spark quotas are hard caps (F17). Keep the field allow-lists, the size caps and `updatedAt == request.time`; they are good and carried into the draft in 4.7.
- **F4 [high, security, moot] Passphrase guessing is cheap for the attacker and costly for you.** The salt is a public constant, so the id for any candidate passphrase can be derived offline and probed with one unauthenticated read that spends your 50 000 reads per day. Three words from a large word list are fine; typed passphrases ("heath 2026") are not, and the spec allows both. The same "id is the secret" reasoning returns for invite tokens in 4.6, where it is acceptable because the token is 128 random bits from `crypto.getRandomValues`, not a human choice, and reads require sign-in.
- **F5 [medium, correctness, moot] "Same name = same person".** Two people called Sam become one member; a typo splits one person into two. Accounts make the uid the identity and the name a label.
- **F6 [medium, correctness] Removal is not removal.** A "removed" device rejoins by typing the passphrase. The first draft of this review repeated the mistake with multi-use invite links; the fix is a block record checked by the join rule (4.5, 4.7).
- **F7 [medium, process] Section 8 assumes tooling the repo does not have.** There is no `package.json`, no Node, no test of any kind; Playwright is a larger change than the spec admits. Once rules are the security model, rules tests against the emulator (`@firebase/rules-unit-testing`, which needs Node and a JDK) are the suite that matters; Playwright can wait (4.11).
- **F8 [medium, ops] `firebase deploy --only firestore:rules` in section 6 cannot work** without `firebase.json` and `.firebaserc`, neither of which exists. Add `firebase.json` and `.firebaserc` at the repo root so rules, hosting and emulator config are reproducible, and deploy the rules from the workflow (4.10).
- **F9 [low, moot] Creation race.** Two people who "create" the same passphrase at the same moment end up in one crew with two names; the first snapshot decides.
- **F10 [low, consistency]** Section 2 says storing the passphrase is "optional" and then that it is stored. Section 3's payload has `"app": 4` with no definition. Section 4's "trims shared notes to fit and warns" does not say which notes go first.
- **F11 [low, performance] SDK weight.** Measured today from the pinned CDN version (12.18.0, which exists): `firebase-app` 105 KB, `firebase-auth` 156 KB, `firebase-firestore` 684 KB uncompressed, about 945 KB on top of the 664 KB page, roughly a quarter of that over the wire with gzip. The spec's "users without a crew download nothing extra" is right and must stay; signed-in users pay once and the service worker caches it.
- **F12 [low, pre-existing] One origin for everything.** The live site, every PR preview and any other project on `arealmaas.github.io` share `localStorage`, `sessionStorage`, IndexedDB (Firestore's persistent cache, the auth session) and CacheStorage. Fine for previews against the same Firebase project, but a preview that bumps `v` writes documents the live rules reject. Rule: schema changes ship to `main` first; previews never change `v`. See also F16. Moving to Firebase Hosting ends the shared origin: the live site and each preview channel are separate origins.
- **F13 [info, pre-existing, and an argument for accounts] Safari's seven-day storage cap.** Safari deletes all script-writable storage for a site after seven days of Safari use without a visit to it; home-screen apps are exempt. Someone who plans this week in a Safari tab and next opens the site on 19 September can find an empty planner. Accounts turn that into "sign in again" instead of "start over". Worth a line in the README either way.
- **F14 [low] Effort.** Section 9's one day was optimistic even for the passphrase version (crypto, store, six UI surfaces, hub section, calendar, reading list, tests). See 4.12.
- **F15 [info]** Section 3's "no document at `crews/{crewId}`" goes away: the crew needs a document for its name, creator and closed state.
- **F16 [high, pre-existing] PR previews evict the live site's offline cache.** `sw.js` names its cache `htlgi-<build hash>` and, on activate, deletes every cache on the origin that starts with `htlgi-` and is not its own (`sw.js:12-14`). CacheStorage is per origin, not per service-worker scope, and the preview workflow publishes its own `sw.js` under `pr-preview/pr-N/` on the same origin. So opening a preview on your phone deletes the live app's cached page and fonts, and vice versa; the live page heals itself on the next online visit, but an offline open in between fails. With the Firebase SDK in that cache (4.10), a signed-in offline boot on the Heath would depend on nobody having opened a preview. Fix before the festival: namespace the cache by scope (`'htlgi-' + hash of registration.scope`) and sweep only caches with the same prefix. On Firebase Hosting the sweep is harmless, because each preview channel is its own origin; the fix is still cheap hygiene, and it protects anyone who keeps using the GitHub Pages copy until the move page goes up.
- **F17 [medium, security and ops] Abuse ceiling and kill switch.** Spark limits are hard: 50 000 reads, 20 000 writes and 20 000 deletes per day, 1 GiB stored, 10 GiB egress a month, and they reset around midnight Pacific time (08:00 BST), so an exhaustion on Friday night is a read-only database through Saturday morning. Sign-up is open, so one scripted account can spend the day's writes in minutes, or fill the gigabyte with ~1 000 near-1 MiB member documents (rules can cap entry counts but not bytes inside a map). Realistic likelihood for an unlisted fan site: low. Mitigations, cheapest first: the app is local-first, so the failure mode is "crew stops updating", not "planner broken"; publish read-only rules from the console as the kill switch (one minute); check the usage page the day before; App Check with the reCAPTCHA v3 provider (free) if there is time (decision 9). Hosting on Spark has its own cap, 10 GB of transfer a month (4.10, decision 10).
- **F18 [medium, privacy] The site will hold personal data.** Accounts mean email addresses, names, and per-person plans and notes in a Google-hosted database. The README's "nothing tracked, no cookies" needs rewording, and the about text needs a short privacy paragraph: what is stored, where (EU region), who can see it, and that "Delete account" removes it (4.9).

## 4. Recommended design

### 4.1 Approaches considered

- **A. Accounts plus rules, no encryption (recommended).** Firebase Auth is the identity, rules are the privacy boundary, Firestore holds readable state. One mental model, invite links are just a token, a new device restores everything on sign-in, removal works, abuse is attributable.
- **B. Accounts for own state, passphrase crews kept as they are.** Two systems side by side. Invite links would carry the passphrase; to survive a device change the passphrase would be stored in the account, so the server holds the key anyway. Encryption without a threat model. Rejected.
- **C. Accounts plus encryption with a sync passphrase typed on every device.** Keeps the privacy goal, breaks "logging in gives the same state", doubles the sign-in UX. Rejected for v1; could return later for notes only.

### 4.2 Identity

- Firebase Authentication with two providers: **Google** and **Email/Password**. No anonymous accounts in v1: they are lost when storage is cleared, which is the problem accounts exist to solve, and they would make every visitor create Firestore documents (decision 4).
- Display name: from the Google profile, or asked at sign-up; editable in the Account card; at most 40 characters.
- Email enumeration protection is on by default for new projects, so signing in with an unknown email returns the same `auth/invalid-credential` as a wrong password. The UI needs explicit "Sign in" and "Create account" actions, not a "Continue" that detects new users. Creating an email account with an address that already has a Google account fails with `auth/email-already-in-use`; the message should say "sign in with Google, then add a password from the Account card". Password reset uses `sendPasswordResetEmail`; Firebase hosts the action page on the auth domain.
- **Add a password** (Account card, Google accounts only): `linkWithCredential` with an email credential, so the same account also works wherever Google sign-in turns out not to run (the installed iOS app is the doubtful case, 4.8).
- Account deletion: Account card → "Delete account". If the user created a crew, they must hand it over or close it first (4.5). Then: detach listeners, batch-delete the member document and `users/{uid}`, and `deleteUser()`; `auth/requires-recent-login` is handled by re-authenticating first.
- The SDK loads lazily, as the spec says: on boot only when a `localStorage` marker says this device has a session; otherwise when the user opens Sign in, Create crew or an invite link. Auth restores the session from IndexedDB without network, so an offline cold start still knows who you are.

### 4.3 Data model

```
users/{uid}                        private: only the owner reads and writes
  name        string ≤ 40
  crew        string               id of the crew you are in; absent when none. A pointer kept by the client.
  picks       map   eventNo → true
  verdicts    map   eventNo → who
  notes       map   eventNo → text
  shared      map   eventNo → true  notes marked "share with crew"; the rules use it to bound the projection
  updatedAt   serverTimestamp
  v           1

crews/{crewId}                     crewId: a client-generated Firestore auto-id (20 characters)
  name        string ≤ 60
  createdBy   uid                  can be handed to another member; never a non-member
  deleted     false | true         a closed crew keeps its document (tombstone), so the id cannot be re-created
  createdAt, updatedAt, v

crews/{crewId}/members/{uid}       the crew-visible projection; each member writes only their own
  name        string ≤ 40          copied from the profile, so members never read each other's user document
  joinedAt    serverTimestamp      join order decides the colour
  picks, verdicts                  as above
  notes       map                  only the shared ones; the rules check the keys against users/{uid}.shared
  invite      string               the token used to join; required on create, dropped by the next write
  updatedAt, v

crews/{crewId}/invites/{token}     token: 16 bytes from crypto.getRandomValues, base64url, 22 characters
  crewName, createdByName          denormalised for the join banner; the rules require them to match the crew and the member
  createdBy, createdAt, expiresAt, revoked, v

crews/{crewId}/removed/{uid}       block record written when the creator removes someone; checked by the join rule
  removedAt, v
```

Why a projection rather than letting members read each other's user document: private notes stay private, "share with crew" is what gets copied (and the rules enforce it), and every rule under `crews/` is a membership check. The cost is a second write per change while you are in a crew, well inside the budget.

Contract: the first write to `users/{uid}` is the complete document (all maps present, possibly empty). Every rule dereferences `name`, `picks`, `verdicts`, `notes`, `shared`, `v` and `updatedAt`, so a partial create is denied, and `updateDoc` on a missing document fails. The same holds for member documents.

### 4.4 Own-state sync

**Sign-in sequence** (also the first-run sequence on a new device):

1. Sign-in completes. Read `users/{uid}` once from the server.
2. If it does not exist: write the complete document from local state (name from the profile or the sign-up form, `shared: {}`).
3. If it exists and this device has never synced with this uid: merge, never discard. Picks are the union; verdicts are the union with the local value winning a conflict; a note that differs on both sides keeps both texts with a rule (`---`) between them. Write the merged state up and show one line ("Merged 12 picks from this device into your account"). Imports from `#picks=` links are user-confirmed and count as the user's picks; deliberate un-picks made offline on another device are not resurrected because the union runs only on this first sync.
4. If it exists and this device last synced with a *different* uid: do not merge. Replace local state with the account; the previous person's data is already in their account.
5. Mark the device as synced with this uid (`localStorage`, keyed by uid). Only now subscribe to `users/{uid}`.

**Snapshots.** Apply a snapshot only when the document exists. A non-existent snapshot while signed in means the account was deleted elsewhere: stop syncing, keep local state, say so. Apply in place: update the in-memory maps, save to `localStorage`, `render()` the list. Do not rebuild an open event sheet from state while its notes textarea has focus (`openSheet` replaces the sheet's HTML, `template.html:735`), and flush the pending 250 ms note write before applying a snapshot so the text in the textarea is never older than what is applied. With that guard, Firestore's latency compensation makes the snapshot consistent with this device's own writes.

**Writes** are field-level `updateDoc` calls (`picks.41: true` or `deleteField()`, `notes.41: "…"`) with `updatedAt: serverTimestamp()`. Never write a whole array or map: two devices toggling different events would overwrite each other, while field-level updates merge on the server and in the offline queue. Picks therefore become a map in Firestore (the `localStorage` array is converted at the boundary; event numbers are integers, so there is no dotted-path hazard). Picks and verdicts write immediately; notes keep the existing 250 ms input debounce and write on that. While in a crew, each mutation is one batch: the user document plus the member document (picks, verdicts, and a note only when shared; sharing or unsharing updates `shared` and the projection in the same batch, which the rules require).

**Sign-out** detaches listeners first, then signs out, and keeps local data by default. "Sign out and clear this device" also clears `localStorage`, then `terminate()` and `clearIndexedDbPersistence()`, for a borrowed phone.

**Offline** is unchanged in spirit: SDK from the service worker cache, session from IndexedDB, reads from Firestore's cache, writes queued. The ID token expires after an hour, but cached reads and queued writes carry on and commit when the token refreshes on reconnect.

**`#picks=` links stay.** They still serve people without accounts and the artifact copy.

### 4.5 Crews

- **Create.** A signed-in user types a crew name. The client generates the id and writes one batch: the crew document, the creator's member document (name, current picks, verdicts, shared notes) and the `crew` pointer on the user document. The rules require the crew and member documents to arrive together (`getAfter`).
- **One crew per user in v1.** The model supports more (a member document per crew), but the pointer, the overlay and the hub assume one; opening an invite while in a crew asks to leave first (decision 5).
- **Roles.** Everyone can invite, rename and leave. The creator can remove members, hand the crew to another member ("Make X the owner"), and close it. The creator's powers exist only while they are a member; a creator who wants to leave or delete their account must hand over or close first, which the client enforces and the rules make possible (decision 6).
- **Leave** batch-deletes the own member document and clears the pointer; picks, notes and verdicts stay in the account.
- **Remove** (creator) is one batch: delete the member's document and create `removed/{uid}`. The join rule refuses anyone with a block record, so the invite link they still have is useless; the creator can re-admit by deleting the record. Whether existing listeners of the removed client receive `permission-denied` when a rule dependency disappears is undocumented (4.7 notes), so the client leads with the signal it does get: the removal of its own document from the members snapshot. It treats that, a missing own document on boot, or a `permission-denied` error as "you are no longer in this crew": clear the pointer and the overlay, keep own picks, say so once.
- **Close crew** (creator): delete the other members' documents, the invites and the block records in chunks of at most nine (each delete of someone else's document costs two document access calls, and a batch allows 20), then one final batch: delete the own member document and set `deleted: true` on the crew document. The crew document is never deleted: while it exists, `create` on that id is impossible, so nobody can re-create a half-deleted crew and inherit its remaining members' data.
- **Colours** follow `joinedAt`; the six-colour palette repeats, as in the spec.
- Everything in section 5 of the spec stands, fed by the members snapshot. Every crew-supplied string (names, crew name, shared notes, invite fields) goes through the existing `esc()` helper before it reaches `innerHTML`; `showBanner()` takes raw HTML, so the join banner in particular must escape its inputs.

### 4.6 Invites

- Anyone in the crew presses "Invite link". The client generates the token with `crypto.getRandomValues`, writes the invite (expiry 14 days by default; the rules require it to be in the future and at most 30 days out) and shows `<site>/#join=<crewId>.<token>` (the site being the hosting domain from 4.8) with Copy and, on phones, Share. The fragment keeps the token out of server logs and referrers.
- The Crew card lists active invites with "Revoke". Tokens are multi-use on purpose: you paste the link once in the group chat. Single-use would need a counter update in the join batch and is not worth it; the block record (4.5) is what makes removal stick.
- **Receiving.** `checkHash()` handles `#join=` the way it handles `#picks=`, and immediately strips it from the address bar with `history.replaceState` so the token does not sit in browser history. The pending invite is kept in `sessionStorage` (per tab, gone when the tab closes) with a one-hour expiry, so it survives a reload during account creation and is not re-offered forever; it is cleared when used or declined. Cases:
  - not signed in: banner "You've been invited to a crew. Sign in or create an account to join." The crew name appears after sign-in, because reading the invite requires it;
  - signed in, no crew: read the invite, "Join <crewName>? Invited by <name>", Join writes one batch: the member document with `invite: token`, plus the pointer; the next write drops `invite` from the member document, so the token does not stay readable by the crew;
  - already a member: "You're already in <crew>";
  - in another crew: "Leave <A> and join <B>?";
  - missing, expired or revoked, or the invitee was removed from this crew: "This invite link no longer works; ask for a new one."
- **iOS note.** A link tapped in a chat app opens in Safari, never in the installed home-screen app, and the two have separate storage. The invitee joins in Safari; in the installed app they sign in again (Google if it passes the phone test in 4.8, otherwise email + password) and the account brings the crew with it. That is what accounts buy; it needs saying in the join banner for iOS users.

### 4.7 Rules (draft)

Replaces `firebase/firestore.rules`. Untested: validate in the emulator (4.11) before publishing.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    function signedIn() { return request.auth != null; }
    function self(uid) { return signedIn() && request.auth.uid == uid; }
    function crewPath(crew) { return /databases/$(db)/documents/crews/$(crew); }
    function memberPath(crew, uid) { return /databases/$(db)/documents/crews/$(crew)/members/$(uid); }
    function isMember(crew) { return signedIn() && exists(memberPath(crew, request.auth.uid)); }
    // the creator keeps their powers only while they are a member
    function isCreator(crew) { return isMember(crew) && get(crewPath(crew)).data.createdBy == request.auth.uid; }

    function str(s, max) { return s is string && s.size() <= max; }
    function stamped(d) { return d.v == 1 && d.updatedAt == request.time; }
    // picks, verdicts and notes are maps keyed by event number. Rules cannot iterate a map, so only
    // entry counts are bounded here; Firestore's 1 MiB document limit bounds the rest (see F17).
    function stateOk(d) {
      return d.picks is map && d.picks.size() <= 300
        && d.verdicts is map && d.verdicts.size() <= 300
        && d.notes is map && d.notes.size() <= 300;
    }

    // Private planner state: one document per account, readable and writable only by its owner.
    // The first write must be the complete document; later writes are field-level updates on it.
    match /users/{uid} {
      allow get, delete: if self(uid);
      allow list: if false;
      allow create, update: if self(uid)
        && request.resource.data.keys().hasOnly(['name', 'crew', 'picks', 'verdicts', 'notes', 'shared', 'updatedAt', 'v'])
        && str(request.resource.data.name, 40)
        && (!('crew' in request.resource.data) || str(request.resource.data.crew, 40))
        && request.resource.data.shared is map && request.resource.data.shared.size() <= 300
        && stateOk(request.resource.data) && stamped(request.resource.data);
    }

    match /crews/{crew} {
      allow get: if isMember(crew);
      allow list: if false;
      // creating a crew must, in the same batch, create the creator's member document
      allow create: if signedIn()
        && request.resource.data.keys().hasOnly(['name', 'createdBy', 'deleted', 'createdAt', 'updatedAt', 'v'])
        && str(request.resource.data.name, 60)
        && request.resource.data.createdBy == request.auth.uid
        && request.resource.data.deleted == false
        && request.resource.data.createdAt == request.time
        && stamped(request.resource.data)
        && getAfter(memberPath(crew, request.auth.uid)).data.joinedAt == request.time;
      // rename: any member. Hand over to another member, or close: the creator only.
      allow update: if resource.data.deleted == false
        && request.resource.data.updatedAt == request.time
        && (
          (isMember(crew)
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'updatedAt'])
            && str(request.resource.data.name, 60))
          || (isCreator(crew)
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['createdBy', 'updatedAt'])
            && exists(memberPath(crew, request.resource.data.createdBy)))
          || (isCreator(crew)
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deleted', 'updatedAt'])
            && request.resource.data.deleted == true)
        );
      // a crew document is never deleted: the tombstone keeps the id from being re-created
      allow delete: if false;

      function memberOk(d) {
        return d.keys().hasOnly(['name', 'joinedAt', 'picks', 'verdicts', 'notes', 'invite', 'updatedAt', 'v'])
          && str(d.name, 40) && stateOk(d) && stamped(d)
          // only notes the owner marked "share with crew" may appear in the projection
          && d.notes.keys().hasOnly(getAfter(/databases/$(db)/documents/users/$(request.auth.uid)).data.shared.keys());
      }
      function invitePath(token) { return /databases/$(db)/documents/crews/$(crew)/invites/$(token); }
      function validInvite(token) {
        return exists(invitePath(token))
          && get(invitePath(token)).data.revoked == false
          && get(invitePath(token)).data.expiresAt > request.time;
      }
      function blocked() { return exists(/databases/$(db)/documents/crews/$(crew)/removed/$(request.auth.uid)); }

      match /members/{uid} {
        allow get, list: if isMember(crew);
        allow create: if self(uid) && memberOk(request.resource.data)
          && request.resource.data.joinedAt == request.time
          && (
            // the creator, in the batch that creates the crew document
            (!exists(crewPath(crew)) && getAfter(crewPath(crew)).data.createdBy == request.auth.uid)
            // or an invitee holding a live token for this open crew, who has not been removed from it
            || (get(crewPath(crew)).data.deleted == false
                && !blocked()
                && 'invite' in request.resource.data
                && str(request.resource.data.invite, 22)
                && validInvite(request.resource.data.invite))
          );
        // own document only; joinedAt is fixed; invite may be dropped but not changed
        allow update: if self(uid) && memberOk(request.resource.data)
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'picks', 'verdicts', 'notes', 'invite', 'updatedAt'])
          && (!('invite' in request.resource.data) || request.resource.data.invite == resource.data.invite);
        allow delete: if self(uid) || isCreator(crew);
      }

      match /invites/{token} {
        // the token is the secret: any signed-in user who has it may read the invite; only members can list them
        allow get: if signedIn() && token.size() == 22;
        allow list: if isMember(crew);
        allow create: if isMember(crew) && token.size() == 22
          && request.resource.data.keys().hasOnly(['crewName', 'createdBy', 'createdByName', 'createdAt', 'expiresAt', 'revoked', 'v'])
          && request.resource.data.crewName == get(crewPath(crew)).data.name
          && request.resource.data.createdBy == request.auth.uid
          && request.resource.data.createdByName == get(memberPath(crew, request.auth.uid)).data.name
          && request.resource.data.createdAt == request.time
          && request.resource.data.expiresAt is timestamp
          && request.resource.data.expiresAt > request.time
          && request.resource.data.expiresAt - request.time <= duration.value(30, 'd')
          && request.resource.data.revoked == false
          && request.resource.data.v == 1;
        allow update: if isMember(crew)
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['revoked'])
          && request.resource.data.revoked == true;
        allow delete: if isMember(crew);
      }

      match /removed/{uid} {
        allow read: if isCreator(crew);
        allow create: if isCreator(crew) && uid != request.auth.uid
          && request.resource.data.keys().hasOnly(['removedAt', 'v'])
          && request.resource.data.removedAt == request.time
          && request.resource.data.v == 1;
        allow update: if false;
        allow delete: if isCreator(crew);
      }
    }

    match /{document=**} { allow read, write: if false; }
  }
}
```

Notes on the draft:

- Rules-language points checked against the reference: functions declared inside a `match` block see its path variables; `let` is allowed in functions (v2); `duration.value` units include `'d'`; `getAfter()` is for writes and sees the batch's result; `diff().affectedKeys()` returns top-level keys, so a field-level `updateDoc` on `picks.41` affects `picks`; `Map.keys()` returns a list and `hasOnly` is a list method. Timestamp minus timestamp compared with a duration is the documented form, which is why the expiry cap is written as a subtraction rather than `request.time + duration`.
- Document access calls (limits: 10 per operation, 20 per batch): create-crew batch 4; join batch 7 (all on the member create; the user update costs none); listing members 1; a member's own update 1 (`getAfter` on the user document); creating an invite 3; removing someone else's member document 2, which is why close-crew deletes in chunks of at most nine.
- `get()` and `exists()` see the state before the batch; `getAfter()` sees the state after it. That pairing forces "crew document and creator's member document arrive together", lets the close-crew batch pass `isCreator` while deleting the creator's own member document, and stops a non-member from planting a member document under someone else's crew: the crew document exists, `createdBy` can only move to an existing member, and there is no token.
- A rule that throws (for example dereferencing a missing document) denies; the `exists()` guards are for clarity, not correctness.
- Not enforced, on purpose: the `crew` pointer on the user document (only its owner reads it), and the byte size of notes inside the maps (rules cannot iterate a map). A member can bloat only their own document, up to Firestore's 1 MiB, and every write is attributable. The ceiling this leaves is F17.
- `list` on `users` and `crews` is denied, and there is no recursive wildcard, so collection-group queries on `members`, `invites` or `removed` are denied by the catch-all. Ids and tokens cannot be enumerated even by signed-in users.
- Whether an active listener receives `permission-denied` when a document that its rule depends on (the member document behind `isMember`) is deleted is not documented; the client must not rely on it (4.5).

### 4.8 Sign-in and hosting

The sign-in problem on GitHub Pages is a hosting problem, and you have said Firebase Hosting is acceptable. Recommendation: move (decision 2).

- **Why GitHub Pages is awkward.** `signInWithRedirect` bounces through `authDomain` (`<project>.firebaseapp.com`), a different site from `arealmaas.github.io`. Safari, Firefox and Chrome block the cross-site storage that flow needs, so on GitHub Pages only `signInWithPopup` works without infrastructure; Firebase's other fixes are a same-site `authDomain`, a reverse proxy, or self-hosting the `/__/auth/` helper files, which for a `github.io` domain would mean the root user-site repository. Popups are fine in browser tabs on desktop, iOS and Android. In the installed iOS home-screen app they are unreliable and undocumented: the one concrete report (firebase-js-sdk #7443, iOS 16.5, closed without resolution) says the popup worked with the default `firebaseapp.com` auth domain and failed with a custom one; #8265 is a generic "popup closed" report.
- **On Firebase Hosting the auth domain is the site.** Hosting serves the sign-in helpers under `/__/auth/` on every hosting domain, so with `authDomain` set to the domain that serves the app, redirect and popup are both same-origin and work in every browser. Fewest moving parts: make `https://<project>.firebaseapp.com/` the canonical URL, which is the default auth domain, so nothing needs customising. `web.app` or a custom domain also work if `authDomain` is set to them, the domain is authorized, and its `/__/auth/handler` URL is added to the Google OAuth client.
- **Flows.** Popup on desktop, redirect on phones (Firebase's own recommendation for mobile), redirect first in standalone mode. The installed iOS app still needs a real test on a phone before the freeze: a redirect leaves the app's scope for Google and has to come back into it. Until that test passes, the Account card in standalone mode shows email + password first and Google second, and "Add a password" (4.2) means a Google account is never stuck.
- **Authorized domains:** the project's `firebaseapp.com` and `web.app` domains and `localhost` are authorized by default; add a custom domain if you use one. Preview channels (`<project>--pr-N-<hash>.web.app`) are separate origins and would each need authorizing to test sign-in there; test sign-in on `localhost` and the live site instead.
- Restricting the browser API key to the hosting domains is hygiene against key reuse, not a security control (referrers are trivially forged). Keep it as the optional step it is.
- **If you stay on GitHub Pages after all:** popup only, hide Google in standalone iOS unless the phone test passes, email + password as the guaranteed path. Workable, with the caveats above.

### 4.9 UI

- **Account card** in *My festival*. Signed out: "Keep your picks on every device" with a Google button (shown second in standalone iOS until the phone test in 4.8 passes) and an email form (Sign in, Create account, Forgot password). Signed in: name and email, Change name, Add a password (Google accounts), Sign out, "Sign out and clear this device", Delete account.
- **Crew card.** No crew: "Create a crew" (name) and "Have an invite link? Open it." In a crew: name, members with initials, colours, pick counts and last sync; Invite link; active invites with Revoke; Leave; for the creator, Remove next to each member, Make owner, Close crew.
- **Join banner** for `#join=` links, cases as in 4.6, with every crew-supplied string escaped. The first-run nudge on the empty state stays.
- **Privacy paragraph** in the about text and the README, replacing "nothing tracked, no cookies": what is stored when you sign in (email, name, picks, verdicts, notes, crew), where (Firebase, Google, EU region), who sees it (you; your crew sees picks, verdicts and shared notes), that the site sets no cookies and has no analytics but Google sign-in opens Google's pages which do, and that "Delete account" removes everything.

### 4.10 Repo, hosting and setup changes

Hosting

- `firebase.json` at the repo root: hosting (`public: _site`, long cache headers for `img/`), the rules path `firebase/firestore.rules`, emulator ports; `.firebaserc` with the project id. The rules tests and their `package.json` live under `firebase/test/`, so the app itself stays dependency-free.
- Workflows: `firebase init hosting:github` writes two workflows (a preview channel with a PR comment on every pull request; live deploy on push to `main`) and stores a service-account secret. They replace `deploy.yml` and `pr-preview.yml`; each runs `sh scripts/assemble-site.sh _site` first. Add a rules deploy (`npx firebase-tools deploy --only firestore:rules`, same service account) to the `main` job so the published rules always match the repo (fixes F8). Preview channels talk to the real Firestore project, as PR previews do today; they expire after seven days unless redeployed.
- URL change: `PUBLIC_URL` in `scripts/template.html`, the README, the manifest's `start_url`, the artifact copy's "open the public site" links. Keep the `.ics` `UID` suffix `@arealmaas.github.io`: it is a namespace, and changing it would duplicate events for anyone who re-imports a calendar.
- Move page on GitHub Pages: one last deploy to `gh-pages` that says "The planner has moved" and offers one button that opens the new site with this device's picks, verdicts and notes in the fragment (`#picks=…&verdicts=…&notes=<base64 JSON>`, capped at about 30 KB), because `localStorage` does not cross origins. `checkHash()` on the new site learns to import `notes`. People who installed the old home-screen app see the move page and reinstall from the new origin.
- Spark Hosting allows 10 GB of transfer a month; a first visit costs about 4.2 MB (page plus the precached photos), so that is roughly 2 400 new devices a month. Beyond that the site is disabled after a grace period. Blaze keeps the same allowance and bills $0.15 per extra GB; set a budget alert if you switch (decision 10).

Repo

- `data/firebase.json` → `DATA.firebase` as in the spec, with `authDomain` set to the hosting domain. When absent, Account and Crew UI are hidden and the build prints its note.
- `firebase/firestore.rules` (new) and `firebase/test/rules.test.mjs`. The emulator needs Node and a JDK on the machine that runs the tests.
- `sw.js`: cache `www.gstatic.com` for the SDK; namespace the cache by scope anyway (F16). Do not cache `/__/auth/*` or `apis.google.com`; they are online-only by nature.
- `scripts/template.html`: an `account` module (auth, own-state sync, merge, Account card) and a `crew` module (crews, invites, removal, overlay). Budget about 800 lines rather than the spec's 400.
- README: hosting and previews, Account and Crew sections, the privacy paragraph, the Safari seven-day note.

Console, replacing section 7: create the project (Analytics off); Firestore in production mode, `eur3` or `europe-west2`, publish the rules; Authentication → Sign-in method: enable Email/Password and Google (Google asks for a support email); Hosting → Get started (the CLI does the rest); Project settings → add a web app, save the config as `data/firebase.json` with `authDomain` set to the hosting domain; optionally restrict the browser key; optionally App Check (F17). Keep a read-only copy of the rules to hand as the kill switch. About 30 minutes plus the first deploy.

### 4.11 Testing

- **Rules tests in the emulator, required.** Cases: a user reads and writes only their own document, and a partial create is denied; `list` on `users` and `crews` is denied; a non-member cannot read a crew, its members, its invites or its block records; creating a crew without the member document in the batch is denied, with it allowed; joining with a valid token allowed; with an expired, revoked, other-crew or missing token denied; without a token denied; joining while blocked denied, allowed again after the record is deleted; a member's projection may not contain a note key that is not in their `shared` map; a member cannot change `joinedAt` or `invite` but can drop `invite`; a member cannot delete another member, the creator can; a creator who has left cannot; `createdBy` can move only to an existing member and only by the creator; closing sets the tombstone and `create` on a closed crew's id is denied; invite `crewName` and `createdByName` must match; `expiresAt` must be in the future and within 30 days; every allow-list and size cap.
- **In-page `?selftest`:** the sign-in sequence and merge (create-from-local, union, local-wins verdicts, conflicting notes, different-uid replace), map/array conversion, `#join=` parsing and stripping, escaping of crew-supplied strings in the banner and overlay.
- **Manual matrix before the festival:** desktop Chrome; Safari tab on iPhone (Google); installed iOS app: first the Google phone test (redirect, then popup), then email + password, then a Google account after "Add a password"; Android Chrome (Google); airplane mode on one device then reconnect; sign in on a second device and see the same state; remove a member and watch their client drop out; open an invite while signed out and complete account creation; open a preview channel and confirm the live site still works offline (F16); open the old GitHub Pages URL and confirm the move page carries picks, verdicts and notes across.
- **Quota sanity** as in the spec: log reads and writes in dev mode; check the usage page the day before the festival.

### 4.12 Effort and phasing

- **Tooling and hosting — one day.** Node and a JDK for the emulator, `firebase.json` and the first rules test, the hosting move (CLI init, the two workflows with the rules deploy, URL constants, the move page with the notes-carrying link), the `sw.js` cache fix (F16).
- **Phase 1 — accounts and sync, about 1.5 days.** Console setup, Account card and auth flows (including Add a password and standalone detection), the sign-in sequence and merge, own-state sync, sign-out and delete, rules for `users/` with tests, privacy paragraph, README. Ships value on its own: the same state on every device, and protection from the Safari seven-day wipe.
- **Phase 2 — crews and invites, about 1.5 days.** Crew, member, invite and block documents, rules with tests, create, join, leave, remove, hand over and close flows, the overlay UI from section 5, hub sections, crew calendar, reading-list toggle.
- **Total about 4 days** against 12 to the festival. The console setup is the one dependency for the smoke test; everything else can start now. The hosting move goes first so every later test runs against the final origin.
- **Freeze and cut line.** Freeze on Wednesday 17 September: nothing ships to `main` after that except a revert. If Phase 2 is not through the manual matrix by then, ship Phase 1 alone and coordinate the crew by `#picks=` links as today. Rollback is a revert on `main`; the deploy workflow republishes, and the page is network-first in the service worker, so every online device picks it up on the next load.

## 5. Decisions needed

Each with the recommendation the design above assumes.

1. Drop end-to-end encryption and state the new privacy model plainly. **Yes.**
2. Hosting. **Move to Firebase Hosting now**, canonical URL `https://<project>.firebaseapp.com/`, GitHub Pages left serving the move page. It makes both sign-in flows same-origin, gives preview channels on separate origins (ends F12 and F16), and deploys rules next to hosting. Staying on GitHub Pages is workable with popup-only sign-in and the installed-app caveat.
3. Sync private notes to the account, not only picks and verdicts. **Yes**; that is what "the same state" means, and the rules keep them out of the crew unless shared.
4. Guest join without an account (anonymous auth, upgradeable later). **No** in v1.
5. One crew per user in v1. **Yes.**
6. Roles: everyone invites, renames and leaves; the creator removes, hands over and closes; the creator must hand over or close before leaving or deleting their account. **Yes.**
7. Keep `#picks=` links. **Yes.**
8. Two phases with accounts first, freeze on 17 September, Phase 1 alone as the cut line. **Yes.**
9. App Check (reCAPTCHA v3) against quota abuse. **After the festival** unless Phase 2 finishes early; the read-only rules kill switch covers the weekend.
10. Hosting plan. **Spark** for now: 10 GB a month of transfer is about 2 400 new devices, comfortable for a fan site. Switch to Blaze with a budget alert if you expect more, because Spark disables the site when the cap is hit.

## 6. Edits to CREW-SPEC.md by section

- Title line: backend becomes "Firebase Authentication + Cloud Firestore (Spark plan)"; "No accounts, no sign-in: a crew is a passphrase" becomes "Accounts (Google or email + password); any signed-in user creates a crew, others join by invite link."
- §1 Goals: replace bullets 2 and 4 (joining, encryption); add "the same picks, verdicts and notes on every device you sign in on". Non-goals: replace "No admin roles" with the creator rule; keep the others.
- §2 becomes "Identity and accounts" (4.2) and "The crew model" (4.5).
- §3 becomes the data model (4.3) and the rules (4.7); the encryption paragraphs go.
- §4 becomes 4.4 plus removal handling from 4.5.
- §5: add the Account card, invite links and the join banner (4.9); the overlay stays as written, with the escaping rule.
- §6 becomes 4.10: the move to Firebase Hosting, the two workflows with the rules deploy, the move page, the `sw.js` cache fix. §7 becomes the console steps in 4.10. §8 becomes 4.11. §9 becomes 4.12 with the freeze date and cut line.
- §10: keep the three open questions; add section 5 above until settled.

## Sources

- Firebase, Best practices for using signInWithRedirect on browsers that block third-party storage access: https://firebase.google.com/docs/auth/web/redirect-best-practices
- Firestore rules, access to other documents (`get`, `exists`, `getAfter`) and access-call limits: https://firebase.google.com/docs/firestore/security/rules-conditions
- Firestore rules language (functions, `let`, scope): https://firebase.google.com/docs/rules/rules-language
- Firestore rules `duration` reference: https://firebase.google.com/docs/reference/rules/rules.duration_
- Firestore quotas and limits (Spark free tier): https://firebase.google.com/docs/firestore/quotas
- Firebase Hosting usage, quotas and pricing: https://firebase.google.com/docs/hosting/usage-quotas-pricing
- Firebase Hosting, deploy to live and preview channels via GitHub pull requests: https://firebase.google.com/docs/hosting/github-integration
- firebase-js-sdk issue #7443, iOS home-screen `signInWithPopup` failure: https://github.com/firebase/firebase-js-sdk/issues/7443
- firebase-js-sdk issue #8265, popup closed before finalising: https://github.com/firebase/firebase-js-sdk/issues/8265
- firebase-js-sdk issue #6716, redirect sign-in broken on Safari 16.1+: https://github.com/firebase/firebase-js-sdk/issues/6716
