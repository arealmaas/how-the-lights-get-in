// src/ui/event/CrewTally.jsx — CREW-SPEC section 7: on a debate, the crew's verdicts beneath my own vote.
// Rendered straight after the Verdict pills, so "Kari: Hossenfelder · Morten: Draw" reads as a footnote to
// the answer I just gave. Nothing for any other event type, and nothing at all outside a crew.
import {useCloud} from '../../store/cloud.js';
import {others} from '../../cloud/crew.js';

export default function CrewTally({e}){
  const crew = useCloud(s => s.crew);
  const user = useCloud(s => s.user);
  if (!crew || !user || e.type !== 'Debates') return null;

  const no = e.eventNo;
  const voted = others().filter(m => m.verdicts && m.verdicts[no]);
  if (!voted.length) return null;

  return <p className="tally">Crew verdicts — {voted.map(m => `${m.name}: ${m.verdicts[no]}`).join(' · ')}</p>;
}
