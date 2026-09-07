# Crew mode — specification

Status: revised draft for review, 7 September 2026 (v2, replacing the passphrase design; the reasoning is in `CREW-SPEC-REVIEW.md`). Backend: Firebase Authentication, Cloud Firestore and Firebase Hosting on the free Spark plan. Accounts (Google, or email + password) hold your picks, debate verdicts and notes, so every device you sign in on shows the same planner. Any signed-in user can create a crew; others join by invite link. A crew shares picks, verdicts and the notes each member chooses to share.

## 1. Goals and non-goals

Goals

- Three (or more) people see each other's picks in the planner, on the phone, at the festival: who is going where, where the crew splits, one crew calendar, one crew reading list, a verdict tally on debates, and notes a member chooses to share.
- The same picks, verdicts and notes on every device you sign in on. Sign-in is Google or email + password.
- Creating a crew is typing a name. Joining is opening an invite link; someone without an account creates one on the spot.
- Your own planner keeps working exactly as today when signed out or offline. Own picks stay local-first; the account is the sync layer; the crew is an overlay.
- Free: Spark plan, no Cloud Functions, no server code. The security rules are the whole server side.

Non-goals

- No subscribable calendar feed: that needs server code. The crew calendar is an `.ics` export, like today's.
- No presence, chat, or per-event comments beyond shared notes.
- No end-to-end encryption. Firestore holds readable state; privacy comes from sign-in and the rules, and the app says so plainly (section 7).
- One crew per person, and one role: the creator removes members, hands the crew over and closes it; everyone invites, renames and leaves. Nothing else.
- No guest accounts (anonymous sign-in) in v1.
- The claude.ai artifact copy gets neither accounts nor crews (its sandbox cannot load the SDK); it keeps its note pointing to the public site.

## 2. Identity and accounts

- Firebase Authentication with two providers: Google and Email/Password.
- Display name: from the Google profile, or asked for at sign-up; editable in the Account card; 1–40 characters. It is copied into the crew's member document, so members never read each other's private document.
- Email enumeration protection stays on (the default for new projects). Signing in with an unknown email returns the same `auth/invalid-credential` as a wrong password, so the form has explicit *Sign in* and *Create account* actions. Creating an email account for an address that already has a Google account fails with `auth/email-already-in-use`; the message says "sign in with Google, then add a password from the Account card".
- Add a password (Google accounts): `linkWithCredential` with an email credential, so the account also works wherever Google sign-in cannot run.
- Forgot password: `sendPasswordResetEmail`; Firebase hosts the action page.
- Sign-in flow by platform: `signInWithPopup` on desktop; `signInWithRedirect` on phones and in standalone (home-screen) mode, which works because the auth domain is the site itself (section 8). Before redirecting, the app sets `sessionStorage` `htlgi-l26-redirect` so the next load knows to import the SDK and call `getRedirectResult`. Standalone mode is `matchMedia('(display-mode: standalone)')` or `navigator.standalone`. Until the installed-iOS test in section 10 passes, the Account card in standalone iOS lists email + password first and Google second.
- Delete account: if the user created a crew, they hand it over or close it first. Then, in order: detach listeners, one batch deleting the member document and `users/{uid}`, `deleteUser()`. `auth/requires-recent-login` triggers re-authentication and a retry.
- Sessions persist in IndexedDB and are restored without network, so an offline cold start knows who you are.

## 3. The crew model

Crew and membership

