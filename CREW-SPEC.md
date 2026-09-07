# Crew mode — specification

Status: draft for review, 7 September 2026. Backend: Firebase Cloud Firestore (free Spark plan). Shares picks, debate verdicts and opt-in notes between the people going together. No accounts, no sign-in: a crew is a passphrase.

## 1. Goals and non-goals

Goals

- Three (or more) people see each other's picks in the planner, on the phone, at the festival: who is going where, where the crew splits, one crew calendar, one crew reading list, a verdict tally on debates, and notes a member chooses to share.
- Joining is typing a passphrase. Creating a crew is typing a new passphrase. Nothing else.
- Your own planner keeps working exactly as today when offline or when the crew feature is off. Own picks are local-first; the crew is an overlay.
- The server never sees readable data: member data is encrypted on the phone with a key derived from the passphrase.

Non-goals

- No subscribable calendar feed (would need plain-text picks on the server). The crew calendar is an `.ics` export, like today's.
- No presence, chat, or per-event comments beyond shared notes.
- No admin roles. Everyone with the passphrase is equal; leaving deletes your own entry.
- The claude.ai artifact copy does not get crew mode (its sandbox cannot load the SDK or reach Firestore); it shows a note pointing to the public site.

## 2. The crew model

Passphrase → two secrets, derived on the device with WebCrypto:

```
norm      = passphrase.trim().toLowerCase().replace(/\s+/g, ' ')
material  = PBKDF2-SHA256(norm, salt = "htlgi-london-2026-crew", 300 000 iterations, 512 bits)
crewId    = base64url(material[0..32])                 // 43 characters, the Firestore document id
crewKey   = AES-GCM-256 key from material[32..64]      // never leaves the device
```

- Anyone deriving the same `crewId` reads the same documents; anyone with the same `crewKey` can decrypt them. Both come from the passphrase, so the passphrase is the whole membership. Suggested passphrases are three random words; the UI proposes one when creating.
- PBKDF2 at 300k iterations takes roughly 0.2–0.5 s on a phone, once per join; the derived key is cached in `localStorage` (`htlgi-l26-crew`) as a raw key so later loads do not re-derive. Storing the passphrase itself is optional (needed only to show it again for passing on) — stored, with a "reveal" toggle, because everyone in the crew knows it anyway.
- Rotation: there is none. If the passphrase leaks, create a new crew and re-join; the old documents can be deleted by any member (each member deletes their own entry when leaving).

Member identity

- `memberId`: a random 16-byte id generated when a device joins, stored locally. One document per device.
- The decrypted payload carries the display name typed at join. The UI groups members by name (case-insensitive), so one person on phone and laptop appears once, with the union of both devices' picks. Same name = same person, by design; the join screen says so.

## 3. Data layout and encryption

Firestore:

```
crews/{crewId}/members/{memberId}
  blob:      string   base64 AES-GCM ciphertext of the payload JSON (≤ 32 768 chars)
  iv:        string   base64 12-byte nonce, fresh on every write
  v:         number   1
  updatedAt: timestamp   serverTimestamp()
```

Payload (plain, before encryption):

```json
{
  "name": "Are",
  "crewName": "The Heath Three",
  "picks": [3, 6, 41],
  "verdicts": {"6": "Sabine Hossenfelder", "43": "Draw"},
  "notes": {"41": "Ask about the mirror universe paper"},
  "updatedAt": "2026-09-07T10:12:00Z",
  "app": 4
}
```

- `notes` contains only notes the member marked "share with crew". Unshared notes never leave the device.
- `crewName` is set by whoever creates the crew and adopted by joiners (it is encrypted like everything else, so the crew is nameless until you are in).
- Size: 135 picks, a few verdicts and a handful of notes is a few KB. The rules cap the ciphertext at 32 KB; the app trims shared notes to fit and warns.
- No document at `crews/{crewId}` itself; the crew exists as soon as one member document exists. Listing the `members` subcollection is the only read.

