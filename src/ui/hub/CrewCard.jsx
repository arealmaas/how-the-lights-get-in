// src/ui/hub/CrewCard.jsx — the Crew card in My festival (CREW-SPEC section 7). Ported from the old
// page's crewCard() plus the data-crew-* click handlers. Two differences from the template, both
// deliberate: the crew names are typed into an inline form instead of window.prompt() (a prompt cannot be
// driven by a test and blocks the page), and Copy says "Copied" for two seconds instead of rewriting its
// own textContent. Destructive actions keep window.confirm, as the old page had them — the confirmations
// live in cloud/crew.js next to the batches they guard.
// A third: the card is gated on selectMyUid, not on `user`, so a cold or offline start shows the crew
// hydrateCrewCache() painted, with "last synced 13:45" instead of "live" (CREW-SPEC section 6, "Failure
// modes"). The actions row is offered from that first paint: each action in cloud/crew.js checks the SDK
// and the session itself and says "Still connecting; try again in a moment.", which is a truer answer than
// a row of buttons appearing a second late. crewOwnedByMe() is false until there is a session, so the
// owner-only controls stay hidden anyway.
import {Fragment, useEffect, useRef, useState} from 'react';
import {useCloud, selectMyUid} from '../../store/cloud.js';
import {initials} from '../../core/labels.js';
import {memberStyle} from '../CrewBadges.jsx';
import {
  crewOwnedByMe, liveInvites, inviteLink,
  createCrew, renameCrew, leaveCrew, closeCrew,
  removeMember, readmit, makeOwner, createInvite, revokeInvite,
} from '../../cloud/crew.js';

function NamePrompt({label, initial, onSave, onCancel}){
  const [value, setValue] = useState(initial);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <form className="authform" onSubmit={ev => { ev.preventDefault(); onSave(value); }}>
      <input ref={ref} type="text" name="crewname" maxLength={60} aria-label={label} placeholder={label} value={value} onChange={ev => setValue(ev.target.value)} />
      <div className="actions">
        <button type="submit" className="btn primary">Save</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

const hhmm = ms => new Date(ms).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});

function CopyButton({url}){
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button type="button" className="btn small" onClick={() => { try { navigator.clipboard.writeText(url).then(() => setCopied(true), () => {}); } catch (e) {} }}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function CrewCard(){
  const user = useCloud(s => s.user);
  const myUid = useCloud(selectMyUid);
  const crew = useCloud(s => s.crew);
  const [prompt, setPrompt] = useState('');   // '' | 'create' | 'rename'

  useEffect(() => { setPrompt(''); }, [user, crew && crew.id]);

  // No crew to paint: creating one needs the SDK and a signed-in session, so this half still waits for
  // `user`; there is nothing cached to show a device that has not finished signing in.
  if (!crew) {
    if (!user) return null;
    return (
      <div className="hub-card crew">
        <span className="hc-k">Crew</span>
        <span className="hc-d">See who’s going where, where you split, and the notes your friends share. Create a crew and send an invite link, or open the link a friend sent you.</span>
        <span className="hc-d">Have an invite link? Open it.</span>
        <div className="actions">
          <button type="button" className="btn primary" onClick={() => setPrompt('create')}>Create a crew</button>
        </div>
        {prompt === 'create' && (
          <NamePrompt label="Name your crew" initial="The Heath Three" onSave={name => { setPrompt(''); createCrew(name); }} onCancel={() => setPrompt('')} />
        )}
      </div>
    );
  }
  if (!myUid) return null;   // a crew but no identity to compare its members against: nothing to say yet

  const owner = crewOwnedByMe();
  const invites = liveInvites();
  const removed = crew.removed || [];
  const synced = crew.syncedAt ? (crew.live ? 'live' : 'last synced ' + hhmm(crew.syncedAt)) : 'not synced yet';

  return (
    <div className="hub-card crew">
      <span className="hc-k">Crew · {synced}</span>
      <b className="cname-h">{crew.name}</b>
      <ul className="members">
        {crew.members.map((m, i) => (
          <li key={m.uid}>
            <i className="cdot" style={memberStyle(i)}>{initials(m.name)}</i>
            <span className="cname">{m.name}{m.uid === myUid ? ' (you)' : ''}{m.uid === crew.createdBy ? ' · owner' : ''}</span>
            <span className="cpicks">{Object.keys(m.picks || {}).length} picks{m.updatedAt ? ' · synced ' + hhmm(m.updatedAt) : ''}</span>
            {owner && m.uid !== myUid && (
              <>
                <button type="button" className="btn small" onClick={() => makeOwner(m.uid)}>Make owner</button>
                <button type="button" className="btn small" onClick={() => removeMember(m.uid)}>Remove</button>
              </>
            )}
          </li>
        ))}
      </ul>
      {invites.length > 0 && (
        <ul className="members invites">
          {invites.map(i => (
            <li key={i.token}>
              <span className="cname">Invite by {i.createdByName} · until {new Date(i.expiresAt.toMillis()).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}</span>
              <CopyButton url={inviteLink(i.token)} />
              <button type="button" className="btn small" onClick={() => revokeInvite(i.token)}>Revoke</button>
            </li>
          ))}
        </ul>
      )}
      {owner && removed.length > 0 && (
        <p className="src">
          Removed: {removed.map((r, n) => (
            <Fragment key={r.uid}>
              {n > 0 ? ' · ' : ''}{r.name || 'someone'} <button type="button" className="linkbtn" onClick={() => readmit(r.uid)}>re-admit</button>
            </Fragment>
          ))}
        </p>
      )}
      <div className="actions">
        <button type="button" className="btn primary" onClick={() => createInvite()}>Invite link</button>
        <button type="button" className="btn" onClick={() => setPrompt('rename')}>Rename</button>
        <button type="button" className="btn" onClick={() => leaveCrew(false)}>Leave crew</button>
        {owner && <button type="button" className="btn" onClick={() => closeCrew(false)}>Close crew</button>}
      </div>
      {prompt === 'rename' && (
        <NamePrompt label="Crew name" initial={crew.name} onSave={name => { setPrompt(''); renameCrew(name); }} onCancel={() => setPrompt('')} />
      )}
    </div>
  );
}
