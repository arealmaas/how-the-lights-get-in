// src/ui/EventCard.jsx — the event card from the old renderList()'s inner template: kicker (type, venue,
// briefing badge, crew badges, the crew-plan toggle, pick star), title, who line with hosts, and a footer
// of badges and topic tags. An event in the crew's plan carries the `crew` class — a ring in the crew
// colour, distinct from the amber bar of a pick, because the two are independent: the crew can plan an
// event I have not starred, and I can star one the crew has not planned (CREW-SPEC section 7).
import {byNo, BRIEFINGS, GROUP} from '../data/index.js';
import {ticketBadge} from '../core/labels.js';
import {usePlanner} from '../store/planner.js';
import {useSheet} from '../store/sheet.js';
import {useInPlan} from './useFiltered.js';
import CrewBadges from './CrewBadges.jsx';
import CrewPick from './CrewPick.jsx';

export default function EventCard({e, picked, clash, hasNote}){
  const badge = ticketBadge(e);
  const hasWho = e.speakers.length > 0 || e.hosts.length > 0;
  const inPlan = useInPlan(e.eventNo);

  return (
    <article
      className={`ev g-${GROUP[e.type]}${picked ? ' picked' : ''}${inPlan ? ' crew' : ''}`}
    >
      <div className="ev-head">
        <div className="ev-details">
          <span className="ev-type">{e.type}</span>
          <span className="ev-venue">{e.venue}</span>
          {BRIEFINGS[e.eventNo] && <span className="brief-badge">Briefing</span>}
          <CrewBadges no={e.eventNo} />
        </div>
        <CrewPick no={e.eventNo} />
        <button
          type="button"
          className="pick"
          aria-pressed={picked}
          aria-label={`${picked ? 'Remove from' : 'Add to'} my picks: ${e.title}`}
          onClick={ev => { ev.stopPropagation(); usePlanner.getState().togglePick(e.eventNo); }}
        >
          {picked ? '★' : '☆'}
        </button>
      </div>
      <h3 className="ev-title">
        <button
          type="button"
          className="ev-open"
          aria-haspopup="dialog"
          onClick={ev => {
            ev.currentTarget.focus({preventScroll: true});
            useSheet.getState().open('event', e.eventNo);
          }}
        >
          {e.title}
        </button>
      </h3>
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