- A crew is a document with a name, its creator and a `deleted` flag. Membership is a member document under it, keyed by the account uid: one per person, however many devices. A person is in at most one crew; the pointer `users/{uid}.crew` says which.
- Create: type a name. The client generates the crew id (a Firestore auto-id) and writes one batch: the crew document, the creator's member document (name, current picks, verdicts, shared notes) and the pointer. The rules require the crew and member documents to arrive together.
- Roles: everyone invites, renames and leaves. The creator removes members, hands the crew to another member (*Make owner*) and closes it. Those powers exist only while the creator is a member; a creator who wants to leave or delete their account hands over or closes first (the client refuses otherwise; the rules make the hand-over possible).
- Leave: one batch deleting the own member document and clearing the pointer, after detaching the crew listeners. Picks, verdicts and notes stay in the account.
- Remove (creator): one batch deleting the member's document and creating `removed/{uid}`. The join rule refuses anyone with a block record, so the invite link they still have is useless; the creator can re-admit by deleting the record (Crew card, *Removed* list). The removed client notices in one of three ways, all treated as "you are no longer in this crew": its own document disappears from the members snapshot, its member document is missing on boot, or a listener fails with `permission-denied`. It clears the pointer and the overlay, keeps own picks, and says so once.
- Close (creator): delete the other members' documents, the invites and the block records in batches of at most nine (each delete of someone else's document costs two rule lookups; a batch allows twenty), then one final batch: delete the own member document, set `deleted: true` on the crew, clear the pointer. The crew document itself is never deleted: while it exists the id cannot be re-created, so nobody can resurrect a half-closed crew and inherit its data. Members still subscribed see `deleted: true` and treat it as removal, with the message "The crew was closed".
- Colours: one of six, in `joinedAt` order; past six they repeat.

Invites

- Any member presses *Invite link*. The client makes a token of 16 bytes from `crypto.getRandomValues`, base64url, 22 characters, and writes `crews/{crew}/invites/{token}` with the crew name, the inviter's name and an expiry 14 days out (the rules require the expiry to be in the future and at most 30 days out). The link is `<site>/#join=<crewId>.<token>`; the fragment keeps the token out of server logs and referrers. *Copy*, and *Share* on phones (Web Share API).
- Links are multi-use on purpose: paste once in the group chat. The Crew card lists live invites with *Revoke*.
- Receiving: `checkHash()` handles `#join=` next to `#picks=`, and at once strips it from the address with `history.replaceState`. The pending invite is kept in `sessionStorage` (`htlgi-l26-join`: crew, token, time) so it survives the redirect sign-in round trip and a reload while creating an account; it is dropped after an hour, or when used or declined. Cases:
  - not signed in: banner "You've been invited to a crew. Sign in or create an account to join." (reading the invite needs sign-in, so the crew name comes after);
  - signed in, no crew: read the invite; "Join <crewName>? Invited by <name>". *Join* writes one batch: the member document with `invite: token`, plus the pointer. The next write drops `invite` from the document, so the token is not left readable by the crew;
  - already in this crew: "You're already in <crew>";
  - in another crew: "Leave <A> and join <B>?", which runs Leave, then Join;
  - missing, expired or revoked token, closed crew, or a block record for this user: "This invite link no longer works; ask for a new one."
- iOS: a link tapped in a chat app opens in Safari, not in the installed home-screen app, and the two have separate storage. The invitee joins in Safari; in the installed app they sign in again and the account brings the crew with it. The join banner says so on iOS Safari.

## 4. Data layout

Firestore:

```
users/{uid}                        private: only the owner reads and writes
  name        string ≤ 40
  crew        string               id of the crew you are in; absent when none; a pointer kept by the client
  picks       map   eventNo → true
  verdicts    map   eventNo → who
  notes       map   eventNo → text
  shared      map   eventNo → true  notes marked "share with crew"; the rules bound the projection with it
  updatedAt   serverTimestamp
  v           1

crews/{crewId}                     crewId: a client-generated Firestore auto-id (20 characters)
  name        string ≤ 60
  createdBy   uid                  may be handed to another member, never to a non-member
  deleted     false | true         closed crews keep their document (tombstone)
  createdAt, updatedAt, v

crews/{crewId}/members/{uid}       the crew-visible projection; each member writes only their own
  name        string ≤ 40          copied from the profile
  joinedAt    serverTimestamp      join order decides the colour
  picks, verdicts                  as above
  notes       map                  shared notes only; the rules check the keys against users/{uid}.shared
  invite      string               the token used to join; required on create, dropped by the next write
  updatedAt, v

crews/{crewId}/invites/{token}     token: 22 characters, base64url of 16 random bytes
  crewName, createdByName          for the join banner; the rules require them to match the crew and the member
  createdBy, createdAt, expiresAt, revoked, v

crews/{crewId}/removed/{uid}       block record written when the creator removes someone; checked by the join rule
  removedAt, v
```

