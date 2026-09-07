// src/ui/sheets/SpeakerSheet.jsx — ports showSpeaker()/extrasBlock(): portrait, tagline, bio paragraphs,
// festival-profile/Wikipedia/IAI TV links, books, and the events the speaker speaks at or hosts.
// AppearsList is also used by ActSheet.jsx (the same list of events, sorted and picked-marked).
import {Fragment} from 'react';
import {spkBySlug, spkByName, byNo, DAYS, EXTRA} from '../../data/index.js';
import {usePlanner} from '../../store/planner.js';
import {useSheet} from '../../store/sheet.js';
import {Portrait} from '../event/People.jsx';

export default function SpeakerSheet({slug}){
  const s = spkBySlug.get(slug) || spkByName.get(String(slug).toLowerCase());
  if (!s) return null;

  return (
    <>
      <div className="profile">
        <div>
          <div className="kicker"><span>Speaker</span></div>
          <h2 id="sheet-title" tabIndex={-1}>{s.name}</h2>
          {s.tagline && <p className="tagline">{s.tagline}</p>}
        </div>
        <Portrait photo={s.photo} />
      </div>
      <div className="bio">
        {(s.bio || '').split(/\n{2,}|\n/).filter(Boolean).map((t, i) => <p key={i}>{t}</p>)}
      </div>
      <Extras s={s} />
      <h3 className="sub">Appears in</h3>
      <AppearsList nos={[...s.speaks, ...s.hosts]} />
    </>
  );
}

function Extras({s}){
  const x = (s.slug && EXTRA[s.slug]) || {};
  const links = [];
  if (s.profileUrl) links.push({key: 'profile', href: s.profileUrl, label: 'Festival profile'});
  if (x.wikipedia) links.push({key: 'wiki', href: x.wikipedia, label: 'Wikipedia'});
  if (x.iaiTv) links.push({key: 'iai', href: x.iaiTv, label: 'Past talks on IAI TV'});
  const books = x.books || [];
  if (!links.length && !books.length) return null;

  return (
    <dl className="meta">
      {links.length > 0 && (
        <>
          <dt>Elsewhere</dt>
          <dd>
            {links.map((l, i) => (
              <Fragment key={l.key}>{i > 0 ? ' · ' : ''}<a href={l.href} target="_blank" rel="noopener">{l.label} ↗</a></Fragment>
            ))}
          </dd>
        </>
      )}
      {books.length > 0 && (
        <>
          <dt>Books</dt>
          <dd><ul className="books">{books.map((b, i) => <li key={i}>{b.title}{b.year ? <span> ({b.year})</span> : null}</li>)}</ul></dd>
        </>
      )}
    </dl>
  );
}

export function AppearsList({nos}){
  const picks = usePlanner(s => s.picks);
  const events = nos.map(n => byNo.get(n)).filter(Boolean).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return (
    <ul className="applist">
      {events.map(e => (
        <li key={e.eventNo}>
          <button type="button" onClick={() => useSheet.getState().open('event', e.eventNo)}>
            <span className="t">{DAYS[e.date].slice(0, 3)} {e.time}</span>
            <span className="n">{e.title}</span>
            <span className="v">{e.type} · {e.venue}{picks.has(e.eventNo) ? ' · ★ picked' : ''}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
