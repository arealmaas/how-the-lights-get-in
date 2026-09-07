// src/ui/event/Notes.jsx — the notes textarea with a local draft: typing schedules a 250ms debounced
// commit to the planner store; blur flushes immediately. A store update that arrives while the textarea
// is focused (eg. a cloud snapshot applying) does not clobber what's being typed — the draft only follows
// the store when the textarea isn't the focused element. Unmounting with a debounce still pending
// (Escape while focused, or routing.js opening another event, closes this sheet without a blur ever
// firing) commits the latest draft instead of losing it — the old page's closeSheet() always flushed
// unconditionally, so losing the last keystrokes here would be a regression.
// `data-note` on the textarea is how cloud/sync.js's applyUserData() spots which note is being typed and
// keeps the local text for that one event when a snapshot lands.
import {useEffect, useRef, useState} from 'react';
import {usePlanner} from '../../store/planner.js';
import {useCloud} from '../../store/cloud.js';

export default function Notes({no}){
  const storeNote = usePlanner(s => s.notes[no] || '');
  const user = useCloud(s => s.user);
  const [draft, setDraft] = useState(storeNote);
  const ref = useRef(null);
  const timer = useRef(null);
  const draftRef = useRef(draft);
  const pendingRef = useRef(false);

  // A snapshot only replaces the draft while unfocused; draftRef is kept in lockstep with draft here too
  // (not just in onChange) so a later forced flush (blur) never commits a value staler than what's shown.
  useEffect(() => {
    if (document.activeElement !== ref.current) { draftRef.current = storeNote; setDraft(storeNote); }
  }, [storeNote]);

  // Commits the latest draft. Gated on pendingRef by default: a no-op once the debounce already
  // committed, or when nothing was ever typed, so an ordinary unmount doesn't rewrite the store with a
  // value it already holds. force=true (blur) always commits regardless of pendingRef — blur is a
  // deliberate "done editing" signal and must win even over a snapshot that landed after the debounce
  // already fired, the same guarantee the effect above gives while focused.
  function flush(force){
    clearTimeout(timer.current);
    if (!pendingRef.current && !force) return;
    pendingRef.current = false;
    usePlanner.getState().setNote(no, draftRef.current);
  }

  useEffect(() => () => flush(), []);

  function onChange(ev){
    const text = ev.target.value;
    draftRef.current = text;
    setDraft(text);
    pendingRef.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 250);
  }

  return (
    <>
      <textarea
        ref={ref}
        className="notes"
        data-note={no}
        placeholder="Thoughts, quotes, questions to ask…"
        rows={4}
        value={draft}
        onChange={onChange}
        onBlur={() => flush(true)}
      />
      <p className="src">
        {user ? 'Saved to your account.' : 'Saved in this browser only.'} “Export notes” in My festival writes picks, notes and verdicts to a Markdown file.
      </p>
    </>
  );
}