- Maps, not arrays: picks are keyed by event number so that two devices toggling different events merge instead of overwriting each other (section 6). Event numbers are integers, so map keys need no escaping.
- The first write to `users/{uid}`, and to a member document, is the complete document with every map present (empty if need be). Every rule dereferences `name`, `picks`, `verdicts`, `notes`, `v` and `updatedAt`, so a partial create is denied, and `updateDoc` on a missing document fails.
- Size: 135 picks, a few verdicts and a handful of notes is a few KB. The rules cap entry counts at 300 per map; Firestore's 1 MiB document limit bounds the rest.
- Every write carries `updatedAt: serverTimestamp()`; the rules require it to equal the request time.

## 5. Security rules

`firebase/firestore.rules` in the repo, deployed by the `main` workflow (section 8). Draft until the emulator tests in section 10 pass.

```
// Crew mode rules — see CREW-SPEC.md sections 4 and 5. Draft: run the emulator tests in firebase/test
// before publishing. Accounts (Firebase Authentication) own users/{uid}; a crew is crews/{crewId} with
// one members/{uid} projection per person, invites/{token} for joining and removed/{uid} block records.
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
    // entry counts are bounded here; Firestore's 1 MiB document limit bounds the rest.
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

Notes

- Rule lookups (`get`, `exists`, `getAfter`) per request, against the limits of 10 per operation and 20 per batch: create crew 4, join 7, list members 1, a member's own update 1, create invite 3, remove someone 2 per delete.
- `get()` and `exists()` see the state before a batch; `getAfter()` sees the state after it. That forces "crew document and creator's member document arrive together", lets the closing batch pass `isCreator` while deleting the creator's own member document, and stops a non-member planting a member document under someone else's crew: the crew document exists, `createdBy` can only move to an existing member, and there is no token.
- A rule that throws (for instance dereferencing a missing document) denies; the `exists()` guards are for clarity.
- Not enforced, on purpose: the `crew` pointer on the user document (only its owner reads it), and the byte size of notes inside the maps (rules cannot iterate a map; a member can bloat only their own document, and every write is attributable).
- `list` on `users` and `crews` is denied, and there is no recursive wildcard, so collection-group queries are denied by the catch-all; ids and tokens cannot be enumerated by signed-in users.
- Whether an active listener gets `permission-denied` when a document its rule depends on is deleted is not documented; the client does not rely on it (section 3).
- Kill switch: if the daily quota is being burned (Firestore returns `resource-exhausted`), publish a copy of the rules with every `allow` set to `if false` from the console. The planner keeps working locally; only sync pauses.

## 6. Sync behaviour

Loading

- The Firebase SDK (`firebase-app`, `firebase-auth`, `firebase-firestore`, modular ES modules from `https://www.gstatic.com/firebasejs/12.18.0/`, about 945 KB uncompressed, cached by the service worker after the first load) is loaded with `import()` only when the device has an account session (`localStorage` key `htlgi-l26-account` holds the uid this device last synced with), when a redirect sign-in is returning, or when the user opens Sign in, Create crew or an invite link. Nobody else downloads anything extra.
- Firestore is initialised with `persistentLocalCache` and `persistentMultipleTabManager`: reads work from cache offline, writes queue until the phone is back online.

Signing in (also the first run on a new device)

