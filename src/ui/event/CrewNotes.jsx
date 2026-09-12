// src/ui/event/CrewNotes.jsx — CREW-SPEC section 7: the notes other members chose to share, read-only,
// with the author's name. It sits directly after my own notes box, so the two kinds of note read together.
// The text is another account's, and it is rendered as React text nodes — that is what replaces the old
// page's esc(). A note containing <b>bold</b> shows those characters; there is no innerHTML here.
import {useCloud, selectMyUid} from '../../store/cloud.js';

export default function CrewNotes({no}){
  const crew = useCloud(s => s.crew);
  const myUid = useCloud(selectMyUid);
  if (!crew || !myUid) return null;

  const from = crew.members.filter(m => m.uid !== myUid && m.notes && m.notes[no] && String(m.notes[no]).trim());
  if (!from.length) return null;

  return (
    <>
      <h3 className="sub">Crew notes</h3>
      {from.map(m => (
        <div className="crewnote" key={m.uid}>
          <b>{m.name}</b>
          <div className="note-text">{String(m.notes[no])}</div>
        </div>
      ))}
    </>
  );
}
