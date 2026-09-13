import {useMemo} from 'react';
import {EVENTS, DAYS} from '../data/index.js';
import {conflictGroups} from '../core/comparison.js';
import {usePlanner} from '../store/planner.js';
import {useSheet} from '../store/sheet.js';
import '../styles/comparison-entrypoints.css';

// Compare all the day's picks even when a search or category filter hides one of them.
export default function ComparePrompt({day}){
  const picks = usePlanner(s => s.picks);
  const groups = useMemo(() => conflictGroups(EVENTS, picks).filter(group => !day || group.date === day), [picks, day]);
  if (!groups.length) return null;
  const pickCount = groups.reduce((count, group) => count + group.events.length, 0);

  return (
    <aside className="compare-prompt" aria-label="Overlapping picks">
      <div className="compare-prompt-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="4" width="8" height="16" rx="2" />
          <rect x="13" y="4" width="8" height="16" rx="2" />
          <path d="M6 9h2m-2 4h2m8-4h2m-2 4h2" />
        </svg>
      </div>
      <div className="compare-prompt-copy">
        <p className="compare-prompt-eyebrow">{day ? DAYS[day] : 'Your weekend'} · {groups.length} overlapping group{groups.length === 1 ? '' : 's'}</p>
        <p className="compare-prompt-title">Good choices. Same time.</p>
        <p>{pickCount} of your picks overlap. Compare the ideas, speakers and practical details to find your favourite.</p>
      </div>
      <button type="button" className="btn compare-prompt-button" data-focus-key="compare-picks" onClick={event => {
        // Safari does not focus buttons on pointer activation. Give the sheet an
        // explicit opener so Close can return here after comparing or undoing.
        event.currentTarget.focus({preventScroll: true});
        useSheet.getState().open('compare', groups[0].id);
      }}>
        Compare overlapping picks <span aria-hidden="true">→</span>
      </button>
    </aside>
  );
}