Security rules (`firebase/firestore.rules` in the repo):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /crews/{crew}/members/{member} {
      allow read: if crew.size() == 43 && member.size() <= 40;
      allow create, update: if crew.size() == 43 && member.size() <= 40
        && request.resource.data.keys().hasOnly(['blob', 'iv', 'v', 'updatedAt'])
        && request.resource.data.blob is string && request.resource.data.blob.size() <= 32768
        && request.resource.data.iv is string && request.resource.data.iv.size() <= 32
        && request.resource.data.v == 1
        && request.resource.data.updatedAt == request.time;
      allow delete: if crew.size() == 43;
    }
    match /{document=**} { allow read, write: if false; }
  }
}
```

The database is world-readable and world-writable *at unguessable ids* and nowhere else; documents must have exactly the four fields with bounded sizes. Nothing readable is stored. Optional hardening later: restrict the browser API key to the site's referrers (`arealmaas.github.io/*`, plus `localhost` for testing) in the Google Cloud console; App Check is overkill for a fan site.

## 4. Sync behaviour

- The Firebase SDK (`firebase-app`, `firebase-firestore`, modular ES modules from `https://www.gstatic.com/firebasejs/12.18.0/`) is loaded lazily with `import()` only when the device has a crew or the user opens the join form. Users without a crew download nothing extra. The service worker adds `www.gstatic.com` to its stale-while-revalidate hosts so the SDK is available offline once fetched.
- Firestore is initialised with persistent local cache (`persistentLocalCache` + `persistentMultipleTabManager`), so reads work from cache offline and writes queue until the phone is back online.
- Subscribe: one `onSnapshot` on `crews/{crewId}/members`. On every snapshot: decrypt each document (skip any that fail — wrong key or junk), rebuild the crew state, store it in `localStorage` (`htlgi-l26-crew-cache`) so the crew overlay renders instantly on the next cold start even before the SDK loads, then re-render.
- Publish: any local change to picks, verdicts or shared notes marks the member dirty; a debounced write (1.5 s) encrypts the payload and `setDoc`s the member document. Firestore's offline queue holds it if the phone is offline. Expected volume: tens of writes a day per person — far inside the 20 000/day quota.
- Conflicts: last-writer-wins per member document, which is the right semantics — each device only ever writes its own document.
- Leaving: "Leave crew" deletes the member document and clears local crew state; picks, notes and verdicts stay local. "Remove member" (for stale devices) deletes another member's document after a confirmation; anyone can, it is a crew of friends.
- Failure modes: SDK fails to load (no network, artifact copy, blocked) → the crew overlay renders from the local cache and shows "last synced …"; decryption fails for a document → it is ignored, and if *all* documents fail after a join the UI says "no crew found for that passphrase — create it?".

## 5. UI

Join and create (in *My festival*, a "Crew" card, and a first-run nudge on the empty state)

- Fields: your name (prefilled from last time), passphrase. Buttons: "Join" (derives, subscribes; if no members exist it offers "Create this crew"), "Create" (proposes a three-word passphrase, asks for a crew name).
- After joining, the card shows the crew name, members with initials and colours, each member's pick count and last-sync time, "Reveal passphrase" (to pass it on), "Leave crew".

Everywhere

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

Copy and tone: "crew" throughout; the join card explains in one line that the passphrase is the only key and that anyone who has it is in.

## 6. Changes to the repo

- `data/firebase.json` (public web config, pasted from the console) → injected into the page as `DATA.firebase`; when absent, the crew UI is hidden and the build prints a note.
- `firebase/firestore.rules` — the rules above, kept in the repo for reference and for `firebase deploy --only firestore:rules` if the CLI is ever used; pasting into the console is fine.
- `scripts/template.html`: crew module (~400 lines): crypto helpers, store abstraction (`CrewStore` with `subscribe`, `set`, `delete`) with a Firestore implementation and an in-memory fake for tests, state, rendering hooks in cards, grid, event sheet, hub, reading list and verdicts.
- `sw.js`: add `www.gstatic.com` to cacheable hosts.
- README: a "Crew" section (how it works, the privacy model, the setup steps).

## 7. Setup on your side (about 15 minutes)

1. https://console.firebase.google.com → Add project → name it (e.g. `htlgi-planner`), Google Analytics off.
2. Build → Firestore Database → Create database → location `europe-west2` (London) or `eur3` → **production mode**.
3. Rules tab → replace with the contents of `firebase/firestore.rules` → Publish.
4. Project settings → Your apps → Add app → Web (`</>`) → name it, no hosting → copy the `firebaseConfig` object → save it as `data/firebase.json` (keys: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
5. Optional hardening: Google Cloud console → APIs & Services → Credentials → the "Browser key (auto created by Firebase)" → Application restrictions: Websites → add `arealmaas.github.io/*` and `localhost/*`.
6. Commit `data/firebase.json` (it is public by design; the rules are the security) and push. The PR preview builds share the same project.

## 8. Testing

- Unit-style checks in the page (run from a `?selftest` flag during development): derive → encrypt → decrypt round-trip; same passphrase with different spacing/case → same id; wrong passphrase → decryption fails cleanly.
- Playwright against the in-memory fake store: two browser contexts join the same passphrase, picks appear on the other side within a second, badges/filter/"where you split"/tally/shared notes render, leave removes the member, offline cache renders on reload with the store unavailable.
- Smoke test against the real project once `data/firebase.json` exists: two devices, one passphrase, toggle picks both ways, airplane mode on one device then reconnect (queued write arrives), a wrong passphrase gets the "no crew found" path.
- Quota sanity: the page logs reads/writes in dev mode; a day of three people is expected to stay under 1 000 reads and 200 writes.

## 9. Effort

About a day of work: crypto and store (2 h), UI overlay (4 h), hub section, crew calendar and reading list (2 h), tests and docs (2 h). Your setup runs in parallel; the real-project smoke test needs the config, so that is the one dependency.

## 10. Open questions

- Member colours: fixed palette of six, in join order — fine for three; if a crew grows past six, colours repeat.
- Should "Join them" also copy the other member's Fast Pass note? No — Fast Passes are personal purchases; the sheet keeps showing the ticketing line as today.
- Should the crew's shared verdicts be visible before you have voted yourself? Yes, they are shown; it is a festival, not a poll.
