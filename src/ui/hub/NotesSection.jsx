import {useState} from 'react';
import {EVENTS, DAYS} from '../../data/index.js';
import {usePlanner} from '../../store/planner.js';
import {useSheet} from '../../store/sheet.js';
import {notesMarkdown} from '../../core/exports.js';
import {download} from '../download.js';

// Notes belong to events, whether or not those events are in the user's picks.
export default function NotesSection(){
  const notes = usePlanner(s => s.notes);
  const picks = usePlanner(s => s.picks);
  const verdicts = usePlanner(s => s.verdicts);
  const [query, setQuery] = useState('');
  const all = EVENTS.filter(e => notes[e.eventNo]?.trim());
  const q = query.trim().toLocaleLowerCase();
  const shown = all.filter(e => `${e.title} ${e.venue} ${notes[e.eventNo]}`.toLocaleLowerCase().includes(q));
  const verdictN = Object.keys(verdicts).length;

  return (
    <section className="notebook" aria-labelledby="notebook-title">
      <div className="notebook-header">
        <div>
          <h3 id="notebook-title">My notes <span>{all.length}</span></h3>
          <p>Thoughts from your festival, all in one place.</p>
        </div>
        {(all.length > 0 || verdictN > 0) && <button type="button" className="btn" onClick={() => download('htlgi-london-2026-notes.md', notesMarkdown(EVENTS, picks, notes, verdicts), 'text/markdown;charset=utf-8')}>Export notes (.md)</button>}
      </div>
      {all.length ? (
        <>
          <input className="notes-search" type="search" aria-label="Search my notes" placeholder="Search notes or events…" value={query} onChange={ev => setQuery(ev.target.value)} />
          {shown.length ? <div className="notebook-list">
            {shown.map(e => (
              <article className="notebook-entry" key={e.eventNo}>
                <div className="notebook-entry-top">
                  <p className="notebook-when">{DAYS[e.date]} · {e.time} · {e.venue}</p>
                  <button type="button" className="btn" aria-label={`Edit note for ${e.title}`} onClick={() => useSheet.getState().open('event', e.eventNo, 'edit-note')}>Edit note</button>
                </div>
                <h4><button type="button" onClick={() => useSheet.getState().open('event', e.eventNo, 'notes')}>{e.title}</button></h4>
                <div className="note-text">{notes[e.eventNo]}</div>
              </article>
            ))}
          </div> : <p className="notes-empty">No notes match “{query}”.</p>}
        </>
      ) : <p className="notes-empty">Open an event and choose <b>Notes</b> to start writing. You can find, edit and export your notes here, even for events you haven’t picked.</p>}
    </section>
  );
}
