// tests/live/accounts.mjs — the two test accounts for the live crew flow, from the environment
// (`.env.local`, loaded by the npm scripts with `node --env-file-if-exists`; `.env.example` lists the
// names), and one Firebase app per account: switching users on a shared instance is a source of
// confusing refusals, and two instances cost nothing.
import {initializeApp} from 'firebase/app';
import {getAuth, signInWithEmailAndPassword} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore';
import fs from 'node:fs';

const NAMES = ['HTLGI_TEST_A_EMAIL', 'HTLGI_TEST_A_PASSWORD', 'HTLGI_TEST_B_EMAIL', 'HTLGI_TEST_B_PASSWORD'];
export function accounts(){
  const missing = NAMES.filter(n => !process.env[n]);
  if (missing.length) {
    console.error(`Missing ${missing.join(', ')}. Put the two test accounts in .env.local (see .env.example).`);
    process.exit(2);
  }
  return {
    A: {label: 'A', email: process.env.HTLGI_TEST_A_EMAIL, password: process.env.HTLGI_TEST_A_PASSWORD},
    B: {label: 'B', email: process.env.HTLGI_TEST_B_EMAIL, password: process.env.HTLGI_TEST_B_PASSWORD},
  };
}
export function config(){
  if (!fs.existsSync('data/firebase.json')) { console.error('data/firebase.json is missing: there is no live project to test against.'); process.exit(2); }
  return JSON.parse(fs.readFileSync('data/firebase.json', 'utf8'));
}
// signs one account in on an app of its own; returns {user, db}
export async function signIn(who){
  const app = initializeApp(config(), who.email);
  const {user} = await signInWithEmailAndPassword(getAuth(app), who.email, who.password);
  return {user, db: getFirestore(app)};
}
