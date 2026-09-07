// src/ui/CrewBadges.jsx — ports the old page's crewBadges(no): the initials dots of the crew members
// other than me who picked this event (my own star already says I am going), coloured by join order.
// CREW-SPEC section 7 "Everywhere". Rendered on every event card and grid tile; nothing at all without a
// crew, which is also the CLOUD-off case. Names render as text — never innerHTML. Gated on selectMyUid
// rather than on `user`, so the cached crew painted on a cold or offline start carries its badges.
import {useCloud, selectMyUid} from '../store/cloud.js';
import {memberColour, pickedBy} from '../core/crew.js';
import {initials} from '../core/labels.js';

// the strand colour of a member, by join order; the dot itself is .cdot in the stylesheet. It lives here,
// the smallest module that draws one, so the hub's Crew card and the card badges cannot drift apart.
export const memberStyle = i => ({'--c': `var(--${memberColour(i)})`});

export default function CrewBadges({no}){
  const crew = useCloud(s => s.crew);
  const myUid = useCloud(selectMyUid);
  if (!crew || !myUid) return null;

  const who = pickedBy(crew.members, myUid, no);
  if (!who.length) return null;

  return (
    <span className="cbadges">
      {who.map(m => (
        <i key={m.uid} className="cdot" style={memberStyle(crew.members.indexOf(m))} title={m.name}>{initials(m.name)}</i>
      ))}
    </span>
  );
}
