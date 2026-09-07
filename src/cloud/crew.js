// src/cloud/crew.js — the crew layer (crews/{id}, its members, invites and block records) arrives in a
// later task. Until then this module is the seam auth.js and sync.js call into: every export is a no-op
// with the shape the real module will have, so the ported sign-in, snapshot and sign-out sequences keep
// their original call order and nothing has to be rewritten when the real one lands.
export function onPointer(){}              // the users/{uid}.crew pointer changed (or was re-applied)
export function crewOwnedByMe(){ return false; }
export function unsubscribeCrew(){}
export function offerJoin(){}
export function afterSubscribe(){}         // runs after the user document is subscribed
export function onDenied(){}               // permission-denied on a crew listener: removed, or the crew closed
export function pendingJoin(){ return null; }
