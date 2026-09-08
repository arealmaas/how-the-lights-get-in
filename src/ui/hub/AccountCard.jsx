// src/ui/hub/AccountCard.jsx — the Account card in My festival (CREW-SPEC section 7). Ported from the old
// page's accountCard() plus the data-auth-* click handlers: the two states, both forms, the sign-out
// confirmations and the privacy link. The forms are real <form onSubmit> elements, so Enter submits the
// primary action — the old page needed a document-level keydown handler for that. Messages are local
// state under the form; anything the whole app should hear about goes to the banner store instead.
// Change name opens the same inline NamePrompt the Crew card uses, rather than window.prompt().
import {useEffect, useRef, useState} from 'react';
import {useCloud} from '../../store/cloud.js';
import {useSheet} from '../../store/sheet.js';
import {STANDALONE, IOS} from '../../cloud/platform.js';
import NamePrompt from '../NamePrompt.jsx';
import {signInGoogle, emailAction, changeName, signOutUser, deleteAccount} from '../../cloud/auth.js';

function showPrivacy(){
  useSheet.getState().close();
  document.getElementById('privacy')?.scrollIntoView({behavior: 'smooth', block: 'start'});
}

const PrivacyLine = () => (
  <>Where this is stored and who sees it: <button type="button" className="linkbtn" onClick={showPrivacy}>privacy</button>.</>
);

export default function AccountCard(){
  const user = useCloud(s => s.user);
  const accountName = useCloud(s => s.accountName);
  const marker = useCloud(s => s.marker);
  const syncPending = useCloud(s => s.syncPending);
  const syncStopped = useCloud(s => s.syncStopped);

  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  // The signed-out form has two steps. It starts on 'signin' with only an email and a password; it moves to
  // 'register' when emailAction says the failure might mean there is no account yet, which is as much as
  // Firebase will tell us (see cloud/auth.js). Editing either field puts it back, so correcting a password
  // signs in rather than quietly creating a second account under a mistyped address.
  const [step, setStep] = useState('signin');
  const emailRef = useRef(null);
  const pwRef = useRef(null);
  const nameRef = useRef(null);

  // Signing in or out swaps the card: start the new one closed and empty, with the account's email
  // pre-filled for "Add a password" the way the old card's value= did.
  useEffect(() => { setOpen(false); setRenaming(false); setMsg(''); setPassword(''); setName(''); setStep('signin'); setEmail((user && user.email) || ''); }, [user]);
  // Opening the form puts the caret where the old page put it: the email field, or the password field
  // when it was opened by "Add a password".
  useEffect(() => { if (open) (user ? pwRef.current : emailRef.current)?.focus(); }, [open, user]);
  // Reaching the registration step puts the caret in the field it appeared for.
  useEffect(() => { if (step === 'register') nameRef.current?.focus(); }, [step]);

  // Back to step one whenever the credentials themselves change: what came back was about those, and the
  // same answer may not apply to the new ones.
  const editCredential = set => value => { set(value); setStep('signin'); };

  async function run(kind){
    setBusy(true);
    setMsg('');
    const {text, newHere} = await emailAction(kind, {email, password, name});
    setBusy(false);
    setMsg(text || '');
    if (newHere !== undefined) setStep(newHere ? 'register' : 'signin');
    // a linked password is done with: the old card re-rendered closed, and "Add a password" is gone
    if (kind === 'link' && !text) { setOpen(false); setPassword(''); }
  }

  if (!user) {
    const google = <button key="g" type="button" className="btn primary" disabled={busy} onClick={() => signInGoogle()}>Continue with Google</button>;
    const mail = <button key="e" type="button" className="btn" onClick={() => setOpen(o => !o)}>Use email and password</button>;
    return (
      <div className="hub-card account">
        <span className="hc-k">Account</span>
        <span className="hc-d">Keep your picks, verdicts and notes on every device, and join a crew.</span>
        <span className="hc-d"><PrivacyLine /></span>
        <div className="actions">{STANDALONE && IOS ? [mail, google] : [google, mail]}</div>
        {STANDALONE && IOS && <span className="hc-d">In the installed app, email and password is the reliable way in.</span>}
        <form className="authform" noValidate hidden={!open} onSubmit={ev => { ev.preventDefault(); run(step === 'register' ? 'create' : 'signin'); }}>
          <input ref={emailRef} type="email" name="email" placeholder="Email" autoComplete="email" required value={email} onChange={ev => editCredential(setEmail)(ev.target.value)} />
          <input type="password" name="password" placeholder="Password (8 or more characters)" autoComplete={step === 'register' ? 'new-password' : 'current-password'} minLength={8} value={password} onChange={ev => editCredential(setPassword)(ev.target.value)} />
          {step === 'register' && (
            <input ref={nameRef} type="text" name="name" placeholder="Your name, as your crew sees it" maxLength={40} autoComplete="name" required value={name} onChange={ev => setName(ev.target.value)} />
          )}
          <div className="actions">
            <button type="submit" className="btn primary" disabled={busy}>{step === 'register' ? 'Create account' : 'Sign in'}</button>
            <button type="button" className="btn" disabled={busy} onClick={() => run('reset')}>Forgot password?</button>
          </div>
          <p className="src">{msg}</p>
        </form>
      </div>
    );
  }

  const hasPw = (user.providerData || []).some(p => p.providerId === 'password');
  const sync = syncStopped
    ? 'Sync stopped: this account was deleted on another device; sign out and in again to start afresh.'
    : syncPending || !marker
      ? 'Signed in, not synced yet — you were offline; it will catch up when you are back online.'
      : 'Your picks, verdicts and notes follow this account.';

  return (
    <div className="hub-card account">
      <span className="hc-k">Account</span>
      <span className="hc-d">
        Signed in as <b>{accountName}</b>{user.email ? ` · ${user.email}` : ''}. {sync} <PrivacyLine />
      </span>
      <div className="actions">
        <button type="button" className="btn" onClick={() => setRenaming(r => !r)}>Change name</button>
        {!hasPw && <button type="button" className="btn" onClick={() => setOpen(true)}>Add a password</button>}
        <button type="button" className="btn" onClick={() => { if (confirm('Sign out? Your picks and notes stay in this browser for when you sign back in; signing in with a different account replaces them. On a shared computer use “Sign out and clear this device” instead.')) signOutUser(false); }}>Sign out</button>
        <button type="button" className="btn" onClick={() => { if (confirm('Sign out and remove all picks, notes and crew data from this device?')) signOutUser(true); }}>Sign out and clear this device</button>
        <button type="button" className="btn" onClick={() => deleteAccount()}>Delete account</button>
      </div>
      <form className="authform" noValidate hidden={!open} onSubmit={ev => { ev.preventDefault(); run('link'); }}>
        <input type="email" name="email" placeholder="Email" autoComplete="email" value={email} onChange={ev => setEmail(ev.target.value)} />
        <input ref={pwRef} type="password" name="password" placeholder="New password (8 or more characters)" autoComplete="new-password" minLength={8} value={password} onChange={ev => setPassword(ev.target.value)} />
        <div className="actions"><button type="submit" className="btn primary" disabled={busy}>Save password</button></div>
        <p className="src">{msg}</p>
      </form>
      {renaming && (
        <NamePrompt label="Your name, as your crew sees it" initial={accountName} maxLength={40}
          onSave={next => { setRenaming(false); changeName(next); }} onCancel={() => setRenaming(false)} />
      )}
    </div>
  );
}
