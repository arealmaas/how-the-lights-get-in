// src/ui/CrewIcon.jsx — the one glyph that means "the crew's plan", drawn inline like the masthead's
// icons so it takes the current colour: two heads and shoulders. Used by the card and sheet toggles
// (CrewPick.jsx), the Crew chip, the masthead's crew button and the grid tiles' mark. Decorative
// everywhere — the element around it carries the label.
export default function CrewIcon(){
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="5.6" cy="5" r="2.6" />
      <circle cx="11.2" cy="5.6" r="2.1" />
      <path d="M.9 13.2c0-2.7 2-4.4 4.7-4.4s4.7 1.7 4.7 4.4v.3H.9z" />
      <path d="M11.2 9.1c2.3 0 3.9 1.4 3.9 3.6v.8h-3.7v-.3c0-1.5-.5-2.8-1.4-3.7.4-.3.8-.4 1.2-.4z" />
    </svg>
  );
}