1. Sign-in completes. Read `users/{uid}` once from the server.
2. Missing: write the complete document from local state (name from the profile or the sign-up form, `shared: {}`).
3. Present, and this device has never synced with this uid: merge, never discard. Picks: union. Verdicts: union, local wins a conflict. Notes: a note that differs on both sides keeps both texts with `---` between them. Write the merged state up and say "Merged 12 picks from this device into your account". Imports from `#picks=` links were confirmed by the user and count as their picks.
4. Present, and this device last synced with a different uid: replace local state with the account; the previous person's data is in their account.
5. Record the uid in `htlgi-l26-account`. Only now subscribe.

Subscriptions

- `users/{uid}`: apply only when the document exists (a missing document while signed in means the account was deleted elsewhere: stop syncing, keep local, say so). Apply in place: update the in-memory maps, save to `localStorage` (the existing keys, so the signed-out path is unchanged), `render()`. First flush the pending 250 ms note write; if the event sheet is open with its textarea focused, do not rebuild the sheet, and keep the local text for that one note. With those two guards, latency compensation makes each snapshot consistent with this device's own writes.
- `crews/{crew}` and `crews/{crew}/members`, when the pointer is set. Every members snapshot rebuilds the crew state, stores it in `localStorage` (`htlgi-l26-crew-cache`) so the overlay renders on the next cold start before the SDK loads, and re-renders. Removal and closing are detected as in section 3.

Writes

- Every change is one batch: a field-level `updateDoc` on the user document (`picks.41: true` or `deleteField()`, `verdicts.41`, `notes.41`, `shared.41`) with `updatedAt: serverTimestamp()`, plus, while in a crew, the same fields on the member document (notes only when shared; sharing or unsharing updates `shared` and the projection together, which the rules require). Never write a whole map.
- Picks and verdicts write at once; notes keep the existing 250 ms input debounce and write on that. Expected volume: tens of writes a day per person, two per change, far inside 20 000 a day.
- Conflicts: field-level updates merge on the server and in the offline queue; a genuine conflict on one field is last-writer-wins, which is right for a toggle or a note.

Signing out

- Detach listeners, then `signOut()`. Local data stays on the device by default. *Sign out and clear this device* also clears `localStorage`, then `terminate()` and `clearIndexedDbPersistence()`, for a borrowed phone.

Failure modes

- SDK fails to load (no network, artifact copy, blocked): the planner runs from `localStorage` as today; the crew overlay renders from `htlgi-l26-crew-cache` with "last synced …".
- Offline: cached SDK, restored session, cached reads, queued writes. The ID token expires after an hour, but cached reads and queued writes carry on and commit on reconnect.
- `permission-denied` on a crew listener: removal or closing (section 3). On the user document: cannot happen with these rules unless the account is gone; treat as "account deleted elsewhere".
- `resource-exhausted` (daily quota): banner "Sync paused until tomorrow"; the planner keeps working locally.
- Popup blocked, or a redirect that does not come back: the form shows a plain error; email + password is always there.

`#picks=` links stay as they are: they still serve people without accounts and the artifact copy. The move page (section 8) uses a longer form that also carries notes.

## 7. UI

Account (in *My festival*, an "Account" card, plus one line in the first-run nudge)

- Signed out: "Keep your picks on every device" with *Continue with Google* and an email form: email, password, *Sign in*, *Create account* (asks for a name), *Forgot password?*. In standalone iOS the email form comes first until the phone test passes.
- Signed in: name and email, *Change name*, *Add a password* (Google accounts without one), *Sign out*, *Sign out and clear this device*, *Delete account* (two-step confirmation).

Crew (the "Crew" card below it)

- No crew: *Create a crew* (asks for a name), and "Have an invite link? Open it."
- In a crew: the crew name, members with initials and colours, each member's pick count and last sync time, *Invite link*, live invites with *Revoke*, *Leave crew*; for the creator, *Remove* next to each member, *Make owner*, *Close crew*, and a *Removed* list with *Re-admit*.
- Join banner for `#join=` links, cases as in section 3.

