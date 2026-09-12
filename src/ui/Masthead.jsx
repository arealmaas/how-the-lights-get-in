// src/ui/Masthead.jsx — ported from the old <header class="mast">: brand, and the My festival/Reading
// list buttons, whose counts come from the picks set and the reading list built from those picks. In a
// crew there is a third button, named after the crew and counting its plan, so being in a crew is visible
// from the top of every page; it opens My festival at the crew cards (CREW-SPEC section 7).
import {EVENTS, EXTRA, BRIEFINGS} from '../data/index.js';
import {usePlanner} from '../store/planner.js';
import {useSheet} from '../store/sheet.js';
import {useCloud} from '../store/cloud.js';
import {readingList, readingCount} from '../core/reading.js';
import {useCrewPlan, useInCrew} from './useFiltered.js';
import CrewIcon from './CrewIcon.jsx';

export default function Masthead(){
  const picks = usePlanner(s => s.picks);
  const rl = readingCount(readingList(EVENTS, picks, EXTRA, BRIEFINGS));
  const crewName = useCloud(s => (s.crew && s.crew.name) || '');
  const inCrew = useInCrew();
  const plan = useCrewPlan();

  return (
    <header className="mast">
      <div className="mast-inner">
        <div className="brand">
          <h1>HowTheLightGetsIn <span>London 2026</span></h1>
          <p className="sub">
            <span className="where">Kenwood House, Hampstead Heath · 19–20 September</span>
            <span className="unofficial">Unofficial planner · <a href="#about">About</a></span>
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
          {inCrew && (
            <button
              type="button"
              className="mbtn crewbtn"
              title={`Your crew${crewName ? ': ' + crewName : ''} · ${plan.size} in the crew’s plan`}
              onClick={() => useSheet.getState().open('hub', undefined, 'crew')}
            >
              <CrewIcon />
              <span className="label">{crewName || 'Crew'}</span>
              <span className="count" data-count-crew hidden={!plan.size}>{plan.size}</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
