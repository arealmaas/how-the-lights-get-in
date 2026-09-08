// src/ui/sheets/ActSheet.jsx — ports showAct(): portrait, kind kicker, bio paragraphs, the festival
// profile link, and (when the act has any) the events it performs at.
import {actBySlug} from '../../data/index.js';
import {Portrait} from '../event/People.jsx';
import {AppearsList} from './SpeakerSheet.jsx';

export default function ActSheet({slug}){
  const a = actBySlug.get(slug);
  if (!a) return null;

  return (
    <>
      <div className="profile">
        <div>
          <div className="kicker"><span>{a.kind}</span></div>
          <h2 id="sheet-title" tabIndex={-1}>{a.name}</h2>
        </div>
        <Portrait photo={a.photo} />
      </div>
      <div className="bio">
        {(a.bio || '').split(/\n{2,}|\n/).filter(Boolean).map((t, i) => <p key={i}>{t}</p>)}
      </div>
      <dl className="meta">
        <dt>Profile</dt>
        <dd><a href={a.profileUrl} target="_blank" rel="noopener">howthelightgetsin.org ↗</a></dd>
      </dl>
      {a.events.length > 0 && (
        <>
          <h3 className="sub">Performing</h3>
          <AppearsList nos={a.events} />
        </>
      )}
    </>
  );
}
