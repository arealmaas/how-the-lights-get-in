import {useEffect, useMemo, useRef, useState} from 'react';
import {EVENTS, BRIEFINGS, BRIEF_NOTE, DAYS, GROUP, spkBySlug, spkByName, actBySlug} from '../../data/index.js';
import {conflictGroups, resolveChoice} from '../../core/comparison.js';
import {overlapMin} from '../../core/clashes.js';
import {minutes, dur, addMinutes} from '../../core/time.js';
import {cleanDesc, ticketBadge, ticketLine} from '../../core/labels.js';
import {usePlanner} from '../../store/planner.js';
import {useSheet} from '../../store/sheet.js';
import {useCloud, selectMyUid} from '../../store/cloud.js';
import {Avatar} from '../event/People.jsx';
import CrewRow from '../event/CrewRow.jsx';
import '../../styles/comparison.css';

const slotLabel = group => `${DAYS[group.date]} ${group.events[0].time} · ${group.events.length} options`;
const jumpTo = no => {
  const el = document.getElementById(`compare-event-${no}`);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el?.scrollIntoView({block: 'start', behavior: reducedMotion ? 'instant' : 'smooth'});
  el?.focus({preventScroll: true});
};

function Timeline({events, picks}){
  const start = Math.min(...events.map(e => minutes(e.time)));
  const end = Math.max(...events.map(e => minutes(e.time) + dur(e)));
  return (
    <section className="compare-timeline" aria-label="Overlap timeline">
      <div className="compare-timeline-heading"><h3>Where they overlap</h3><span>London time</span></div>
      <div className="compare-time-scale" aria-hidden="true"><span>{events[0].time}</span><span>{addMinutes('00:00', end)}</span></div>
      {events.map((e, i) => (
        <div className={`compare-time-row g-${GROUP[e.type]}`} key={e.eventNo}>
          <button type="button" onClick={() => jumpTo(e.eventNo)}><span className="compare-letter">{i + 1}</span>{e.title}</button>
          <div className="compare-time-track" aria-label={`${e.title}: ${e.time} to approximately ${addMinutes(e.time, dur(e))}${picks.has(e.eventNo) ? ', picked' : ', not picked'}`}>
            <span className={picks.has(e.eventNo) ? 'is-picked' : ''} style={{left: `${(minutes(e.time) - start) / (end - start) * 100}%`, width: `${dur(e) / (end - start) * 100}%`}}>{e.time}<span>{picks.has(e.eventNo) ? ' ★' : ''}</span></span>
          </div>
        </div>
      ))}
      <p>End times and overlaps are estimates: the programme publishes start times only, so we allow 60 minutes per event. Leave time to move between venues.</p>
    </section>
  );
}

function OnStage({event}){
  const people = event.people.map(person => ({...person, profile: person.slug ? spkBySlug.get(person.slug) : spkByName.get(person.name.toLowerCase()), kind: 'speaker'}));
  const acts = (event.actSlugs || []).map(slug => actBySlug.get(slug)).filter(Boolean).map(profile => ({name: profile.name, profile, kind: 'act'}));
  return <ul className="compare-people">{[...people, ...acts].map(person => (
    <li key={`${person.kind}-${person.name}`}>
      <Avatar photo={person.profile?.photo} name={person.name} />
      <div>{person.profile?.bio
        ? <button type="button" onClick={() => useSheet.getState().open(person.kind, person.profile.slug || person.name)}>{person.name}{person.role === 'host' && <small> · host</small>}</button>
        : <strong>{person.name}{person.role === 'host' && <small> · host</small>}</strong>}
        {person.profile?.tagline && <p>{person.profile.tagline}</p>}
        {person.kind === 'act' && <p>{person.profile.kind}</p>}
      </div>
    </li>
  ))}{!people.length && !acts.length && <li className="compare-muted">No speakers or performers listed.</li>}</ul>;
}

