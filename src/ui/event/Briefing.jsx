// src/ui/event/Briefing.jsx — ports briefingBlock() (the debate briefing: sides, speaker stances,
// questions, reading, terms) and talkBriefingBlock() (the single-argument talk/Academy briefing), which
// briefingBlock delegated to for briefings with no `sides`.
import {Fragment} from 'react';
import {BRIEF_NOTE} from '../../data/index.js';

export function Briefing({b}){
  if (!b.sides) return <TalkBriefing b={b} />;
  return (
    <div className="brief">
      <p className="bq">{b.question}</p>
      <p>{b.why}</p>
      <h3 className="sub">The sides</h3>
      {b.sides.map((s, i) => (
        <div className="side" key={i}>
          <h4>{s.label}</h4>
          <ul className="for">{s.points.map((p, j) => <li key={j}>{p}</li>)}</ul>
          <p className="lab">Usual objections</p>
          <ul className="against">{s.objections.map((p, j) => <li key={j}>{p}</li>)}</ul>
        </div>
      ))}
      <h3 className="sub">Where the speakers are likely to stand</h3>
      <dl>
        {b.speakers.map((s, i) => <Fragment key={i}><dt>{s.name}</dt><dd>{s.stance}</dd></Fragment>)}
      </dl>
      <h3 className="sub">Questions worth asking</h3>
      <ol>{b.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
      <h3 className="sub">Read or watch first</h3>
      <ul>
        {b.reading.map((r, i) => (
          <li className="rd" key={i}><b>{r.title}</b> — <span>{r.by}</span>{r.note && <><br /><span>{r.note}</span></>}</li>
        ))}
      </ul>
      {b.terms && b.terms.length > 0 && (
        <>
          <h3 className="sub">Terms</h3>
          <dl>{b.terms.map((t, i) => <Fragment key={i}><dt>{t.term}</dt><dd>{t.def}</dd></Fragment>)}</dl>
        </>
      )}
      <p className="note">{BRIEF_NOTE}</p>
    </div>
  );
}

function TalkBriefing({b}){
  return (
    <div className="brief">
      <p className="bq">{b.question}</p>
      <p>{b.why}</p>
      <div className="side">
        <h4>The argument</h4>
        <ul className="for">{(b.case || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
        <p className="lab">Strongest objections</p>
        <ul className="against">{(b.objections || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
      </div>
      <h3 className="sub">Where the speaker{b.speakers.length > 1 ? 's come' : ' comes'} from</h3>
      <dl>
        {b.speakers.map((s, i) => <Fragment key={i}><dt>{s.name}</dt><dd>{s.stance}</dd></Fragment>)}
      </dl>
      <h3 className="sub">Questions worth asking</h3>
      <ol>{(b.questions || []).map((q, i) => <li key={i}>{q}</li>)}</ol>
      <h3 className="sub">Read or watch first</h3>
      <ul>
        {(b.reading || []).map((r, i) => (
          <li className="rd" key={i}><b>{r.title}</b> — <span>{r.by}</span>{r.note && <><br /><span>{r.note}</span></>}</li>
        ))}
      </ul>
      {b.terms && b.terms.length > 0 && (
        <>
          <h3 className="sub">Terms</h3>
          <dl>{b.terms.map((t, i) => <Fragment key={i}><dt>{t.term}</dt><dd>{t.def}</dd></Fragment>)}</dl>
        </>
      )}
      <p className="note">{BRIEF_NOTE}</p>
    </div>
  );
}
