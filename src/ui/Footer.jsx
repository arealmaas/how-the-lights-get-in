// src/ui/Footer.jsx — ported verbatim from the old <footer>: the disclaimer, the ticketing/storage note,
// the privacy paragraph (only when a Firebase config makes accounts real), the briefings note, the offline
// note and the source link.
import {EVENTS, SPEAKERS, ACTS, EXTRACTED_AT, CLOUD} from '../data/index.js';

const EXTRACTED_LABEL = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}).format(new Date(EXTRACTED_AT));
const SAVED_WHERE = CLOUD
  ? 'Picks, notes and debate verdicts are saved in this browser, or in your account if you sign in.'
  : 'Picks, notes and debate verdicts are saved in this browser.';

export default function Footer(){
  return (
    <footer>
      <div className="disclaimer" id="about">
        <b>Unofficial.</b> This planner is fan-made by a festival-goer and is not affiliated with, endorsed by, or connected to HowTheLightGetsIn or the Institute of Art and Ideas (IAI). Event descriptions, speaker biographies and photographs are © the IAI and the respective photographers, reproduced at reduced size from <a href="https://howthelightgetsin.org/festivals/london/programme" target="_blank" rel="noopener">howthelightgetsin.org</a> (extracted {EXTRACTED_LABEL}: {EVENTS.length} events, {SPEAKERS.length} speakers and hosts, {ACTS.length} acts) so festival-goers can plan their weekend. The programme may change — check the official programme for the latest details and for tickets. Times shown are start times; end times in calendar exports are estimates.
      </div>
      <div className="noprint">
        Ticketing: “Fast Pass” events are included with a Festival Ticket, with an optional paid pass that skips the queue and reserves a seat. Inner Circle meals and banquets are sold separately. {SAVED_WHERE} “My festival” in the header gathers them: a link that carries picks and verdicts to another device or a friend, a calendar export of all picks at once, a Markdown export of your notes, and the reading list built from the speakers you picked.
      </div>
      {CLOUD && (
        <div className="noprint" id="privacy">
          If you sign in, your email address, name, picks, debate verdicts, notes and crew are stored in Firebase (Google), in the EU. Only you can read them; people in your crew see your picks, verdicts and the notes you choose to share. The site sets no cookies and has no analytics; Google sign-in opens Google’s pages, which do. “Delete account” in My festival removes everything.
        </div>
      )}
      <div className="noprint">Debate briefings are unofficial notes written with Claude (AI) from the programme text and the speakers’ published work — inferred, hedged, and not the speakers’ or the festival’s words; corrections welcome on GitHub. Music, comedy and film links were looked up by hand; where none was found the planner offers a search instead.</div>
      <div className="noprint offline-note">Once loaded, the planner works offline — add it to your home screen for the weekend. Add <code>?now=2026-09-19T14:00</code> to the address to preview festival-day mode.</div>
      <div className="noprint">Source code and data: <a href="https://github.com/arealmaas/how-the-lights-get-in" target="_blank" rel="noopener">github.com/arealmaas/how-the-lights-get-in</a></div>
    </footer>
  );
}
