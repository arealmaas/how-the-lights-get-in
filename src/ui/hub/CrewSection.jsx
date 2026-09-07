// src/ui/hub/CrewSection.jsx — the "My festival" crew section of CREW-SPEC section 7: All of you, Where
// you split, the Only you / Only them expanders, the crew calendar (.ics) and the crew reading list.
// Ports the Phase 2 plan's crewSection() and downloadCrewPicks(); the lists reuse DayList (the old page's
// hubList) and the split rows open the event sheet through the sheet store instead of a data-no handler.
// HubSheet renders it only when CLOUD is on; it renders nothing at all unless I am signed in and in a
// crew, so the CLOUD-off build and every signed-out visitor see exactly what they saw before.
import {useMemo} from 'react';
import {EVENTS, DAYS, byNo} from '../../data/index.js';
import {usePlanner} from '../../store/planner.js';
import {useCloud} from '../../store/cloud.js';
import {useSheet} from '../../store/sheet.js';
import {okBanner} from '../../store/banner.js';
import {crewSummary, goingNames} from '../../core/crew.js';
import {computeClashes} from '../../core/clashes.js';
import {icsFile} from '../../core/calendar.js';
import {useCrewAny} from '../useFiltered.js';
import {download} from '../download.js';
import DayList from './DayList.jsx';

export default function CrewSection(){
  const crew = useCloud(s => s.crew);
  const user = useCloud(s => s.user);
  const picks = usePlanner(s => s.picks);
  const crewAny = useCrewAny();
  const summary = useMemo(
    () => (crew && user ? crewSummary(crew.members, user.uid, EVENTS) : null),
    [crew, user],
  );
  const {clashes, soft} = useMemo(() => computeClashes(EVENTS, picks), [picks]);

  if (!summary) return null;

  const names = no => goingNames(crew.members, user.uid, picks, no);
  const list = evs => (evs.length ? <DayList events={evs} clashes={clashes} soft={soft} /> : <p className="src">Nothing here yet.</p>);

  function downloadCrewPicks(){
    const union = EVENTS.filter(e => picks.has(e.eventNo) || crewAny.has(e.eventNo));
    if (!union.length) { okBanner('No picks in the crew yet.'); return; }
    const ics = icsFile(union, `HTLGI London 2026 — ${crew.name}`, e => 'Going: ' + names(e.eventNo).join(', '));
    download('htlgi-london-2026-crew.ics', ics, 'text/calendar;charset=utf-8');
  }

  return (
    <>
      <h3 className="sub">All of you · {summary.all.length}</h3>
      {list(summary.all)}
      <h3 className="sub">Where you split · {summary.split.length}</h3>
      {summary.split.length ? (
        <ul className="applist hub-list">
          {summary.split.map(x => {
            const [date, time] = x.slot.split(' ');
            return (
              <li key={x.slot}>
                <div className="splitrow">
                  <span className="t">{DAYS[date].slice(0, 3)} {time}</span>
                  {x.choices.map(c => (
                    <button type="button" key={c.no} onClick={() => useSheet.getState().open('event', c.no)}>
                      <span className="n">{byNo.get(c.no).title}</span>
                      <span className="v">{c.names.join(', ')}</span>
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="src">No slot where you split — either the crew agrees, or nobody has picked yet.</p>}
      <details className="hub-more">
        <summary>Only you · {summary.onlyMe.length}</summary>
        {list(summary.onlyMe)}
      </details>
      <details className="hub-more">
        <summary>Only them · {summary.onlyThem.length}</summary>
        {list(summary.onlyThem)}
      </details>
      <div className="actions">
        <button type="button" className="btn" onClick={downloadCrewPicks}>Crew calendar (.ics)</button>
        <button type="button" className="btn" onClick={() => useSheet.getState().open('reading')}>Crew reading list</button>
      </div>
    </>
  );
}
