// src/ui/CrewPick.jsx — the second toggle next to the star (CREW-SPEC section 7, "Everywhere"): the
// crew's plan is a list of its own, so an event is added to it, or taken out, with a button of its own.
// Two shapes of the same control: CrewPick is the icon button on a card head, beside the star;
// CrewPlanButton is the labelled one in the event sheet's actions row, beside "Add to my picks". Both
// render nothing outside a crew (which is also the CLOUD-off case) and both read the plan straight from
// the crew document in the store — the write goes through cloud/crew.js and comes back on the listener,
// so there is no local state to get out of step. Gated on selectMyUid through useInPlan/useInCrew, so a
// cold or offline start shows the cached plan; the write itself checks for a session and says
// "Still connecting" until there is one.
import {toggleCrewPick} from '../cloud/crew.js';
import {useInCrew, useInPlan} from './useFiltered.js';
import CrewIcon from './CrewIcon.jsx';

export const planLabel = on => (on ? 'Remove from the crew’s plan' : 'Add to the crew’s plan');

export default function CrewPick({no}){
  const inCrew = useInCrew();
  const on = useInPlan(no);
  if (!inCrew) return null;
  return (
    <button
      type="button"
      className="crewpick"
      aria-pressed={on}
      aria-label={planLabel(on)}
      title={planLabel(on)}
      onClick={ev => { ev.stopPropagation(); toggleCrewPick(no); }}
    >
      <CrewIcon />
    </button>
  );
}

export function CrewPlanButton({no}){
  const inCrew = useInCrew();
  const on = useInPlan(no);
  if (!inCrew) return null;
  return (
    <button
      type="button"
      className={`btn${on ? ' crewbtn' : ''}`}
      aria-pressed={on}
      onClick={() => toggleCrewPick(no)}
    >
      <CrewIcon />
      {on ? 'In the crew’s plan' : 'Add to the crew’s plan'}
    </button>
  );
}