Everywhere (unchanged from the first draft)

- Event cards and grid tiles: small initials badges for crew members who picked the event (not you — your star already says so). Colours are per member, assigned in join order from a fixed palette that reads in light and dark.
- Filter strip: a **Crew** chip — events picked by anyone in the crew. It composes with the other filters like the picks chip does.
- Event sheet: a "Going" row under the people pills — "Going: Are, Kari · not yet: Morten" — and a **Join them** button when you have not picked it (it just toggles your pick). Debates: the verdict block shows the crew tally beneath your own vote ("Kari: Hossenfelder · Morten: Draw").
- Notes: a "Share with crew" checkbox under the notes box (off by default). Shared notes from others appear as "Crew notes" with the author's name, read-only.

*My festival* crew section (below your own days)

- **All of you**: events every member picked, by day and time.
- **Where you split**: time slots where members hold different events (with who is where). This is the list to talk through beforehand.
- **Only you / only them**: quick counts, expandable.
- **Crew calendar (.ics)**: the union of everyone's picks; each entry's description starts with "Going: Are, Kari" and your own picks are marked. Same fields as the personal export otherwise.
- **Crew reading list**: the reading-list sheet gets a "Mine / Crew" toggle; crew mode is the union of picks, each item marked with who is going.

Copy and safety

- Every string that comes from another account (names, crew name, shared notes, invite fields) goes through `esc()` before it reaches `innerHTML`; `showBanner()` takes raw HTML, so the join banner escapes its inputs.
- Privacy paragraph (about text, Account card, README), replacing "nothing tracked, no cookies": "If you sign in, your email address, name, picks, debate verdicts, notes and crew are stored in Firebase (Google), in the EU. Only you can read them; people in your crew see your picks, verdicts and the notes you choose to share. The site sets no cookies and has no analytics; Google sign-in opens Google's pages, which do. *Delete account* removes everything."
- "crew" throughout; the invite banner explains in one line that anyone with the link can join until it is revoked.

## 8. Hosting and changes to the repo

Hosting moves to Firebase Hosting so that the auth domain is the site itself and redirect sign-in works in every browser.