function EventOption({event: e, index, events, picks, onChoose}){
  const b = BRIEFINGS[e.eventNo];
  const badge = ticketBadge(e);
  const description = cleanDesc(e.description);
  const note = usePlanner(s => s.notes[e.eventNo]);
  const otherTopics = new Set(events.filter(other => other !== e).flatMap(other => other.topics));
  // Compute against today's picks, including any added while visiting another sheet.
  const {removed} = resolveChoice(EVENTS, picks, e.eventNo);
  const picked = picks.has(e.eventNo);
  const clear = picked && !removed.length;
  const overlaps = events.filter(other => other !== e && overlapMin(e, other) > 0);

  return (
    <article className={`compare-option g-${GROUP[e.type]}${clear ? ' is-chosen' : ''}`} aria-label={e.title}>
      <header className="compare-option-head">
        <div className="compare-option-kicker"><span className="compare-letter">{index + 1}</span><span>{e.type}</span><span className="compare-pick-state">{picked ? '★ Picked' : 'Not picked'}</span></div>
        <h3 id={`compare-event-${e.eventNo}`} tabIndex={-1}>{e.title}</h3>
        <p className="compare-when">{e.time}–{addMinutes(e.time, dur(e))} <span>est. · {e.venue}</span></p>
        <span className={badge.cls}>{badge.text}</span>
      </header>
      <section className="compare-cell compare-idea">
        <h4>{b ? 'The question' : 'The experience'}</h4>
        {b ? <><p className="compare-question">{b.question}</p><h4>Why it matters</h4><p>{b.why}</p><span className="compare-source">From the unofficial briefing</span></>
          : <p>{description || `No description published for this slot.${e.url ? ' Open the event page for the latest programme details.' : ''}`}</p>}
        {(b || e.url || e.descriptionSource === 'artist profile') && <details className="compare-details">
          <summary>{b ? 'Programme & arguments' : 'More event details'}</summary>
          {b && <><h4>From the programme</h4>{description ? description.split(/\n+/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>) : <p>No description published for this slot.</p>}</>}
          {e.descriptionSource === 'artist profile' && <p className="compare-source">Description from the artist’s profile.</p>}
          {b?.sides && <><h4>The competing ideas</h4><ul>{b.sides.map((side, i) => <li key={i}><strong>{side.label}</strong>{side.points?.[0] && <p>{side.points[0]}</p>}</li>)}</ul></>}
          {b?.case?.length > 0 && <><h4>The argument</h4><p>{b.case[0]}</p>{b.objections?.[0] && <><h4>A question to weigh</h4><p>{b.objections[0]}</p></>}</>}
          {e.url && <a href={e.url} target="_blank" rel="noopener">Official event page ↗</a>}
        </details>}
      </section>
      <section className="compare-cell">
        <h4>Topics to follow</h4>
        {e.topics.length ? <ul className="compare-topics">{e.topics.map(topic => <li key={topic} className={!otherTopics.has(topic) ? 'distinct' : ''}>{topic}{!otherTopics.has(topic) && <span>Only here in this comparison</span>}</li>)}</ul> : <p className="compare-muted">No topics listed.</p>}
      </section>
      <section className="compare-cell"><h4>On stage</h4><OnStage event={e} /></section>
      <section className="compare-cell compare-practical">
        <h4>Before you decide</h4><p>{ticketLine(e)}</p>
        <ul className="compare-overlaps">{overlaps.map(other => <li key={other.eventNo}><b>{overlapMin(e, other)} min</b> estimated overlap with {other.title}</li>)}</ul>
        <CrewRow e={e} />
        {note?.trim() && <details className="compare-details"><summary>Your note</summary><p className="compare-note">{note}</p></details>}
      </section>
      <footer className="compare-cell compare-choice">
        <button type="button" className={`btn ${clear ? 'pickbtn' : 'primary'}`} disabled={clear} onClick={() => onChoose(e)}>{clear ? '✓ Keeping this event' : 'Choose this event'}</button>
        <p>{removed.length ? <>Keeps this event and removes {removed.length} overlapping pick{removed.length === 1 ? '' : 's'}: {removed.map(other => other.title).join(', ')}.</> : picked ? 'This pick has no remaining overlaps.' : 'Adds this event to your picks.'}</p>
        <button type="button" className="btn compare-full-details" onClick={() => useSheet.getState().open('event', e.eventNo)}>Full event details <span aria-hidden="true">↗</span></button>
      </footer>
    </article>
  );
}

export default function CompareSheet(props){
  const owner = useCloud(selectMyUid);
  return <Comparison key={owner || 'local'} {...props} owner={owner} />;
}

