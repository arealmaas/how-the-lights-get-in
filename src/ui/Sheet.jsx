// src/ui/Sheet.jsx — the sheet container: scrim, back/close bar, and the body for whichever kind of sheet
// is on top of the stack. Ports openSheet()/closeSheet()/goBack()'s DOM bookkeeping (scroll-to-top on
// open, focus the h2, Escape to close) as effects instead of imperative DOM writes; no innerHTML — the
// body is real components keyed off the sheet store.
import {useEffect, useRef, useState} from 'react';
import {useSheet} from '../store/sheet.js';
import EventSheet from './sheets/EventSheet.jsx';
import SpeakerSheet from './sheets/SpeakerSheet.jsx';
import ActSheet from './sheets/ActSheet.jsx';
import HubSheet from './sheets/HubSheet.jsx';
import StatsSheet from './sheets/StatsSheet.jsx';
import ReadingSheet from './sheets/ReadingSheet.jsx';

export default function Sheet(){
  const stack = useSheet(s => s.stack);
  const back = useSheet(s => s.back);
  const close = useSheet(s => s.close);
  const bodyRef = useRef(null);
  const sheetRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const top = stack.length ? stack[stack.length - 1] : null;
  const open = !!top;

  // Fix the page in place on phones too, and return to the opener without losing the time slot.
  // This runs before title focus so we remember the element that opened the sheet.
  useEffect(() => {
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

  // Expanding only changes layout: tab selection, notes and reading position stay intact.
  useEffect(() => {
    if (!open) return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    const h2 = document.getElementById('sheet-title');
    if (h2) h2.focus({preventScroll: true});
  }, [stack]);

  useEffect(() => {
    if (!open) return;
    const onKey = ev => {
      if (ev.key === 'Escape') { close(); return; }
      if (ev.key !== 'Tab') return;
      // Account/invite banners are deliberately above the sheet and must stay reachable.
      const surfaces = [document.querySelector('.banner'), sheetRef.current].filter(Boolean);
      const controls = surfaces.flatMap(surface => [...surface.querySelectorAll(
        'a[href], button, input, select, textarea, iframe, [tabindex]'
      )]).filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1), active = document.activeElement;
      if (!controls.length) { ev.preventDefault(); sheetRef.current?.focus(); }
      else if (!controls.includes(active) || (ev.shiftKey ? active === first : active === last)) {
        ev.preventDefault();
        (ev.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  let body = null;
  if (top) {
    if (top.kind === 'event') body = <EventSheet key={`${top.key}-${top.mode || ''}`} no={top.key} mode={top.mode} />;
    else if (top.kind === 'speaker') body = <SpeakerSheet key={top.key} slug={top.key} />;
    else if (top.kind === 'act') body = <ActSheet key={top.key} slug={top.key} />;
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
        <div className="sheet-body" id="sheet-body" ref={bodyRef}>
          {body}
        </div>
      </section>
    </>
  );
}
