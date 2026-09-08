// src/ui/EventCard.jsx — the event card from the old renderList()'s inner template: kicker (type, venue,
// briefing badge, pick star), title, who line with hosts, and a footer of badges and topic tags.
import {byNo, BRIEFINGS, GROUP} from '../data/index.js';
import {ticketBadge} from '../core/labels.js';
import {usePlanner} from '../store/planner.js';
import {useSheet} from '../store/sheet.js';
import CrewBadges from './CrewBadges.jsx';

export default function EventCard({e, picked, clash, hasNote}){
  const badge = ticketBadge(e);
  const hasWho = e.speakers.length > 0 || e.hosts.length > 0;

  return (
    <article
      className={`ev g-${GROUP[e.type]}${picked ? ' picked' : ''}`}
      tabIndex={0}
      role="button"
      aria-label={e.title}
      onClick={() => useSheet.getState().open('event', e.eventNo)}
      onKeyDown={ev => {
        if (ev.target !== ev.currentTarget) return;   // let the nested pick button handle its own Enter/Space
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); useSheet.getState().open('event', e.eventNo); }
      }}
    >
      <div className="ev-head">
        <span className="ev-type">{e.type}</span>
        <span className="ev-venue">{e.venue}</span>
        {BRIEFINGS[e.eventNo] && <span className="brief-badge">Briefing</span>}
        <CrewBadges no={e.eventNo} />
        <button
          type="button"
          className="pick"
          aria-pressed={picked}
          aria-label={(picked ? 'Remove from' : 'Add to') + ' my picks'}
          onClick={ev => { ev.stopPropagation(); usePlanner.getState().togglePick(e.eventNo); }}
        >
          {picked ? '★' : '☆'}
        </button>
      </div>
      <h3 className="ev-title">{e.title}</h3>
      {hasWho && (
        <p className="ev-who">
          {e.speakers.join(', ')}
          {e.hosts.length > 0 && <span className="host">{e.speakers.length ? ' · ' : ''}hosted by {e.hosts.join(' & ')}</span>}
        </p>
      )}
      <div className="ev-foot">
        <span className={badge.cls}>{badge.text}</span>
        {hasNote && <span className="badge note">✎ notes</span>}
        {clash && clash.length > 0 && (
          <span className="badge clash">⚠ Clashes with {clash.map(c => byNo.get(c.no).title).join(', ')}</span>
        )}
        <span className="tags">{e.topics.join(' · ')}</span>
      </div>
    </article>
  );
}
