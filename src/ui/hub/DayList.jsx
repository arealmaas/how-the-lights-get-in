// src/ui/hub/DayList.jsx — ports hubList(): one day's picked events as button rows (time, title, type ·
// venue · who), each opening the event sheet, with any clash/soft-overlap, notes and verdict marks.
// `extra(eventNo)`, when given, returns one more mark for the row or null: the crew plan's lists use it
// for "Going: Are, Kari · added by Morten".
import {Fragment} from 'react';
import {byNo} from '../../data/index.js';
import {whoPlain} from '../../core/labels.js';
import {usePlanner} from '../../store/planner.js';
import {useSheet} from '../../store/sheet.js';

export default function DayList({events, clashes, soft, extra = null}){
  const notes = usePlanner(s => s.notes);
  const verdicts = usePlanner(s => s.verdicts);
  const hasNote = no => !!(notes[no] && notes[no].trim()) || !!verdicts[no];

  return (
    <ul className="applist hub-list">
      {events.map(e => {
        const clash = clashes.get(e.eventNo);
        const overlap = soft.get(e.eventNo);
        const marks = [];
        if (clash) marks.push(<span className="warn" key="clash">⚠ clashes with {clash.map(x => byNo.get(x.no).title).join(', ')}</span>);
        else if (overlap) marks.push(<span key="overlap">overlaps {overlap.map(x => `${x.min} min with ${byNo.get(x.no).title}`).join(', ')}</span>);
        if (hasNote(e.eventNo)) marks.push(<span className="nt" key="note">✎ notes</span>);
        if (verdicts[e.eventNo]) marks.push(<span key="verdict">verdict: {verdicts[e.eventNo]}</span>);
        const more = extra ? extra(e.eventNo) : null;
        if (more) marks.push(<span className="xtra" key="extra">{more}</span>);

        return (
          <li key={e.eventNo}>
            <button type="button" onClick={() => useSheet.getState().open('event', e.eventNo)}>
              <span className="t">{e.time}</span>
              <span className="n">{e.title}</span>
              <span className="v">{e.type} · {e.venue}{whoPlain(e) ? ' · ' + whoPlain(e) : ''}</span>
              {marks.length > 0 && (
                <span className="m">
                  {marks.map((m, i) => <Fragment key={i}>{i > 0 ? ' · ' : ''}{m}</Fragment>)}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
