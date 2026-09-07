// src/ui/Toolbar.jsx — ported from the old <div class="top"> block: day and view segments, the search
// box, the filter chips and the venue/topic selects, plus the status line. The search input keeps its own
// raw text so typing isn't clobbered by the store's trimmed/lowercased query used for matching.
import {useState} from 'react';
import {EVENTS, VENUES, TOPICS} from '../data/index.js';
import {usePlanner} from '../store/planner.js';
import Chips from './Chips.jsx';
import Status from './Status.jsx';

const SAT_COUNT = EVENTS.filter(e => e.date === '2026-09-19').length;
const SUN_COUNT = EVENTS.filter(e => e.date === '2026-09-20').length;

export default function Toolbar({clashes, shown}){
  const [text, setText] = useState('');
  const day = usePlanner(s => s.day);
  const view = usePlanner(s => s.view);
  const venue = usePlanner(s => s.venue);
  const topic = usePlanner(s => s.topic);
  const setFilter = usePlanner(s => s.setFilter);
  const setQuery = usePlanner(s => s.setQuery);

  const onSearch = value => { setText(value); setQuery(value.trim().toLowerCase()); };
  const clearSearch = () => { setText(''); setQuery(''); };
  const clearAll = () => { usePlanner.getState().clearFilters(); setText(''); };

  return (
    <div className="top">
      <div className="top-inner">
        <div className="row">
          <div className="seg days" role="group" aria-label="Day">
            <button type="button" aria-pressed={day === '2026-09-19'} onClick={() => setFilter({day: '2026-09-19'})}>
              Saturday<small>19 Sept · {SAT_COUNT} events</small>
            </button>
            <button type="button" aria-pressed={day === '2026-09-20'} onClick={() => setFilter({day: '2026-09-20'})}>
              Sunday<small>20 Sept · {SUN_COUNT} events</small>
            </button>
          </div>
          <div className="seg" role="group" aria-label="View">
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
        <div className="strip">
          <Chips clashes={clashes} />
          <span className="strip-sep" aria-hidden="true"></span>
          <div className="selects">
            <select aria-label="Venue" className={venue ? 'active' : ''} value={venue} onChange={ev => setFilter({venue: ev.target.value})}>
              <option value="">Venue</option>
              {VENUES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select aria-label="Topic" className={topic ? 'active' : ''} value={topic} onChange={ev => setFilter({topic: ev.target.value})}>
              <option value="">Topic</option>
              {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <Status shown={shown} onClear={clearAll} />
      </div>
    </div>
  );
}
