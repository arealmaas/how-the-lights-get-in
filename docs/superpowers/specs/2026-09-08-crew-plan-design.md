# The crew's plan — design

8 September 2026. Adds to `CREW-SPEC.md` (v2.1: section 3 "The crew plan", section 4, section 5, section 7). This note records the decisions and why; the spec records the behaviour.

## The ask

Crew events should be much more visible, and so should being in a crew. *My picks* and *Crew* should stand out from the other filter chips. And a new model: the crew shows only the events that were added to the crew; anyone in the crew can add to the crew or to their own picks; crew events get a highlight of their own on the card; the card offers both, "probably a button or icon next to the star".

## Before

The *Crew* chip and the badges were derived from the members' own picks: "crew events" meant "events somebody else in the crew starred". There was no list the crew held together, so nothing could be added to the crew without also being added to someone's picks, and nothing could be taken out of the crew's view except by that person un-starring it.

## The model

**One map on the crew document.** `crews/{crewId}.picks` is `eventNo → uid` of whoever added it. Considered and rejected:

- *A `picks` subcollection, one document per event.* Cleaner per-entry metadata (who, when), but every device's listener costs one read per planned event per session, and the spec's whole style is "maps, not arrays, field-level writes, one document". Forty entries in a map is a few kilobytes; the 300-entry cap and the 1 MiB document limit bound it, exactly as for the member projections.
- *A `crewPicks` map on each member document, unioned on read.* No new rule surface, but then "the crew's plan" is really "everyone's crew-picks", and removing an event means each member removing their own entry. The ask is a list the crew holds together.

The value is the adder's uid rather than `true` so the sheet can say "added by Kari" and the hub's plan list can too. It costs nothing in rules (they cannot look inside the map either way) and answers the "who put this here?" that a shared list raises.

**Any member writes any entry.** Adding and removing is the same rule clause as renaming: `isMember` and `affectedKeys().hasOnly(['picks', 'updatedAt'])`. No per-entry ownership, no creator power over the plan. A crew is three friends; a plan only its authors can prune is a list. The "added by" line is what a dispute needs.

**The plan starts empty.** Creating or joining a crew copies nobody's picks into it. The old behaviour would have had a new crew's plan equal to the creator's weekend, which is the opposite of the ask.

**Own picks stay personal.** The star and the member projection are untouched. "Is it in the plan?" and "who is going?" are two questions, and the app keeps asking both: the ring and the *Crew* chip for the first, the star and the initials badges for the second. The crew calendar and the crew reading list move to the plan, with who is going in each entry — that is what "the crew shows only what was added to the crew" means for those two views.

**Compatibility.** Crews created before this have no `picks` field. The client reads that as an empty plan; the first add creates the map; the create rule requires the map only on new crews. The crew cache gained the plan; an old cache reads as an empty plan.

## The UX

**Where the toggle lives.** A second icon button beside the star on every card, the same 32 × 28 hit area, pressed and filled in the crew colour while the event is in the plan. The star stays the star. Two toggles side by side is one more thing on a busy card head, but the alternatives — a long-press menu, a split star, a "…" menu — all hide the crew action, and the ask was to make the crew more visible, not less. In the event sheet the same toggle is a labelled button beside *Add to my picks*. Grid tiles are one button each and cannot hold a nested control, so they carry the ring and the glyph and leave the toggle to the card and the sheet.

**The glyph.** Two heads and shoulders, drawn inline like the masthead icons, so it takes the current colour and reads at 13 px on a tile. It is the one mark for "the crew's plan" everywhere: the card toggle, the sheet button, the *Crew* chip, the masthead button, the tile mark.

**The colour.** `--crew` is indigo (`#4F46E5` light, `#8B8DF7` dark), with `--crew-ink` and `--crew-bg` alongside, mirroring `--pick`, `--pick-ink`, `--pick-bg`. The constraint: the six strand colours are also the member colours (the initials badges on the same card head), and amber is the pick. Indigo is none of those. It sits between the talks blue and the cinema purple in hue, which is acceptable because it is never used as a small dot next to theirs — it is a ring around the whole card, a filled button, a chip — and always beside the glyph or the word "Crew".

**The highlight.** A picked card has an amber border and a 3 px amber bar on the left. A planned card has a 2 px indigo ring (an outline, so no layout shift). Both can be on, and they read as two independent states, which they are. Tiles: an inset indigo ring; a picked tile already has an amber outline, so a tile that is both has both.

**The chips.** *My picks* and *Crew* answer "where am I going" and "where are we going"; the group chips are filters. So the two are tinted (amber, indigo) and bold at rest, filled when pressed, and a hairline separates them from the group chips. The group chips are unchanged.

**Being in a crew.** A third masthead button, named after the crew, in the crew colour, counting the plan, opening *My festival* at the crew cards. On a phone it takes a row of its own under the other two. In *My festival* the Crew card now comes before the Account card, and it says how big the plan is and how to add to it — the one line of instruction for the new toggle.

## Not done

- Per-entry timestamps, or ordering the plan by when things were added: the plan is read by day and time, like everything else.
- A "suggested by" state distinct from "in the plan", or votes on entries: the split list already shows disagreement; a plan with a maybe-column is a different product.
- Migrating existing crews' member picks into their plans: the plan is meant to start empty.