function Comparison({no, session, onSelectGroup, owner}){
  const picks = usePlanner(s => s.picks);
  // Keep the options after a decision, and across a trip to a profile, so a user can
  // reconsider. This is memory for this sheet visit only; it never enters a URL.
  const memory = useRef(session?.comparison?.owner === owner ? session.comparison : {owner, candidates: [], active: no, undo: null, message: ''});
  const [active, setActive] = useState(memory.current.active);
  const [undo, setUndo] = useState(memory.current.undo);
  const [message, setMessage] = useState(memory.current.message);
  const groups = useMemo(() => conflictGroups(EVENTS, new Set([...picks, ...memory.current.candidates])), [picks]);
  const group = groups.find(g => g.events.some(e => e.eventNo === active)) || groups[0];
  const remaining = conflictGroups(EVENTS, picks).length;
  useEffect(() => {
    Object.assign(memory.current, {candidates: groups.flatMap(g => g.events.map(e => e.eventNo)), active: group?.id, undo, message});
    if (session) session.comparison = memory.current;
  }, [groups, group, undo, message, session]);

  function choose(e){
    if (selectMyUid(useCloud.getState()) !== owner) return;
    const current = usePlanner.getState().picks;
    const {changes, removed} = resolveChoice(EVENTS, current, e.eventNo);
    const changed = Object.entries(changes).filter(([key, value]) => current.has(+key) !== value);
    if (!changed.length) return;
    setUndo({owner, before: Object.fromEntries(changed.map(([key]) => [key, current.has(+key)])), after: Object.fromEntries(changed)});
    usePlanner.getState().setPicks(changes);
    setMessage(`Keeping “${e.title}”. ${removed.length ? `Removed ${removed.length} overlapping pick${removed.length === 1 ? '' : 's'}.` : 'Added to your picks.'}`);
  }
  const canUndo = undo && undo.owner === owner && Object.entries(undo.after).every(([key, value]) => picks.has(+key) === value);
  function undoChoice(){
    if (!canUndo || selectMyUid(useCloud.getState()) !== owner) return;
    usePlanner.getState().setPicks(undo.before);
    setUndo(null);
    setMessage('Choice undone. Your previous picks are restored.');
  }

  return (
    <div className="comparison">
      <div className="kicker"><span>My picks</span><span> / </span><span>A little help choosing</span></div>
      <h2 id="sheet-title" tabIndex={-1}>Compare your picks</h2>
      <p className="compare-intro">Follow the question that grabs you. Compare the ideas, the people and the practicalities, then make room for your favourite.</p>
      {groups.length > 1 && <div className="compare-slots" role="group" aria-label="Overlapping time slots">{groups.map(g => <button type="button" key={g.id} aria-pressed={g === group} onClick={() => { if (g === group) return; setActive(g.id); onSelectGroup?.(g.id); }}>{slotLabel(g)}</button>)}</div>}
      <div className="compare-feedback" role="status" aria-live="polite" aria-atomic="true">
        {message && <p>{message}</p>}
        {undo && (canUndo ? <button type="button" className="btn" onClick={undoChoice}>Undo choice</button> : <p className="compare-muted">Your picks have changed since that choice. You can choose again below.</p>)}
        {message && <span>{remaining ? `${remaining} overlapping time slot${remaining === 1 ? '' : 's'} left to consider.` : 'Your current picks have no estimated overlaps.'}</span>}
      </div>
      {group ? <>
        <div className="compare-group-heading"><h3>{DAYS[group.date]} <span>· {group.events[0].time} onwards</span></h3><span>{group.events.length} options</span></div>
        <Timeline events={group.events} picks={picks} />
        <div className="compare-board" style={{'--option-count': Math.min(group.events.length, 3)}}>
          {group.events.map((e, i) => <EventOption key={e.eventNo} event={e} index={i} events={group.events} picks={picks} onChoose={choose} />)}
        </div>
        {group.events.some(e => BRIEFINGS[e.eventNo]) && <p className="compare-attribution">{BRIEF_NOTE}</p>}
      </> : <div className="compare-empty"><span aria-hidden="true">✦</span><h3>Your picks fit together</h3><p>There are no estimated overlaps to compare. Pick a few more events and any competing options will appear here.</p><button type="button" className="btn" onClick={() => useSheet.getState().close()}>Back to the programme</button></div>}
    </div>
  );
}
