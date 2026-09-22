import {useLayoutEffect, useRef, useState} from 'react';
import {useSheet} from '../store/sheet.js';
import '../styles/festival-finale.css';

const DISMISSED_KEY = 'htlgi:festival-finale:2026:dismissed';

function wasDismissed(){
  try { return sessionStorage.getItem(DISMISSED_KEY) === '1'; }
  catch { return false; }
}

// An open door and its last pool of light: a little festival poster, drawn locally
// so the farewell works offline along with the rest of the programme.
function Afterglow(){
  return (
    <div className="finale-art" aria-hidden="true">
      <div className="finale-edition">HOWTHELIGHTGETSIN<span>LONDON · 2026</span></div>
      <svg className="finale-light" viewBox="0 0 360 540" fill="none">
        <defs>
          <radialGradient id="finale-halo">
            <stop stopColor="#EABB67" stopOpacity=".3" />
            <stop offset="1" stopColor="#EABB67" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="finale-door" x1="155" y1="220" x2="219" y2="356" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF7D5" />
            <stop offset="1" stopColor="#E9AC50" />
          </linearGradient>
          <linearGradient id="finale-spill" x1="180" y1="351" x2="170" y2="540" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F6CB7E" stopOpacity=".7" />
            <stop offset="1" stopColor="#F6CB7E" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ellipse className="finale-halo" cx="180" cy="294" rx="190" ry="210" fill="url(#finale-halo)" />
        <g stroke="#E6CB93" strokeOpacity=".16">
          <path d="M46 356V233a134 134 0 0 1 268 0v123" />
          <path d="M73 356V233a107 107 0 0 1 214 0v123" />
          <path d="M100 356V233a80 80 0 0 1 160 0v123" />
          <path d="M0 356h360" />
          <ellipse cx="180" cy="356" rx="152" ry="35" />
          <ellipse cx="180" cy="356" rx="235" ry="71" />
        </g>
        <path d="M132 354V234a48 48 0 0 1 96 0v120Z" fill="#111D21" stroke="#E6CB93" strokeOpacity=".5" />
        <path d="M180 191a48 48 0 0 1 43 43v120h-43Z" fill="url(#finale-door)" />
        <path d="m180 192-43 23v166l43-27Z" fill="#273130" stroke="#CDA666" strokeWidth=".8" />
        <path d="m180 354-43 27-57 159h262L223 354Z" fill="url(#finale-spill)" />
        <path d="M180 192v162" stroke="#FFF1C2" strokeWidth="2" />
        <circle cx="169" cy="286" r="2" fill="#E8C890" />
        <g fill="#F4D394">
          <path d="m280 132 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" />
          <path d="m80 266 1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5 5-1.5Z" opacity=".65" />
          <circle cx="106" cy="111" r="1.5" opacity=".8" />
          <circle cx="248" cy="92" r="1" opacity=".6" />
          <circle cx="295" cy="286" r="1.5" opacity=".6" />
          <circle cx="60" cy="188" r="1" opacity=".5" />
        </g>
      </svg>
      <div className="finale-art-caption">19—20 SEPTEMBER<span>Carry the questions with you.</span></div>
    </div>
  );
}

export default function FestivalFinale(){
  const [dismissed, setDismissed] = useState(wasDismissed);
  const sheetOpen = useSheet(s => s.stack.length > 0);
  const dialogRef = useRef(null);
  const titleRef = useRef(null);
  // Shared event links retain their destination. The farewell waits until the
  // visitor returns to the programme, avoiding two competing modal surfaces.
  const visible = !dismissed && !sheetOpen;

  useLayoutEffect(() => {
    if (!visible) return;
    const dialog = dialogRef.current;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    dialog.showModal();
    titleRef.current?.focus({preventScroll: true});
    return () => {
      if (dialog.open) dialog.close();
      root.style.overflow = previousOverflow;
    };
  }, [visible]);

  function dismiss(){
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); }
    catch { /* Dismissal still works when browser storage is unavailable. */ }
    dialogRef.current?.close();
    setDismissed(true);
    document.getElementById('main')?.focus({preventScroll: true});
  }

  function trapFocus(event){
    if (event.key !== 'Tab') return;
    const controls = [...dialogRef.current.querySelectorAll('button')];
    const index = controls.indexOf(document.activeElement);
    const next = index < 0 ? (event.shiftKey ? controls.length - 1 : 0)
      : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    event.preventDefault();
    controls[next].focus();
  }

  if (!visible) return null;

  return (
    <dialog ref={dialogRef} className="festival-finale" aria-labelledby="finale-title" aria-describedby="finale-description"
      onKeyDown={trapFocus}
      onCancel={event => { event.preventDefault(); dismiss(); }}>
      <button type="button" className="finale-close" aria-label="Close festival message" onClick={dismiss}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
      <div className="finale-poster">
        <Afterglow />
        <div className="finale-message">
          <p className="finale-kicker"><span /> THAT’S A WRAP</p>
          <h2 ref={titleRef} id="finale-title" tabIndex={-1}>The weekend ends. <span>The light stays.</span></h2>
          <p id="finale-description">HowTheLightGetsIn London 2026 has come to a close. Here’s to the big questions, the chance encounters, and the ideas that followed you home.</p>
          <div className="finale-continue">
            <p>The festival is over. The programme is still yours to explore.</p>
            <button type="button" className="finale-explore" onClick={dismiss}>
              Explore the programme <span aria-hidden="true">↗</span>
            </button>
            <p className="finale-keepsake">Your picks, notes and reading list are still here.</p>
          </div>
          <p className="finale-signoff">A little unofficial companion to a memorable weekend.</p>
        </div>
      </div>
    </dialog>
  );
}
