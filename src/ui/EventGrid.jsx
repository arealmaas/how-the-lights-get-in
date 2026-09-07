// src/ui/EventGrid.jsx — ported from the old renderGrid(list): a venue × time table, one tile per event.
import {EVENTS, VENUES, GROUP} from '../data/index.js';
import {usePlanner} from '../store/planner.js';
import {useSheet} from '../store/sheet.js';
import {NOW} from './useFiltered.js';
import CrewBadges from './CrewBadges.jsx';

export default function EventGrid({list, clashes}){
  const day = usePlanner(s => s.day);
  const picks = usePlanner(s => s.picks);

  if (!list.length) {
    return <div className="empty"><b>Nothing matches</b>Try another day, clear a filter, or search for a speaker.</div>;
  }

  const venues = VENUES.filter(v => EVENTS.some(e => e.date === day && e.venue === v));
  const times = [...new Set(list.map(e => e.time))].sort();

  return (
    <div className="gridwrap">
      <table className="grid">
        <thead>
          <tr><th>Time</th>{venues.map(v => <th key={v}>{v}</th>)}</tr>
        </thead>
        <tbody>
          {times.map(t => {
            const past = day === NOW.date && t < NOW.time;
            return (
              <tr key={t}>
                <td className={'t' + (past ? ' past' : '')}>{t}</td>
                {venues.map(v => {
                  const evs = list.filter(e => e.time === t && e.venue === v);
                  return (
                    <td className="c" key={v}>
                      {evs.map(e => (
                        <button
                          key={e.eventNo}
                          type="button"
                          className={`tile g-${GROUP[e.type]}${picks.has(e.eventNo) ? ' picked' : ''}`}
                          onClick={() => useSheet.getState().open('event', e.eventNo)}
                        >
                          {clashes.has(e.eventNo) && <span className="warn" title="Clashes with another pick">⚠</span>}
                          {picks.has(e.eventNo) && <span className="star">★</span>}
                          <CrewBadges no={e.eventNo} />
                          <b>{e.title}</b>
                          {(e.speakers.length > 0 || e.hosts.length > 0) && (
                            <span>{[...e.speakers, ...e.hosts.map(x => x + ' (host)')].join(', ')}</span>
                          )}
                        </button>
                      ))}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="gridnote">Start times only — the festival does not publish end times. Tap a block for details.</p>
    </div>
  );
}
