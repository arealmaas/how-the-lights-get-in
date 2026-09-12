// src/ui/hub/HubCards.jsx — ports showHub()'s "cards" block: with no picks, the hub-empty nudge (with a
// sign-in hint when accounts are on); otherwise the reading-list card (opens the reading sheet), the
// calendar export of all picks and the share link (picksLink, with a Copy button).
// NotesSection handles the notebook and export independently of picks.
import {useRef, useState} from 'react';
import {EVENTS, EXTRA, BRIEFINGS, CLOUD} from '../../data/index.js';
import {usePlanner} from '../../store/planner.js';
import {useSheet} from '../../store/sheet.js';
import {useCloud} from '../../store/cloud.js';
import {okBanner} from '../../store/banner.js';
import {readingList, readingCount} from '../../core/reading.js';
import {picksLink} from '../../core/exports.js';
import {icsFile} from '../../core/calendar.js';
import {download} from '../download.js';

export default function HubCards({mine}){
  const picks = usePlanner(s => s.picks);
  const verdicts = usePlanner(s => s.verdicts);
  const user = useCloud(s => s.user);
  const [copied, setCopied] = useState(false);
  const linkRef = useRef(null);

  if (!mine.length) {
    return (
      <div className="hub-empty">
        <b>Build your own weekend</b>
        <span>Tap ☆ on any event to pick it. Your picks, clash warnings, reading list, calendar export and a shareable link all build from there — everything is saved in this browser.</span>
        {CLOUD && !user && <span>Sign in (below) to keep your picks on every device.</span>}
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            useSheet.getState().close();
            document.getElementById('main')?.scrollIntoView({behavior: 'smooth', block: 'start'});
          }}
        >
          Browse the programme
        </button>
      </div>
    );
  }

  const rl = readingCount(readingList(EVENTS, picks, EXTRA, BRIEFINGS));
  const link = picksLink(location.origin + location.pathname, picks, verdicts);

  function copyLink(){
    linkRef.current?.select();
    try {
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }, () => {});
    } catch (e) {}
  }
  function exportPicks(){
    if (!mine.length) { okBanner('No picks yet — tap ☆ on an event to add it, then export them all at once.'); return; }
    download('htlgi-london-2026-my-picks.ics', icsFile(mine, 'HTLGI London 2026 — my picks'), 'text/calendar;charset=utf-8');
  }

  return (
    <div className="hub-cards">
      <button type="button" className="hub-card rl" onClick={() => useSheet.getState().open('reading')}>
        <b>{rl}</b>
        <span className="hc-k">Reading list</span>
        <span className="hc-t">{rl ? 'Books and articles to read before you go' : 'Nothing on file yet for these picks'}</span>
        <span className="hc-go">Open →</span>
      </button>
      <div className="hub-card">
        <span className="hc-k">Calendar</span>
        <span className="hc-d">All picks as one file, with summaries, venue, speakers and a 15-minute reminder.</span>
        <div className="actions">
          <button type="button" className="btn" onClick={exportPicks}>Export picks (.ics)</button>
        </div>
      </div>
      <div className="hub-card">
        <span className="hc-k">Share or move to your phone</span>
        <div className="linkrow">
          <input id="picklink" ref={linkRef} readOnly value={link} aria-label="Link to my picks" />
          <button type="button" className="btn primary" onClick={copyLink}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <span className="hc-d">Carries your picks and debate verdicts.</span>
      </div>
    </div>
  );
}
