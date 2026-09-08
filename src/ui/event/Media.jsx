// src/ui/event/Media.jsx — ports mediaBlock(): Spotify/YouTube/trailer buttons and search-link fallbacks
// for performances and films, with the click-to-load YouTube embed kept as local component state instead
// of an innerHTML swap.
import {useState} from 'react';
import {MEDIA, PLAYLIST, PERFORMANCE, actBySlug} from '../../data/index.js';
import {slug, ytId} from '../../core/labels.js';

export default function Media({e}){
  const isPerf = PERFORMANCE.has(e.type);
  const isFilm = e.type === 'DokBox';
  const [loaded, setLoaded] = useState({});
  if (!isPerf && !isFilm) return null;

  const entries = isFilm
    ? [[e.title, MEDIA.films[e.title], e.title]]
    : ((e.actSlugs && e.actSlugs.length) ? e.actSlugs : [slug(e.title)]).map(s => [s, MEDIA.acts[s], (actBySlug.get(s) || {}).name || e.title]);

  return (
    <>
      <h3 className="sub">{isFilm ? 'Watch' : 'Listen & watch'}</h3>
      <div className="media">
        {entries.map(([key, m, name]) => {
          const id = m && m.youtube ? ytId(m.youtube) : null;
          const links = (m && m.links) || [];
          return (
            <div className="media-item" key={key}>
              {entries.length > 1 && <div className="media-name">{name}</div>}
              {m && m.year && <p className="src">{String(m.year)}</p>}
              <div className="actions">
                {m && m.spotify && (
                  <a className="btn" href={m.spotify} target="_blank" rel="noopener">Spotify ↗</a>
                )}
                {m && m.youtube && (
                  id
                    ? (!loaded[key] && (
                        <button type="button" className="btn" onClick={() => setLoaded(l => ({...l, [key]: true}))}>
                          ▶ {m.youtubeLabel || 'Watch on YouTube'}
                        </button>
                      ))
                    : (
                        <a className="btn" href={m.youtube} target="_blank" rel="noopener">▶ {m.youtubeLabel || 'Watch on YouTube'} ↗</a>
                      )
                )}
                {m && m.trailer && (
                  <a className="btn" href={m.trailer} target="_blank" rel="noopener">Trailer ↗</a>
                )}
                {isPerf && !(m && m.spotify) && (
                  <a className="btn" href={`https://open.spotify.com/search/${encodeURIComponent(name)}`} target="_blank" rel="noopener">Search Spotify ↗</a>
                )}
                {!(m && (m.youtube || m.trailer)) && (
                  <a className="btn" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(name + (isFilm ? ' trailer' : ' live'))}`} target="_blank" rel="noopener">Search YouTube ↗</a>
                )}
              </div>
              {m && m.note && <p className="src">{m.note}</p>}
              {links.length > 0 && (
                <p className="media-links">
                  {links.map((l, i) => (
                    <span key={l.url}>{i > 0 ? ' · ' : ''}<a href={l.url} target="_blank" rel="noopener">{l.label} ↗</a></span>
                  ))}
                </p>
              )}
              {id && loaded[key] && (
                <div className="embed">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`}
                    title="YouTube video"
                    allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          );
        })}
        {isPerf && PLAYLIST && (
          <p className="media-links"><a href={PLAYLIST.url} target="_blank" rel="noopener">{PLAYLIST.label} ↗</a></p>
        )}
      </div>
    </>
  );
}
