// src/ui/event/CrewRow.jsx — the "Going" row of CREW-SPEC section 7 "Everywhere", directly under the
// people pills: who in the crew is going and who has not picked it yet, a "Join them" button while I have
// not, and the notes other members chose to share. The debate tally is CrewTally, beneath my own vote.
// Everything that comes from another account — names, note text — is rendered as text by React, which is
// what replaces the old page's esc(): there is no innerHTML here.
import {useCloud} from '../../store/cloud.js';
import {usePlanner} from '../../store/planner.js';
import {pickedBy, goingNames} from '../../core/crew.js';
import {others} from '../../cloud/crew.js';

// the old page's paras(): blank-line or single-line breaks become paragraphs, never markup
const paras = s => String(s).split(/\n{2,}|\n/).filter(Boolean);

export default function CrewRow({e}){
  const crew = useCloud(s => s.crew);
  const user = useCloud(s => s.user);
  const accountName = useCloud(s => s.accountName);
  const picks = usePlanner(s => s.picks);
  if (!crew || !user) return null;

  const no = e.eventNo;
  const rest = others();
  // "Going" names me first when I have picked it; "not yet" is only ever the others, since Join them is
  // my own affordance. Join them asks about them, not me: it appears when someone else is going and I
  // have not starred it, even in the moment my own member document is a snapshot behind my local picks.
  const going = goingNames(crew.members, user.uid, picks, no, accountName || 'you');
  const othersGoing = pickedBy(crew.members, user.uid, no);
  const notYet = rest.filter(m => !(m.picks && m.picks[no]));
  const line = !rest.length
    ? 'You are the only one in the crew so far.'
    : going.length
      ? `Going: ${going.join(', ')}${notYet.length ? ` · not yet: ${notYet.map(m => m.name).join(', ')}` : ''}`
      : 'Nobody in the crew has picked this yet.';
  const notesFrom = rest.filter(m => m.notes && m.notes[no] && String(m.notes[no]).trim());

  return (
    <>
      <div className="going">
        <span className="lab">Crew</span>
        <span>{line}</span>
        {othersGoing.length > 0 && !picks.has(no) && (
          <button type="button" className="btn primary" onClick={() => usePlanner.getState().togglePick(no)}>Join them</button>
        )}
      </div>
      {notesFrom.length > 0 && (
        <>
          <h3 className="sub">Crew notes</h3>
          {notesFrom.map(m => (
            <div className="crewnote" key={m.uid}>
              <b>{m.name}</b>
              {paras(String(m.notes[no]).slice(0, 20000)).map((t, i) => <p key={i}>{t}</p>)}
            </div>
          ))}
        </>
      )}
    </>
  );
}
