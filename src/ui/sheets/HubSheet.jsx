// src/ui/sheets/HubSheet.jsx — ports showHub(): the summary line, the four cards or the empty-state
// nudge (HubCards), the day-by-day pick lists (DayList), and the foot linking to stats and the about
// section. The account and crew slot that used to close this sheet is a screen of its own now, reached
// from the masthead's Crew button — see sheets/CrewSheet.jsx.
import {Fragment} from 'react';
import {EVENTS, DAYS} from '../../data/index.js';
import {usePlanner} from '../../store/planner.js';
import {useSheet} from '../../store/sheet.js';
import {computeClashes} from '../../core/clashes.js';
import HubCards from '../hub/HubCards.jsx';
import DayList from '../hub/DayList.jsx';

export default function HubSheet(){
  const picks = usePlanner(s => s.picks);
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
      {byDay.filter(([, evs]) => evs.length).map(([d, evs]) => (
        <Fragment key={d}>
          <h3 className="sub">{DAYS[d]} · {evs.length} pick{evs.length === 1 ? '' : 's'}</h3>
          <DayList events={evs} clashes={clashes} soft={soft} />
        </Fragment>
      ))}
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
