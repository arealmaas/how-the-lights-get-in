// src/ui/sheets/HubSheet.jsx — ports showHub(): the summary line, the four cards or the empty-state
// nudge (HubCards), the day-by-day pick lists (DayList), the crew/account slot (Tasks 8-10, rendered only
// when CLOUD is on; the Crew card comes first, because in a crew it is the card that changes day to day),
// and the foot linking to stats and the about section. `mode` is where the hub opens: 'crew' (the
// masthead's crew button) scrolls to the crew cards once the sheet has scrolled itself to the top.
import {Fragment, useEffect} from 'react';
import {EVENTS, DAYS, CLOUD} from '../../data/index.js';
import {usePlanner} from '../../store/planner.js';
import {useSheet} from '../../store/sheet.js';
import {computeClashes} from '../../core/clashes.js';
import HubCards from '../hub/HubCards.jsx';
import DayList from '../hub/DayList.jsx';
import AccountCard from '../hub/AccountCard.jsx';
import CrewCard from '../hub/CrewCard.jsx';
import CrewSection from '../hub/CrewSection.jsx';
import NotesSection from '../hub/NotesSection.jsx';

export default function HubSheet({mode}){
  const picks = usePlanner(s => s.picks);
  // Sheet.jsx scrolls the body to the top in its own effect, which runs after this one (parents' effects
  // run after their children's), so the scroll to the crew cards waits a tick to have the last word.
  useEffect(() => {
    if (mode !== 'crew') return undefined;
    const t = setTimeout(() => {
      const el = document.getElementById('crew');
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({block: 'start'});
    }, 0);
    return () => clearTimeout(t);
  }, [mode]);
  const mine = EVENTS.filter(e => picks.has(e.eventNo));
  const byDay = Object.keys(DAYS).map(d => [d, mine.filter(e => e.date === d)]);
  const {clashes, soft} = computeClashes(EVENTS, picks);
  const clashN = mine.filter(e => clashes.has(e.eventNo)).length;

  return (
    <>
      <div className="kicker"><span>My festival</span></div>
      <h2 id="sheet-title" tabIndex={-1}>Your weekend</h2>
      <p className="src">
        {mine.length ? (
          <>
            {mine.length} pick{mine.length === 1 ? '' : 's'} · {byDay.map(([d, evs], i) => (
              <Fragment key={d}>{i > 0 ? ', ' : ''}{evs.length} {DAYS[d].slice(0, 3)}</Fragment>
            ))}
            {clashN > 0 && <> · <span className="warn">{clashN} clash{clashN === 1 ? '' : 'es'}</span></>}
          </>
        ) : 'Nothing picked yet'}
      </p>
      <HubCards mine={mine} />
      <NotesSection />
      {byDay.filter(([, evs]) => evs.length).map(([d, evs]) => (
        <Fragment key={d}>
          <h3 className="sub">{DAYS[d]} · {evs.length} pick{evs.length === 1 ? '' : 's'}</h3>
          <DayList events={evs} clashes={clashes} soft={soft} />
        </Fragment>
      ))}
      {CLOUD && (
        <>
          <h3 className="sub" id="crew">Crew and account</h3>
          <div className="hub-cards">
            <CrewCard />
            <AccountCard />
          </div>
          <CrewSection />
        </>
      )}
      <p className="hub-foot">
        <button type="button" onClick={() => useSheet.getState().open('stats')}>The festival in numbers</button>
        <span>·</span>
        <button
          type="button"
          onClick={() => {
            useSheet.getState().close();
            document.getElementById('about')?.scrollIntoView({behavior: 'smooth', block: 'start'});
          }}
        >
          About &amp; disclaimer
        </button>
      </p>
    </>
  );
}
