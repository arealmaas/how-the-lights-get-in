// src/ui/event/CrewRow.jsx — ports the old page's crewRow(e): under the event's actions, who in the crew
// is going and who has not picked it yet, a "Join them" button while I have not, the crew's verdict tally
// on debates, and the notes other members chose to share (CREW-SPEC section 7 "Everywhere").
// Everything that comes from another account — names, verdicts, note text — is rendered as text by React,
// which is what replaces the old page's esc(): there is no innerHTML here.
import {useCloud} from '../../store/cloud.js';
import {usePlanner} from '../../store/planner.js';
import {pickedBy} from '../../core/crew.js';
import {others} from '../../cloud/crew.js';

const names = ms => ms.map(m => m.name).join(', ');
// the old page's paras(): blank-line or single-line breaks become paragraphs, never markup
const paras = s => String(s).split(/\n{2,}|\n/).filter(Boolean);

export default function CrewRow({e}){
  const crew = useCloud(s => s.crew);
  const user = useCloud(s => s.user);
  const picks = usePlanner(s => s.picks);
  if (!crew || !user) return null;

  const no = e.eventNo;
  const rest = others();
  const going = pickedBy(crew.members, user.uid, no);
  const notYet = rest.filter(m => !(m.picks && m.picks[no]));
  const line = going.length
    ? `Going: ${names(going)}${notYet.length ? ` · not yet: ${names(notYet)}` : ''}`
    : (rest.length ? 'Nobody in the crew has picked this yet.' : 'You are the only one in the crew so far.');
  const tally = e.type === 'Debates'
    ? rest.filter(m => m.verdicts && m.verdicts[no]).map(m => `${m.name}: ${m.verdicts[no]}`).join(' · ')
    : '';
  const notesFrom = rest.filter(m => m.notes && m.notes[no] && String(m.notes[no]).trim());

  return (
    <>
      <div className="going">
        <span className="lab">Crew</span>
        <span>{line}</span>
        {going.length > 0 && !picks.has(no) && (
          <button type="button" className="btn primary" onClick={() => usePlanner.getState().togglePick(no)}>Join them</button>
        )}
      </div>
      {tally && <p className="tally">Crew verdicts — {tally}</p>}
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
