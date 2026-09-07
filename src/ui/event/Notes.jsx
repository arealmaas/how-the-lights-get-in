// src/ui/event/Notes.jsx — the notes textarea with a local draft: typing schedules a 250ms debounced
// commit to the planner store; blur flushes immediately. A store update that arrives while the textarea
// is focused (eg. a cloud snapshot applying) does not clobber what's being typed — the draft only follows
// the store when the textarea isn't the focused element.
import {useEffect, useRef, useState} from 'react';
import {usePlanner} from '../../store/planner.js';
import {useCloud} from '../../store/cloud.js';

export default function Notes({no}){
  const storeNote = usePlanner(s => s.notes[no] || '');
  const user = useCloud(s => s.user);
  const [draft, setDraft] = useState(storeNote);
  const ref = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    if (document.activeElement !== ref.current) setDraft(storeNote);
  }, [storeNote]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function onChange(ev){
    const text = ev.target.value;
    setDraft(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => usePlanner.getState().setNote(no, text), 250);
  }
  function onBlur(){
    clearTimeout(timer.current);
    usePlanner.getState().setNote(no, draft);
  }

  return (
    <>
      <textarea
        ref={ref}
        className="notes"
        placeholder="Thoughts, quotes, questions to ask…"
        rows={4}
        value={draft}
        onChange={onChange}
        onBlur={onBlur}
      />
      <p className="src">
        {user ? 'Saved to your account.' : 'Saved in this browser only.'} “Export notes” in My festival writes picks, notes and verdicts to a Markdown file.
      </p>
    </>
  );
}
