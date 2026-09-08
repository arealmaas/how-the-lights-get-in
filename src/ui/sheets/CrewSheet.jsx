// src/ui/sheets/CrewSheet.jsx — the crew on a screen of its own, reached from the masthead's Crew button.
// It holds what used to be the "Account and crew" half of the hub: the crew card (members, invites, the
// owner's controls) and CrewSection's crew view — All of you, Where you split, the two expanders, the crew
// calendar and the crew reading list — with the account card under them. The hub is picks and reading now.
//
// The account lives here rather than in the hub because signing in is the first step of having a crew, and
// this is the only screen that offers it: a signed-out visitor pressing Crew has to land somewhere they can
// sign in. Which is also why Masthead shows the button before anyone has an account.
//
// Gated on selectMyUid rather than on `user`, like CrewCard and useInCrew: a cold or offline start knows
// who it is from the account marker and paints the cached crew before the SDK has produced a session
// (CREW-SPEC section 6, "Failure modes").
import {useCloud, selectMyUid} from '../../store/cloud.js';
import AccountCard from '../hub/AccountCard.jsx';
import CrewCard from '../hub/CrewCard.jsx';
import CrewSection from '../hub/CrewSection.jsx';

export default function CrewSheet(){
  const myUid = useCloud(selectMyUid);
  const crew = useCloud(s => s.crew);
  const inCrew = !!(crew && myUid);

  // Signed in, the crew card below says what a crew is and offers to make one, so the lead only reports.
  // Signed out there is no crew card — CrewCard has nothing to draw without an identity — so the lead is
  // the only thing that explains why this screen exists.
  const lead = inCrew
    ? `${crew.members.length} of you${crew.live ? '' : ' · last synced copy'}`
    : myUid
      ? 'Not in a crew yet.'
      : 'See who’s going where, where you split, and the notes your friends share. Sign in to make a crew, or to open an invite a friend sent you.';

  return (
    <>
      <div className="kicker"><span>Crew</span></div>
      <h2 id="sheet-title" tabIndex={-1}>{inCrew ? crew.name : 'Your crew'}</h2>
      <p className="src">{lead}</p>
      {myUid ? (
        <>
          <div className="hub-cards"><CrewCard /></div>
          <CrewSection />
          {/* no heading over the account card: it carries its own, and two "Account" labels in a row read
              as a mistake rather than as structure */}
          <div className="hub-cards"><AccountCard /></div>
        </>
      ) : (
        <div className="hub-cards"><AccountCard /></div>
      )}
    </>
  );
}