- Canonical URL: `https://<project>.firebaseapp.com/`, which is also the default `authDomain`, so nothing needs customising. (`web.app` or a custom domain also work if `authDomain` is set to it and its `/__/auth/handler` URL is added to the Google OAuth client.)
- `firebase.json` at the repo root: hosting (`public: _site`; `Cache-Control: no-cache` for `/`, `/index.html` and `/sw.js`; `public, max-age=31536000, immutable` for `/img/**`), `firestore.rules: firebase/firestore.rules`, emulator ports. `.firebaserc` with the project id.
- Workflows: `firebase init hosting:github` writes `firebase-hosting-pull-request.yml` (a preview channel and a PR comment for every pull request, expiring after seven days) and `firebase-hosting-merge.yml` (live deploy on push to `main`), and stores a service-account secret. Build step in both: `sh scripts/assemble-site.sh _site`, with `"PR #${{ github.event.number }}"` as the second argument in the PR workflow so previews keep their ribbon and `noindex`. Add to the merge workflow a rules deploy (`npx firebase-tools deploy --only firestore:rules`) with the same secret; the service account needs the *Firebase Rules Admin* role for that. Preview channels use the real Firestore project, as PR previews do today. They are separate origins, so they cannot evict the live site's caches; Google sign-in on a preview would need its domain authorized, so test sign-in on `localhost` and the live site. Delete `deploy.yml` and `pr-preview.yml` once the move page is up.
- Move page on GitHub Pages: `move/index.html` in the repo, published once to the root of `gh-pages`. It says "The planner has moved to <new URL>", and one button opens the new site with this device's picks, verdicts and notes in the fragment, `#picks=…&verdicts=…&notes=<base64url JSON>` (notes capped at about 30 KB, longest dropped first with a warning), because `localStorage` does not cross origins. With no local state it redirects at once with `location.replace(NEW + location.hash)`, so old `#event=` and `#picks=` links keep working. `checkHash()` on the new site learns to import `notes` (a note that differs on both sides keeps both). Home-screen apps installed from the old origin show the move page and are reinstalled from the new one.
- URL constants: `PUBLIC_URL` in `scripts/template.html`, the links in the README, `move/index.html`. `manifest.webmanifest` is relative and needs no change. Keep the `.ics` `UID` suffix `@arealmaas.github.io`: it is a namespace, and changing it would duplicate events for anyone who re-imports a calendar.
- `data/firebase.json` (public web config from the console: `apiKey`, `authDomain`, `projectId`, `appId`) → injected into the page as `DATA.firebase` by `scripts/build.py`; when absent, the Account and Crew UI are hidden and the build prints a note. It is public by design; the rules are the security.
- `firebase/firestore.rules`: the rules in section 5. `firebase/test/`: `package.json` (`@firebase/rules-unit-testing`, `firebase-tools`) and `rules.test.mjs`; the app itself stays dependency-free.
- `sw.js`: add `www.gstatic.com` to the stale-while-revalidate hosts; never cache `/__/*` (the auth helpers are same-origin now) or `apis.google.com`; name the cache `htlgi-<scope hash>-<build>` and sweep only caches with the same scope prefix, so two copies of the app on one origin cannot evict each other.
- `scripts/template.html`: an `account` module (auth, sign-in sequence, merge, own-state sync, Account card) and a `crew` module (crews, invites, removal, overlay, hub section, crew calendar, reading-list toggle, join banner, `#join=` and `notes=` handling); about 800 lines together.
- README: hosting and previews, Account and Crew sections, the privacy paragraph, and a line about Safari clearing a site's storage after seven days without a visit (home-screen apps exempt; signing in protects you). `ROADMAP.md`: a Batch 5 entry.

Spark limits that matter: Firestore 50 000 reads, 20 000 writes, 20 000 deletes a day and 1 GiB stored, resetting around 08:00 BST; Hosting 10 GB of transfer a month, about 2 400 first visits (a first visit is about 4.2 MB with the precached photos), after which the site is disabled following a grace period. Blaze keeps the same free allowance and bills beyond it; switch, with a budget alert, if the site gets popular.

## 9. Setup on your side (about 45 minutes)

1. https://console.firebase.google.com → Add project → name it (e.g. `htlgi-planner`; the id becomes the URL), Google Analytics off.
2. Build → Firestore Database → Create database → location `europe-west2` (London) or `eur3` → production mode. Rules tab: paste `firebase/firestore.rules`, Publish. (The `main` workflow republishes them on every deploy once the service account has the Rules Admin role.)
3. Build → Authentication → Get started → Sign-in method: enable *Email/Password* and *Google* (it asks for a public-facing name and a support email). Settings → Authorized domains: the project's `firebaseapp.com` and `web.app` domains and `localhost` are already there; add a custom domain if you use one.
4. Build → Hosting → Get started (the CLI does the rest).
5. Project settings → Your apps → Add app → Web → copy `apiKey`, `authDomain`, `projectId`, `appId` into `data/firebase.json`. Commit it.
6. On your machine: `npm i -g firebase-tools`, `firebase login`, then from the repo root `firebase init hosting` (public directory `_site`, not a single-page app, GitHub deploys yes) and `firebase init hosting:github` (build script `sh scripts/assemble-site.sh _site`, deploy on merge yes). Commit the two workflows, `firebase.json` and `.firebaserc`. IAM → grant the new service account *Firebase Rules Admin*.
7. First deploy: push to `main`; open `https://<project>.firebaseapp.com/`. Then publish `move/` to `gh-pages` once and remove the old workflows.
8. Optional hardening: Google Cloud console → APIs & Services → Credentials → the browser key → Websites: the hosting domains and `localhost`. This is hygiene against key reuse, not a security control. App Check (reCAPTCHA v3) after the festival.

