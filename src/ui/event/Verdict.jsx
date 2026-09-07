// src/ui/event/Verdict.jsx — ports verdictBlock(): the "Who won?" pills for a debate. Clicking the
// currently-selected pill clears the verdict; clicking another sets it.
import {usePlanner} from '../../store/planner.js';

export default function Verdict({e}){
  const verdict = usePlanner(s => s.verdicts[e.eventNo]);
  const options = [...e.speakers, 'Draw'];

  return (
    <div className="verdict">
      <span className="lab">Who won?</span>
      {options.map(o => (
        <button
          key={o}
          type="button"
          aria-pressed={verdict === o}
          onClick={() => usePlanner.getState().setVerdict(e.eventNo, verdict === o ? null : o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
