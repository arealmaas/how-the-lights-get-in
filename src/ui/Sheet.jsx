// src/ui/Sheet.jsx — the sheet container: scrim, back/close bar, and the body for whichever kind of sheet
// is on top of the stack. Ports openSheet()/closeSheet()/goBack()'s DOM bookkeeping (scroll-to-top on
// open, focus the h2, Escape to close) as effects instead of imperative DOM writes; no innerHTML — the
// body is real components keyed off the sheet store.
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useSheet} from '../store/sheet.js';
import EventSheet from './sheets/EventSheet.jsx';
import SpeakerSheet from './sheets/SpeakerSheet.jsx';
import ActSheet from './sheets/ActSheet.jsx';
import HubSheet from './sheets/HubSheet.jsx';
import StatsSheet from './sheets/StatsSheet.jsx';
import ReadingSheet from './sheets/ReadingSheet.jsx';
import MapSheet from './sheets/MapSheet.jsx';
import Banner from './Banner.jsx';

export default function Sheet(){
  const stack = useSheet(s => s.stack);
  const back = useSheet(s => s.back);
  const close = useSheet(s => s.close);
  const bodyRef = useRef(null);
  const sheetRef = useRef(null);
  const positions = useRef(new WeakMap());
  const nextEntryId = useRef(0);
  const [expanded, setExpanded] = useState(false);
  const top = stack.length ? stack[stack.length - 1] : null;
  const visibleEntry = useRef(top);
  const open = !!top;
  // Entries are stable while they remain on the stack. Keep their reading context without
  // leaving hidden dialogs mounted, which would duplicate titles and form IDs.
  if (top && !positions.current.has(top)) {
    positions.current.set(top, {id: ++nextEntryId.current, scrollTop: 0, sections: {}});
  }
  const position = top ? positions.current.get(top) : null;
  const firstVisit = position && !position.visited;

  // Scroll events can arrive after a history traversal has replaced the body. Save the
  // outgoing position synchronously while its content is still rendered, including
  // consecutive store changes that React may combine into one render.
  useLayoutEffect(() => useSheet.subscribe(state => {
    const outgoing = visibleEntry.current;
    if (outgoing && outgoing !== state.stack.at(-1) && bodyRef.current) {
      positions.current.get(outgoing).scrollTop = bodyRef.current.scrollTop;
    }
  }), []);

  // Fix the page in place on phones too, and return to the opener without losing the time slot.
  // This runs before title focus so we remember the element that opened the sheet.
  useLayoutEffect(() => {
    if (!open) {
      setExpanded(false);
      return;
    }
    const opener = document.activeElement;
    const {scrollX, scrollY} = window;
    const style = document.body.style;
    const previous = Object.fromEntries(['position', 'top', 'left', 'width', 'overflow', 'paddingRight']
      .map(property => [property, style[property]]));
    const scrollbar = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const padding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
    Object.assign(style, {
      position: 'fixed', top: `-${scrollY}px`, left: `-${scrollX}px`, width: '100%', overflow: 'hidden',
      paddingRight: `${padding + scrollbar}px`,
    });
    return () => {
      Object.assign(style, previous);
      if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
        window.scrollTo({left: scrollX, top: scrollY, behavior: 'instant'});
      }
      if (opener?.isConnected) opener.focus({preventScroll: true});
    };
  }, [open]);

  // New visits start at the title; Back/Forward restore a visited sheet's reading position.
  // Expanding only changes layout: tab selection, notes and reading position stay intact.
  useLayoutEffect(() => {
    visibleEntry.current = top;
    if (!open) return;
    const body = bodyRef.current;
    if (body) body.scrollTop = position.scrollTop;
    position.visited = true;
    // An explicit Edit note action should arrive ready to write. Only do this on entry:
    // Back keeps the reading position the user chose before opening another sheet.
    const editor = firstVisit && top.kind === 'event' && top.mode === 'edit-note'
      ? body?.querySelector('textarea.notes') : null;
    if (editor) {
      editor.focus({preventScroll: true});
      const card = editor.closest('.note-card') || editor;
      const sectionsHeight = body.querySelector('.event-tabs')?.offsetHeight || 0;
      body.scrollTop += card.getBoundingClientRect().top - body.getBoundingClientRect().top - sectionsHeight - 12;
      position.scrollTop = body.scrollTop;
      return;
    }
    const h2 = document.getElementById('sheet-title');
    if (h2) h2.focus({preventScroll: true});
  }, [top]);

  useEffect(() => {
    if (!open) return;
    const onKey = ev => {
      if (ev.key === 'Escape') { close(); return; }
      if (ev.key !== 'Tab') return;
      // Account/invite banners are deliberately above the sheet and must stay reachable.
      const surfaces = [document.querySelector('.banner'), sheetRef.current].filter(Boolean);
      const controls = [...new Set(surfaces.flatMap(surface => [...surface.querySelectorAll(
        'a[href], button, input, select, textarea, iframe, [tabindex]'
      )]))].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length > 0);
      // Own every Tab step so navigation cannot enter the obscured programme.
      ev.preventDefault();
      if (!controls.length) { sheetRef.current?.focus(); return; }
      const activeIndex = controls.indexOf(document.activeElement);
      const nextIndex = activeIndex < 0 ? (ev.shiftKey ? controls.length - 1 : 0)
        : (activeIndex + (ev.shiftKey ? -1 : 1) + controls.length) % controls.length;
      controls[nextIndex].focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  let body = null;
  if (top) {
    if (top.kind === 'event') body = <EventSheet key={position.id} no={top.key} mode={top.mode} initialTab={position.tab} onTabChange={tab => { position.tab = tab; }} sectionPositions={position.sections} />;
    else if (top.kind === 'speaker') body = <SpeakerSheet key={top.key} slug={top.key} />;
    else if (top.kind === 'act') body = <ActSheet key={top.key} slug={top.key} />;
    else if (top.kind === 'map') body = <MapSheet key={position.id} venue={top.key} />;
    // the hub's `mode` is where it opens: 'crew' scrolls to the crew cards (the masthead's crew button)
    else if (top.kind === 'hub') body = <HubSheet key={top.key} mode={top.mode} />;
    else if (top.kind === 'stats') body = <StatsSheet key={top.key} />;
    // the reading sheet is the one kind with a `mode`; keying on it too means opening it a second time
    // in a different mode remounts, so the tab it opens on is always the one that was asked for
    else if (top.kind === 'reading') body = <ReadingSheet key={top.mode || top.key} mode={top.mode} />;
  }

  return (
    <>
      <div id="scrim" className="scrim" hidden={!open} onClick={close} />
      <section id="sheet" ref={sheetRef} className={`sheet${expanded ? ' expanded' : ''}`} role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabIndex={-1} hidden={!open}>
        {open && <Banner />}
        <div className="sheet-bar">
          <div className="grip" aria-hidden="true" />
          <button type="button" className="btn" id="back" hidden={stack.length < 2} onClick={back}>← Back</button>
          <button type="button" className="btn sheet-expand" aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d={expanded ? 'M2 7h5V2m6 0v5h5M2 13h5v5m6 0v-5h5' : 'M7 2H2v5m11-5h5v5M2 13v5h5m6 0h5v-5'} />
            </svg>
            {expanded ? 'Compact view' : 'Full screen'}
          </button>
          <button type="button" className="close" id="close" aria-label="Close" onClick={close}>×</button>
        </div>
        <div className="sheet-body" id="sheet-body" ref={bodyRef} onScroll={ev => { if (position) position.scrollTop = ev.currentTarget.scrollTop; }}>
          {body}
        </div>
      </section>
    </>
  );
}
