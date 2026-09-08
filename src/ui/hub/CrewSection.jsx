// src/ui/hub/CrewSection.jsx — the "My festival" crew section of CREW-SPEC section 7: the crew's plan
// by day (with who is going and who added each event), the crew calendar (.ics) and the crew reading
// list — both built from the plan — then the coordination lists over everyone's own picks: All of you,
// Where you split, the Only you / Only them expanders. Ports the Phase 2 plan's crewSection() and
// downloadCrewPicks(); the lists reuse DayList (the old page's hubList) and the split rows open the event
// sheet through the sheet store instead of a data-no handler. HubSheet renders it only when CLOUD is on;
// it renders nothing at all unless I am signed in and in a crew, so the CLOUD-off build and every
// signed-out visitor see exactly what they saw before.
import {Fragment, useMemo} from 'react';
import {EVENTS, DAYS, byNo} from '../../data/index.js';
import {usePlanner} from '../../store/planner.js';
import {useCloud, selectMyUid} from '../../store/cloud.js';
import {useSheet} from '../../store/sheet.js';
import {okBanner} from '../../store/banner.js';
import {crewSummary, goingNames, planAddedBy} from '../../core/crew.js';
import {computeClashes} from '../../core/clashes.js';
import {icsFile} from '../../core/calendar.js';
import {useCrewPlan} from '../useFiltered.js';
import {download} from '../download.js';
import DayList from './DayList.jsx';

const byStart = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);

export default function CrewSection(){
  const crew = useCloud(s => s.crew);
  const myUid = useCloud(selectMyUid);
  const accountName = useCloud(s => s.accountName);
  const picks = usePlanner(s => s.picks);
  const plan = useCrewPlan();
  // My own member document is a sync round trip behind the star I just tapped, so the summary reads my
  // live local picks for my own row. Everyone else's comes from the snapshot, which is all we have of
  // them — and it is what the crew calendar and goingNames already use, so the two now agree at once.
  const summary = useMemo(() => {
    if (!crew || !myUid) return null;
    const mine = Object.fromEntries([...picks].map(n => [n, true]));
    const members = crew.members.map(m => (m.uid === myUid ? {...m, picks: mine} : m));
    return crewSummary(members, myUid, EVENTS);
  }, [crew, myUid, picks]);
  const {clashes, soft} = useMemo(() => computeClashes(EVENTS, picks), [picks]);

  if (!summary) return null;

  const names = no => goingNames(crew.members, myUid, picks, no, accountName || 'you');
  const list = evs => (evs.length ? <DayList events={evs} clashes={clashes} soft={soft} /> : <p className="src">Nothing here yet.</p>);

  // The plan, by day. Each row says who has starred it (their own picks, me first) and who put it in the
  // plan; "nobody going yet" is the row that wants talking about.
  const planned = EVENTS.filter(e => plan.has(e.eventNo)).sort(byStart);
  const planByDay = Object.keys(DAYS).map(d => [d, planned.filter(e => e.date === d)]).filter(([, evs]) => evs.length);
  const planMark = no => {
    const going = names(no);
    const by = planAddedBy(crew.members, crew.picks, no);
    return `${going.length ? 'Going: ' + going.join(', ') : 'Nobody going yet'}${by ? ' · added by ' + by : ''}`;
  };

  // The crew calendar is the plan, not the union of anyone's picks: what the crew has decided to do
  // together, with who is going in each entry's description (CREW-SPEC section 7).
  function downloadCrewPicks(){
    if (!planned.length) { okBanner('Nothing in the crew’s plan yet.'); return; }
    const ics = icsFile(planned, `HTLGI London 2026 — ${crew.name}`, e => { const g = names(e.eventNo); return g.length ? 'Going: ' + g.join(', ') : 'In the crew’s plan'; });
    download('htlgi-london-2026-crew.ics', ics, 'text/calendar;charset=utf-8');
  }

  return (
    <>
      <h3 className="sub crewplan-h">Crew plan · {planned.length}</h3>
      {planByDay.length ? planByDay.map(([d, evs]) => (
        <Fragment key={d}>
          <p className="src planday">{DAYS[d]} · {evs.length}</p>
          <DayList events={evs} clashes={clashes} soft={soft} extra={planMark} />
        </Fragment>
      )) : (
        <p className="src">Nothing in the crew’s plan yet. Tap the crew button next to the star on any event to add it — everyone in the crew sees the same plan.</p>
      )}
      <div className="actions">
        <button type="button" className="btn" onClick={downloadCrewPicks}>Crew calendar (.ics)</button>
        <button type="button" className="btn" onClick={() => useSheet.getState().open('reading', undefined, 'crew')}>Crew reading list</button>
      </div>
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
    </>
  );
}
