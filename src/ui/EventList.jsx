// src/ui/EventList.jsx — ported from the old renderList(list): events grouped into time-slot sections,
// each rendered as an EventCard.
import {usePlanner} from '../store/planner.js';
import {NOW} from './useFiltered.js';
import EventCard from './EventCard.jsx';
import EmptyEvents from './EmptyEvents.jsx';

export default function EventList({list, clashes}){
  const day = usePlanner(s => s.day);
  const picks = usePlanner(s => s.picks);
  const notes = usePlanner(s => s.notes);
  const verdicts = usePlanner(s => s.verdicts);

  if (!list.length) {
    return <EmptyEvents />;
  }

  const slots = new Map();
  for (const e of list) {
    if (!slots.has(e.time)) slots.set(e.time, []);
    slots.get(e.time).push(e);
  }

  return (
    <>
      {[...slots.entries()].map(([time, evs]) => {
        const past = day === NOW.date && time < NOW.time;
        return (
          <section className="slot" id={`t-${time.replace(':', '')}`} key={time}>
            <div className={'slot-time' + (past ? ' past' : '')}>{time}</div>
            <div className="slot-events">
              {evs.map(e => (
                <EventCard
                  key={e.eventNo}
                  e={e}
                  picked={picks.has(e.eventNo)}
                  clash={clashes.get(e.eventNo)}
                  hasNote={!!(notes[e.eventNo] && notes[e.eventNo].trim()) || !!verdicts[e.eventNo]}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
