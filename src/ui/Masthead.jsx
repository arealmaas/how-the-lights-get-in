// src/ui/Masthead.jsx — ported from the old <header class="mast">: brand, and the My festival/Reading
// list buttons, whose counts come from the picks set and the reading list built from those picks, plus
// the Crew button that opens sheets/CrewSheet.jsx.
//
// Crew is shown to signed-out visitors too, in any build that has a Firebase project: the crew screen
// carries the account card, so it is the way in, and hiding it until sign-in would leave nowhere to sign
// in from. A build without data/firebase.json has no accounts at all and keeps the two buttons it had.
import {EVENTS, EXTRA, BRIEFINGS, CLOUD} from '../data/index.js';
import {usePlanner} from '../store/planner.js';
import {useSheet} from '../store/sheet.js';
import {useCloud, selectMyUid} from '../store/cloud.js';
import {readingList, readingCount} from '../core/reading.js';

export default function Masthead(){
  const picks = usePlanner(s => s.picks);
  const rl = readingCount(readingList(EVENTS, picks, EXTRA, BRIEFINGS));
  // the same reading of "in a crew" the chip and the overlay use: a crew and someone to compare it against
  const crew = useCloud(s => s.crew);
  const myUid = useCloud(selectMyUid);
  const crewN = crew && myUid ? crew.members.length : 0;

  return (
    <header className="mast">
      <div className="mast-inner">
        <div className="brand">
          <h1>HowTheLightGetsIn <span>London 2026</span></h1>
          <p className="sub">
            <span className="where">Kenwood House, Hampstead Heath · 19–20 September</span>
            <span className="unofficial">Unofficial fan-made planner, not affiliated with the festival · <a href="#about">about</a></span>
          </p>
        </div>
        <nav className="mast-actions" aria-label="My festival">
          <button type="button" className={'mbtn' + (picks.size > 0 ? ' has' : '')} onClick={() => useSheet.getState().open('hub')}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6l1.9 4 4.4.6-3.2 3.1.8 4.4L8 11.6l-3.9 2.1.8-4.4L1.7 6.2l4.4-.6z"/></svg>
            <span className="label">My festival</span>
            <span className="count" data-count-picks hidden={!picks.size}>{picks.size}</span>
          </button>
          <button type="button" className={'mbtn' + (rl > 0 ? ' has' : '')} onClick={() => useSheet.getState().open('reading')}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path fillRule="evenodd" d="M2 2.5h4.2c.9 0 1.6.5 1.8 1.1.2-.6.9-1.1 1.8-1.1H14v10.3H9.9c-.9 0-1.6.4-1.9 1-.3-.6-1-1-1.9-1H2zm1.3 1.3v7.7h2.9c.7 0 1.3.2 1.8.5V5c0-.7-.7-1.2-1.6-1.2zm9.4 0H9.6c-.9 0-1.6.5-1.6 1.2v7c.5-.3 1.1-.5 1.8-.5h2.9z"/></svg>
            <span className="label">Reading list</span>
            <span className="count" data-count-reading hidden={!rl}>{rl}</span>
          </button>
          {CLOUD && (
            <button type="button" className={'mbtn' + (crewN > 0 ? ' has' : '')} onClick={() => useSheet.getState().open('crew')}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.8 7.7a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2m5 .3a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4M1 13.4c0-2.1 2.1-3.6 4.8-3.6s4.8 1.5 4.8 3.6v.4H1zm10.2-4c2.3.1 3.8 1.4 3.8 3.2v1.2h-3.2v-.8c0-1.4-.6-2.6-1.7-3.4z"/></svg>
              <span className="label">Crew</span>
              <span className="count" data-count-crew hidden={!crewN}>{crewN}</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
