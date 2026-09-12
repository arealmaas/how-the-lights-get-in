// src/ui/Toolbar.jsx — ported from the old <div class="top"> block: day and view segments, the search
// box, the filter chips and the venue/topic selects, plus the status line. The search input keeps its own
// raw text so typing isn't clobbered by the store's trimmed/lowercased query used for matching.
import {useEffect, useRef, useState} from 'react';
import {EVENTS, VENUES, TOPICS} from '../data/index.js';
import {usePlanner} from '../store/planner.js';
import Chips from './Chips.jsx';
import Status from './Status.jsx';

const SAT_COUNT = EVENTS.filter(e => e.date === '2026-09-19').length;
const SUN_COUNT = EVENTS.filter(e => e.date === '2026-09-20').length;

export default function Toolbar({clashes, shown}){
  const [text, setText] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const toolbar = useRef(null);
  const filterToggle = useRef(null);
  const day = usePlanner(s => s.day);
  const view = usePlanner(s => s.view);
  const venue = usePlanner(s => s.venue);
  const topic = usePlanner(s => s.topic);
  const groups = usePlanner(s => s.groups);
  const q = usePlanner(s => s.q);
  const setFilter = usePlanner(s => s.setFilter);
  const setQuery = usePlanner(s => s.setQuery);

  const onSearch = value => { setText(value); setQuery(value.trim().toLowerCase()); };
  const clearSearch = () => { setText(''); setQuery(''); };
  const clearAll = () => { usePlanner.getState().clearFilters(); setText(''); };
  const filterCount = groups.length + Number(!!venue) + Number(!!topic);
  const closeFilters = () => { setFiltersOpen(false); filterToggle.current?.focus(); };

  // Recovery actions elsewhere can clear the query. Keep the visible search in sync.
  useEffect(() => { setText(value => value.trim().toLowerCase() === q ? value : q); }, [q]);
  useEffect(() => {
    if (!filtersOpen || !window.matchMedia?.('(max-width:900px)').matches) return;
    // Move the masthead out of the way so the open panel fits short phone screens.
    const top = toolbar.current.getBoundingClientRect().top;
    if (top > 0) window.scrollBy({top, behavior: 'instant'});
  }, [filtersOpen]);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--toolbar-height', `${toolbar.current.offsetHeight}px`);
    });
    observer.observe(toolbar.current);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--toolbar-height'); };
  }, []);

  return (
    <div className="top" ref={toolbar}>
      <div className="top-inner">
        <div className="row">
          <div className="seg days" role="group" aria-label="Day">
            <button type="button" aria-pressed={day === '2026-09-19'} onClick={() => setFilter({day: '2026-09-19'})}>
              Saturday<small>19 Sept<span className="day-count"> · {SAT_COUNT} events</span></small>
            </button>
            <button type="button" aria-pressed={day === '2026-09-20'} onClick={() => setFilter({day: '2026-09-20'})}>
              Sunday<small>20 Sept<span className="day-count"> · {SUN_COUNT} events</span></small>
            </button>
          </div>
          <div className="seg views" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'list'} onClick={() => setFilter({view: 'list'})}>List</button>
            <button type="button" aria-pressed={view === 'grid'} onClick={() => setFilter({view: 'grid'})}>Grid</button>
          </div>
          <label className="search">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.8 1.5a5.3 5.3 0 014.2 8.5l3.4 3.4-1 1-3.4-3.4A5.3 5.3 0 116.8 1.5zm0 1.4a3.9 3.9 0 100 7.8 3.9 3.9 0 000-7.8z"/></svg>
            <input
              type="search"
              aria-label="Search"
              placeholder="Search titles, speakers, topics…"
              autoComplete="off"
              value={text}
              onChange={ev => onSearch(ev.target.value)}
            />
            <button type="button" hidden={!text} aria-label="Clear search" onClick={clearSearch}>×</button>
          </label>
        </div>
        <div className="filter-row">
          <Chips clashes={clashes} section="plans" />
          <button type="button" ref={filterToggle} className={'filter-toggle btn' + (filterCount ? ' active' : '')} aria-expanded={filtersOpen} aria-controls="programme-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 3h14v1.5H1zm3 4h8v1.5H4zm2 4h4v1.5H6z" /></svg>
            Filters{filterCount > 0 && <span className="filter-count">{filterCount}</span>}<span aria-hidden="true">{filtersOpen ? '−' : '+'}</span>
          </button>
          <div className={'filter-panel' + (filtersOpen ? ' is-open' : '')} id="programme-filters" onKeyDown={ev => { if (ev.key === 'Escape') { ev.preventDefault(); closeFilters(); } }}>
            <span className="filter-label">Event type <small>Choose any</small></span>
            <Chips clashes={clashes} section="types" />
            <div className="selects">
            <select aria-label="Venue" className={venue ? 'active' : ''} value={venue} onChange={ev => setFilter({venue: ev.target.value})}>
              <option value="">All venues</option>
              {VENUES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select aria-label="Topic" className={topic ? 'active' : ''} value={topic} onChange={ev => setFilter({topic: ev.target.value})}>
              <option value="">All topics</option>
              {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            </div>
            <button type="button" className="btn primary filter-done" onClick={closeFilters}>Show {shown} event{shown === 1 ? '' : 's'}</button>
          </div>
        </div>
        <Status shown={shown} onClear={clearAll} />
      </div>
    </div>
  );
}
