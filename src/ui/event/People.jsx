// src/ui/event/People.jsx — small photo components ported from the old page's avatar()/hero()/portrait(),
// and the People row from showEvent(): a button per speaker/host and per act, opening that person's or
// act's sheet when they have a bio to show, disabled (not a link) otherwise.
import {spkBySlug, spkByName, actBySlug} from '../../data/index.js';
import {initials} from '../../core/labels.js';
import {useSheet} from '../../store/sheet.js';

export function Avatar({photo, name}){
  return photo
    ? <img className="avatar" src={'/' + photo} alt="" loading="lazy" decoding="async" />
    : <i className="avatar ini" aria-hidden="true">{initials(name)}</i>;
}

export function Hero({photo}){
  return photo ? <img className="hero" src={'/' + photo} alt="" decoding="async" /> : null;
}

export function Portrait({photo}){
  return photo ? <img className="portrait" src={'/' + photo} alt="" decoding="async" /> : null;
}

export function People({e}){
  const people = e.people.map(pe => {
    const s = pe.slug ? spkBySlug.get(pe.slug) : spkByName.get(pe.name.toLowerCase());
    return {pe, s, has: !!(s && s.bio)};
  });
  const acts = (e.actSlugs || []).map(s => actBySlug.get(s)).filter(a => a && a.bio);
  if (!people.length && !acts.length) return null;

  return (
    <div className="people">
      {people.map(({pe, s, has}) => (
        <button
          key={pe.slug || pe.name}
          type="button"
          className={`person${has ? ' link' : ''}`}
          disabled={!has}
          onClick={has ? () => useSheet.getState().open('speaker', s.slug || s.name) : undefined}
        >
          <Avatar photo={s && s.photo} name={pe.name} />
          <span>{pe.name}{pe.role === 'host' && <> <small>host</small></>}</span>
        </button>
      ))}
      {acts.map(a => (
        <button
          key={a.slug}
          type="button"
          className="person link"
          onClick={() => useSheet.getState().open('act', a.slug)}
        >
          <Avatar photo={a.photo} name={a.name} />
          <span>{a.name} <small>{a.kind}</small></span>
        </button>
      ))}
    </div>
  );
}
