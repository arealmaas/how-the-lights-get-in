// src/ui/sheets/ReadingSheet.jsx — ports showReadingList(): the reading list built from your picks (up to
// two books per speaker, plus each briefing's "read or watch first"), with a Markdown export and a
// copy-as-text button. In a crew it also gets the Mine / Crew tabs of CREW-SPEC section 7: Crew builds
// the list from the union of everyone's picks and ends each event's line with who is going. The mode is
// component state, so it starts at Mine every time the sheet is opened.
import {useState} from 'react';
import {EVENTS, EXTRA, BRIEFINGS, DAYS} from '../../data/index.js';
import {usePlanner} from '../../store/planner.js';
import {useCloud} from '../../store/cloud.js';
import {useSheet} from '../../store/sheet.js';
import {readingList, readingMarkdown, withGoing} from '../../core/reading.js';
import {goingNames} from '../../core/crew.js';
import {useCrewAny} from '../useFiltered.js';
import {download} from '../download.js';

export default function ReadingSheet(){
  const picks = usePlanner(s => s.picks);
  const crew = useCloud(s => s.crew);
  const user = useCloud(s => s.user);
  const crewAny = useCrewAny();
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState('mine');

  const inCrew = !!(crew && user);
  const crewMode = inCrew && mode === 'crew';
  const set = crewMode ? new Set([...picks, ...crewAny]) : picks;
  const built = readingList(EVENTS, set, EXTRA, BRIEFINGS);
  const items = crewMode ? withGoing(built, no => goingNames(crew.members, user.uid, picks, no)) : built;
  const total = items.reduce((n, x) => n + x.bks.length + x.reads.length, 0);

  function copyText(){
    try {
      navigator.clipboard.writeText(readingMarkdown(items)).then(() => setCopied(true), () => {});
    } catch (e) {}
  }
  function exportMd(){
    download('htlgi-london-2026-reading-list.md', readingMarkdown(items), 'text/markdown;charset=utf-8');
  }

  return (
    <>
      <div className="kicker"><span>Reading list</span><span>{items.length} picks · {total} items</span></div>
      <h2 id="sheet-title" tabIndex={-1}>Read before you go</h2>
      <p className="src">
        {crewMode
          ? 'Built from everyone’s picks in the crew: up to two books per speaker, plus each briefing’s “read or watch first”.'
          : 'Built from your picks: up to two books per speaker, plus each briefing’s “read or watch first”.'}
      </p>
      {inCrew && (
        <div className="tabs">
          <button type="button" aria-pressed={mode === 'mine'} onClick={() => setMode('mine')}>Mine</button>
          <button type="button" aria-pressed={mode === 'crew'} onClick={() => setMode('crew')}>Crew</button>
        </div>
      )}
      {items.length > 0 && (
        <div className="actions">
          <button type="button" className="btn" onClick={exportMd}>Export (.md)</button>
          <button type="button" className="btn" onClick={copyText}>{copied ? 'Copied' : 'Copy as text'}</button>
        </div>
      )}
      {!items.length ? (
        <p className="src">No picks yet — star some events and the reading list builds itself from the speakers’ books and each briefing’s suggestions.</p>
      ) : (
        <div className="rl">
          {items.map(({e, bks, reads, going}) => (
            <div className="rl-ev" key={e.eventNo}>
              <div className="t">{DAYS[e.date].slice(0, 3)} {e.time} · {e.venue}{going && going.length ? ' · ' + going.join(', ') : ''}</div>
              <h4><button type="button" onClick={() => useSheet.getState().open('event', e.eventNo)}>{e.title}</button></h4>
              {(bks.length || reads.length) ? (
                <ul>
                  {bks.map((b, i) => <li key={'b' + i}>{b.who}: <b>{b.title}</b>{b.year ? <span> ({b.year})</span> : null}</li>)}
                  {reads.map((r, i) => <li key={'r' + i}><b>{r.title}</b> — <span>{r.by}</span>{r.note ? <><br /><span>{r.note}</span></> : null}</li>)}
                </ul>
              ) : <p className="src">Nothing on file for this event.</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
