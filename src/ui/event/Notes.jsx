// A draft autosaves and flushes on blur, page backgrounding and unmount. Save note also
// opens a readable, unabridged view. Account saves wait for Firebase's acknowledgement.
import {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {usePlanner} from '../../store/planner.js';
import {useCloud, selectMyUid} from '../../store/cloud.js';
import {CLOUD} from '../../data/index.js';
import {NOTE_LIMIT} from '../../core/notes.js';

export default function Notes({no, initialEditing = false}){
  const storeNote = usePlanner(s => s.notes[no] || '');
  const isShared = usePlanner(s => !!s.shared[no]);
  const user = useCloud(s => s.user);
  const crew = useCloud(s => s.crew);
  const myUid = useCloud(selectMyUid);
  const syncStopped = useCloud(s => s.syncStopped);
  const syncPaused = useCloud(s => s.syncPaused);
  const [draft, setDraft] = useState(storeNote);
  const [editing, setEditing] = useState(initialEditing || !storeNote);
  const [status, setStatus] = useState(storeNote ? 'local' : 'empty');
  const [online, setOnline] = useState(navigator.onLine);
  const ref = useRef(null);
  const editRef = useRef(null);
  const focusNext = useRef(false);
  const timer = useRef(null);
  const draftRef = useRef(draft);
  const pendingRef = useRef(false);
  const editedRef = useRef(false);
  const revision = useRef(0);
  const lastSave = useRef(null);
  const mounted = useRef(false);
  const id = useId();

  // Keep an active draft when a snapshot arrives, including with the keyboard dismissed.
  useEffect(() => {
    if (pendingRef.current || (editing && editedRef.current)) return;
    draftRef.current = storeNote;
    setDraft(storeNote);
  }, [storeNote, editing]);

  function flush(force = false, updateStatus = true){
    clearTimeout(timer.current);
    if (!pendingRef.current && !force) return;
    if (draftRef.current.length > NOTE_LIMIT) {
      if (updateStatus && mounted.current) setStatus('too-long');
      return {local: false};
    }
    // Blur and Save often happen on the same tap. Reuse a successful local save unless
    // the store changed underneath the draft or the account write needs a retry.
    if (!pendingRef.current && lastSave.current?.text === draftRef.current &&
        (usePlanner.getState().notes[no] || '') === draftRef.current && lastSave.current.result.local) return lastSave.current.result;
    pendingRef.current = false;
    const version = ++revision.current;
    const result = usePlanner.getState().setNote(no, draftRef.current);
    lastSave.current = {text: draftRef.current, result};
    if (!updateStatus || !mounted.current) return result;
    const local = result?.local !== false;
    const cloud = result?.cloud;
    setStatus(local ? (cloud ? 'syncing' : 'local') : (cloud ? 'saving' : 'error'));
    if (cloud) cloud.then(saved => {
      if (!mounted.current || version !== revision.current) return;
      if (!saved) lastSave.current = null;
      setStatus(saved ? 'synced' : (local ? 'sync-error' : 'error'));
    });
    return result;
  }

  useEffect(() => {
    mounted.current = true;
    const background = () => { if (document.visibilityState === 'hidden') flush(); };
    const leave = () => flush();
    const connection = () => setOnline(navigator.onLine);
    document.addEventListener('visibilitychange', background);
    window.addEventListener('pagehide', leave);
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    return () => {
      flush(false, false);
      mounted.current = false;
      document.removeEventListener('visibilitychange', background);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
    };
  }, [no]);

  // Remeasure after text, tab, viewport, font or full-screen changes. Only the sheet scrolls.
  function resize(){
    const el = ref.current;
    if (!el || !el.clientWidth) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }
  useLayoutEffect(resize, [draft, editing]);
  useEffect(() => {
    if (!editing || !ref.current) return;
    let width = 0;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
      const next = entries[0].contentRect.width;
      if (next !== width) { width = next; resize(); }
    });
    observer?.observe(ref.current);
    let active = true;
    document.fonts?.ready.then(() => { if (active) resize(); });
    return () => { active = false; observer?.disconnect(); };
  }, [editing]);
  useLayoutEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    (editing ? ref.current : editRef.current)?.focus({preventScroll: true});
  }, [editing]);

  function onChange(ev){
    draftRef.current = ev.target.value;
    setDraft(ev.target.value);
    pendingRef.current = true;
    editedRef.current = true;
    revision.current++;
    setStatus('typing');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 250);
  }
  function saveNote(){
    const result = flush(true);
    if (result?.local === false) return;
    editedRef.current = false;
    focusNext.current = true;
    setEditing(false);
  }
  function editNote(){
    editedRef.current = false;
    focusNext.current = true;
    setEditing(true);
  }

  let message = 'Saved on this device';
  if (status === 'empty') message = 'Your words, ready when you are';
  else if (status === 'typing') message = 'Saving…';
  else if (status === 'error') message = 'Couldn’t save. Keep this note open and copy your text, then try Save note again.';
  else if (status === 'too-long') message = 'This note is over 20,000 characters. Shorten it before saving; your saved note is unchanged.';
  else if (status === 'saving') message = 'Saving to your account… Keep this note open.';
  else if (status === 'synced' && user && !syncStopped) message = 'Saved to your account';
  else if (status === 'sync-error') message = 'Saved on this device · account sync failed';
  else if (myUid && (syncStopped || syncPaused)) message = 'Saved on this device · account sync paused';
  else if (myUid && !online) message = 'Saved on this device · will sync when online';
  else if (status === 'syncing') message = 'Saved on this device · syncing…';

  return (
    <section className="note-card" aria-label="My note">
      <div className="note-toolbar">
        <span className="note-label">{isShared && crew ? 'Shared with crew' : 'Private note'}</span>
        {editing
          ? <button type="button" className="btn primary" onClick={saveNote}>Save note</button>
          : <button ref={editRef} type="button" className="btn" onClick={editNote}>{draft ? 'Edit note' : 'Add a note'}</button>}
      </div>
      {editing ? (
        <>
          <textarea
            id={id}
            ref={ref}
            className="notes"
            data-note={no}
            aria-label="My note"
            aria-describedby={`${id}-hint ${id}-count`}
            placeholder="An idea to remember, a quote that stayed with you, a question to ask…"
            rows={8}
            maxLength={NOTE_LIMIT}
            value={draft}
            onChange={onChange}
            onBlur={() => { if (editedRef.current) flush(true); }}
            onKeyDown={ev => { if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') { ev.preventDefault(); saveNote(); } }}
          />
          <div className="note-editor-meta">
            <span id={`${id}-hint`}>Saves as you write</span>
            <span id={`${id}-count`}>{draft.length.toLocaleString('en-GB')} / 20,000 characters{draft.length >= NOTE_LIMIT ? ' · limit reached' : ''}</span>
          </div>
        </>
      ) : (
        <div className={`note-text${draft ? '' : ' note-empty'}`}>{draft || 'No note yet. Make room for a thought.'}</div>
      )}
      <div className="note-footer">
        <p className="note-status" role="status" data-state={status}>{message}</p>
        {status === 'sync-error' && <button type="button" className="btn note-retry" onClick={() => flush(true)}>Retry save</button>}
        {crew && myUid ? (
          <label className="share">
            <input type="checkbox" checked={isShared} onChange={ev => { flush(); usePlanner.getState().setShared(no, ev.target.checked); }} />
            Share this note with the crew
          </label>
        ) : <p className="note-hint">{user ? 'Only you can see this note.' : `Saved in this browser.${CLOUD ? ' Sign in from My festival to keep notes across devices.' : ''}`}</p>}
      </div>
    </section>
  );
}