## 10. Testing

- Rules tests against the Firestore emulator (`firebase emulators:exec --only firestore "node --test firebase/test"`, needs Node and a JDK), required before the rules go live: a user reads and writes only their own document, and a partial create is denied; `list` on `users` and `crews` is denied; a non-member cannot read a crew, its members, its invites or its block records; creating a crew without the member document in the batch is denied, with it allowed; joining with a valid token allowed; with an expired, revoked, other-crew or missing token denied; without a token denied; joining while blocked denied, allowed again after the record is deleted; joining a closed crew denied; a member's projection may not contain a note key that is not in their `shared` map; a member cannot change `joinedAt` or `invite` but can drop `invite`; a member cannot delete another member, the creator can; a creator who has left cannot; `createdBy` can move only to an existing member and only by the creator; closing sets the tombstone, `create` on that id is denied, and nothing can be updated afterwards; invite `crewName` and `createdByName` must match; `expiresAt` must be in the future and within 30 days; every allow-list and size cap.
- In-page checks from `?selftest`: the sign-in sequence and merge (create-from-local, union, local-wins verdicts, conflicting notes, different-uid replace), map/array conversion, `#join=` parsing and stripping, `notes=` import, escaping of crew-supplied strings in the banner and overlay, standalone detection.
- Manual matrix before the freeze: desktop Chrome (popup); Safari tab on iPhone (redirect); the installed iOS app: the Google redirect test first, then email + password, then a Google account after *Add a password*; Android Chrome (redirect); airplane mode on one device, then reconnect (queued writes arrive); sign in on a second device and see the same state; remove a member and watch their client drop out; open an invite while signed out and complete account creation; open a preview channel and confirm the live site still works offline; open the old GitHub Pages URL and confirm the move page carries picks, verdicts and notes across.
- Quota sanity: the page logs reads and writes in dev mode; a day of three people is expected to stay under 1 000 reads and 300 writes. Check the console's usage page the day before the festival.

## 11. Effort and schedule

- Tooling and hosting, one day: Node and a JDK for the emulator, `firebase.json` and the first rules test, the hosting move (CLI init, the two workflows with the rules deploy, URL constants, the move page with the notes-carrying link), the `sw.js` cache change.
- Phase 1, accounts and sync, about 1.5 days: console setup, Account card and auth flows (including *Add a password* and standalone detection), the sign-in sequence and merge, own-state sync, sign-out and delete, rules for `users/` with tests, the privacy paragraph, README. Ships value on its own: the same state on every device.
- Phase 2, crews and invites, about 1.5 days: crew, member, invite and block documents, rules with tests, create, join, leave, remove, hand-over and close flows, the overlay, the hub section, the crew calendar, the reading-list toggle.
- About four days against twelve. The console setup is the one dependency; everything else starts now, hosting first so every test runs against the final origin.
- Freeze on Wednesday 17 September; after that only reverts ship. Cut line: if Phase 2 has not passed the manual matrix by then, ship Phase 1 alone and coordinate by `#picks=` links as today. Rollback: revert on `main`; the workflow redeploys; the page is network-first in the service worker, so every online device picks it up on the next load.

## 12. Open questions and deferred work

- Member colours: six, in join order; past six they repeat. Fine for three.
- "Join them" does not copy the other member's Fast Pass note: Fast Passes are personal purchases; the sheet keeps showing the ticketing line as today.
- Crew verdicts are visible before you have voted yourself: yes; it is a festival, not a poll.
- Deferred: App Check; Blaze; several crews per person (the data model allows it, the UI does not); guest accounts with a later upgrade; a subscribable calendar feed (needs server code).
