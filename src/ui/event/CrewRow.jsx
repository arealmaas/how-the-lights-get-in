// src/ui/event/CrewRow.jsx — the "Going" row of CREW-SPEC section 7 "Everywhere", directly under the
// people pills: who in the crew is going, who has not picked it yet, and a "Join them" button while I have
// not. The debate tally is CrewTally (beneath my own vote) and the shared notes are CrewNotes (beside my
// own notes box). Names render as text by React, which is what replaces the old page's esc().
// Gated on selectMyUid rather than on `user`: a cold or offline start has the cached crew but no SDK yet.
import {useCloud, selectMyUid} from '../../store/cloud.js';
import {usePlanner} from '../../store/planner.js';
import {pickedBy, goingNames} from '../../core/crew.js';

export default function CrewRow({e}){
  const crew = useCloud(s => s.crew);
  const myUid = useCloud(selectMyUid);
  const accountName = useCloud(s => s.accountName);
  const picks = usePlanner(s => s.picks);
  if (!crew || !myUid) return null;

  const no = e.eventNo;
  const rest = crew.members.filter(m => m.uid !== myUid);
  // "Going" names me first when I have picked it; "not yet" is only ever the others, since Join them is
  // my own affordance. Join them asks about them, not me: it appears when someone else is going and I
  // have not starred it, even in the moment my own member document is a snapshot behind my local picks.
  const going = goingNames(crew.members, myUid, picks, no, accountName || 'you');
  const othersGoing = pickedBy(crew.members, myUid, no);
  const notYet = rest.filter(m => !(m.picks && m.picks[no]));
  const line = !rest.length
    ? 'You are the only one in the crew so far.'
    : going.length
      ? `Going: ${going.join(', ')}${notYet.length ? ` · not yet: ${notYet.map(m => m.name).join(', ')}` : ''}`
      : 'Nobody in the crew has picked this yet.';

  return (
    <div className="going">
      <span className="lab">Crew</span>
      <span>{line}</span>
      {othersGoing.length > 0 && !picks.has(no) && (
        <button type="button" className="btn primary" onClick={() => usePlanner.getState().togglePick(no)}>Join them</button>
      )}
    </div>
  );
}
