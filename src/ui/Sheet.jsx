// src/ui/Sheet.jsx — the sheet container: scrim, back/close bar, and the body for whichever kind of sheet
// is on top of the stack. Ports openSheet()/closeSheet()/goBack()'s DOM bookkeeping (scroll-to-top on
// open, focus the h2, Escape to close) as effects instead of imperative DOM writes; no innerHTML — the
// body is real components keyed off the sheet store.
import {useEffect, useRef} from 'react';
import {useSheet} from '../store/sheet.js';
import EventSheet from './sheets/EventSheet.jsx';
import SpeakerSheet from './sheets/SpeakerSheet.jsx';
import ActSheet from './sheets/ActSheet.jsx';
import HubSheet from './sheets/HubSheet.jsx';
import CrewSheet from './sheets/CrewSheet.jsx';
import StatsSheet from './sheets/StatsSheet.jsx';
import ReadingSheet from './sheets/ReadingSheet.jsx';

export default function Sheet(){
  const stack = useSheet(s => s.stack);
  const back = useSheet(s => s.back);
  const close = useSheet(s => s.close);
  const bodyRef = useRef(null);
  const top = stack.length ? stack[stack.length - 1] : null;
  const open = !!top;

  // On each stack change (open/back/replaceTop), scroll the body to the top and focus the title.
  useEffect(() => {
    if (!open) return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    const h2 = document.getElementById('sheet-title');
    if (h2) h2.focus({preventScroll: true});
  }, [stack]);

  // Escape closes, only while a sheet is open.
  useEffect(() => {
    if (!open) return;
    const onKey = ev => { if (ev.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  let body = null;
  if (top) {
    if (top.kind === 'event') body = <EventSheet key={top.key} no={top.key} />;
    else if (top.kind === 'speaker') body = <SpeakerSheet key={top.key} slug={top.key} />;
    else if (top.kind === 'act') body = <ActSheet key={top.key} slug={top.key} />;
    else if (top.kind === 'hub') body = <HubSheet key={top.key} />;
    else if (top.kind === 'crew') body = <CrewSheet key={top.key} />;
    else if (top.kind === 'stats') body = <StatsSheet key={top.key} />;
    // the reading sheet is the one kind with a `mode`; keying on it too means opening it a second time
    // in a different mode remounts, so the tab it opens on is always the one that was asked for
    else if (top.kind === 'reading') body = <ReadingSheet key={top.mode || top.key} mode={top.mode} />;
  }

  return (
    <>
      <div id="scrim" className="scrim" hidden={!open} onClick={close} />
      <section id="sheet" className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" hidden={!open}>
        <div className="sheet-bar">
          <div className="grip" />
          <button type="button" className="btn" id="back" hidden={stack.length < 2} onClick={back}>← Back</button>
          <button type="button" className="close" id="close" aria-label="Close" onClick={close}>×</button>
        </div>
        <div className="sheet-body" id="sheet-body" ref={bodyRef}>
          {body}
        </div>
      </section>
    </>
  );
}
