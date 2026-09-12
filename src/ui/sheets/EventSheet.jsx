// src/ui/sheets/EventSheet.jsx — ports showEvent(): hero, kicker, title, when, the clash and soft-overlap
// notes (from useFiltered's clash maps), tabs when a briefing exists, the overview (people, description,
// media, meta, actions: pick toggle / crew-plan toggle while in a crew / .ics export / Google Calendar),
// and a dedicated Notes tab with personal notes, shared crew notes and debate verdicts.
import {useState, Fragment} from 'react';
import {byNo, BRIEFINGS, GROUP, DAYS} from '../../data/index.js';
import {ticketLine, cleanDesc} from '../../core/labels.js';
import {icsFile, icsFilename, gcalLink} from '../../core/calendar.js';
import {usePlanner} from '../../store/planner.js';
import {useSheet} from '../../store/sheet.js';
import {useFiltered} from '../useFiltered.js';
import {download} from '../download.js';
import {Hero, People} from '../event/People.jsx';
import Media from '../event/Media.jsx';
import {Briefing} from '../event/Briefing.jsx';
import Verdict from '../event/Verdict.jsx';
import Notes from '../event/Notes.jsx';
import CrewRow from '../event/CrewRow.jsx';
import CrewTally from '../event/CrewTally.jsx';
import CrewNotes from '../event/CrewNotes.jsx';
import {CrewPlanButton} from '../CrewPick.jsx';

function ClashRef({no}){
  const o = byNo.get(no);
  return <button type="button" onClick={() => useSheet.getState().open('event', no)}>{o.title}</button>;
}

function selectTab(setTab, tab){
  setTab(tab);
  const body = document.getElementById('sheet-body');
  if (body) body.scrollTop = 0;
}

export default function EventSheet({no, mode}){
  const e = byNo.get(no);
  const picks = usePlanner(s => s.picks);
  const {clashes, soft} = useFiltered();
  const [tab, setTab] = useState(mode === 'notes' || mode === 'edit-note' ? 'notes' : 'overview');
  const hasNote = usePlanner(s => !!s.notes[no]?.trim());
  if (!e) return null;

  const picked = picks.has(no);
  const b = BRIEFINGS[no];
  const clash = clashes.get(no);
  const overlap = soft.get(no);

  const menuLinks = e.links.filter(l => /menu/i.test(l.text));
  const linkItems = [];
  if (e.url) linkItems.push({key: 'event', node: <a href={e.url} target="_blank" rel="noopener">Event page ↗</a>});
  menuLinks.forEach((l, i) => linkItems.push({key: 'menu' + i, node: <a href={l.href} target="_blank" rel="noopener">Menu (PDF) ↗</a>}));

  const desc = cleanDesc(e.description);

  const overview = (
    <>
      <People e={e} />
      <CrewRow e={e} />
      <div className="desc">
        {desc
          ? desc.split(/\n{2,}|\n/).filter(Boolean).map((t, i) => <p key={i}>{t}</p>)
          : <p className="src">No description published for this slot.</p>}
        {e.descriptionSource === 'artist profile' && <p className="src">Description from the artist’s profile page.</p>}
      </div>
      <Media e={e} />
      <dl className="meta">
        <dt>Tickets</dt><dd>{ticketLine(e)}</dd>
        <dt>Topics</dt><dd>{e.topics.join(' · ')}</dd>
        {linkItems.length > 0 && (
          <>
            <dt>Links</dt>
            <dd>{linkItems.map((it, i) => <Fragment key={it.key}>{i > 0 ? ' · ' : ''}{it.node}</Fragment>)}</dd>
          </>
        )}
      </dl>
      <div className="actions">
        <button
          type="button"
          className="btn"
          onClick={() => download(icsFilename(e), icsFile([e], 'HTLGI London 2026'), 'text/calendar;charset=utf-8')}
        >
          Add to calendar (.ics)
        </button>
        <a className="btn" href={gcalLink(e)} target="_blank" rel="noopener">Google Calendar ↗</a>
        <p className="note">Calendar entries include the talk summary, venue, speakers and ticket notes. Sessions are assumed to last an hour — the festival publishes start times only.</p>
      </div>
    </>
  );

  return (
    <div className={`event-sheet g-${GROUP[e.type]}`}>
      <Hero photo={e.photo} />
      <div className="kicker">
        <span className="type">{e.type}</span>
        <span>Event #{e.eventNo}</span>
      </div>
      <h2 id="sheet-title" tabIndex={-1}>{e.title}</h2>
      <p className="when">{DAYS[e.date]} {e.time} <span>· {e.venue}</span></p>
      <div className="actions event-plan-actions">
        <button
          type="button"
          className={`btn${picked ? ' pickbtn' : ''}`}
          aria-pressed={picked}
          onClick={() => usePlanner.getState().togglePick(no)}
        >
          {picked ? '★ In my picks' : '☆ Add to my picks'}
        </button>
        <CrewPlanButton no={no} />
      </div>
      {clash && clash.length > 0 && (
        <div className="clashnote">
          ⚠ Clashes with your pick{clash.length > 1 ? 's' : ''}: {clash.map((x, i) => (
            <Fragment key={x.no}>{i > 0 ? ', ' : ''}<ClashRef no={x.no} /> ({byNo.get(x.no).time}, {byNo.get(x.no).venue})</Fragment>
          ))}.
        </div>
      )}
      {overlap && overlap.length > 0 && (
        <p className="softnote">
          Overlaps by {overlap.map((x, i) => (
            <Fragment key={x.no}>{i > 0 ? ', ' : ''}{x.min} min with <ClashRef no={x.no} /> ({byNo.get(x.no).time}, {byNo.get(x.no).venue})</Fragment>
          ))} — sessions assumed to last an hour.
        </p>
      )}
      <div className="tabs event-tabs" aria-label="Event sections">
        <button type="button" aria-pressed={tab === 'overview'} aria-controls={`overview-${no}`} onClick={() => selectTab(setTab, 'overview')}>Overview</button>
        {b && <button type="button" aria-pressed={tab === 'briefing'} aria-controls={`briefing-${no}`} onClick={() => selectTab(setTab, 'briefing')}>Briefing</button>}
        <button type="button" aria-pressed={tab === 'notes'} aria-controls={`notes-${no}`} onClick={() => selectTab(setTab, 'notes')}>Notes{hasNote && <span className="notes-dot" aria-hidden="true" />}</button>
      </div>
      <div id={`overview-${no}`} hidden={tab !== 'overview'}>{overview}</div>
      {b && <div id={`briefing-${no}`} hidden={tab !== 'briefing'}><Briefing b={b} /></div>}
      <div id={`notes-${no}`} hidden={tab !== 'notes'}>
        <h3 className="sub notes-heading">My notes</h3>
        <Notes no={no} initialEditing={mode === 'edit-note'} />
        <CrewNotes no={no} />
        {e.type === 'Debates' && <><h3 className="sub">Debate verdict</h3><Verdict e={e} /><CrewTally e={e} /></>}
      </div>
    </div>
  );
}
