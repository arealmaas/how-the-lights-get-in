# Design and UX review

Reviewed 12 September 2026. Scope: the local planner, its main browsing and planning flows, event and speaker details, notes, responsive layouts, and keyboard navigation. Account UI was reviewed in source and component tests; no live accounts were changed.

## Assessment

The compact programme is the right foundation. Time grouping makes competing events easy to compare, the category colours support scanning, and the persistent picks, offline support, briefings and notes give the planner useful depth. Keep that structure and the existing typography. A large hero, more imagery, or a separate onboarding flow would get in the way of finding the next event.

The biggest weaknesses were hidden controls, ambiguity about ticket costs, loss of context while navigating details, and small, faint supporting text. These mattered more than a new visual identity. This pass addresses those problems while retaining the existing list, grid, crew and reading-list features.

## Findings and changes

| Priority | Finding | Change implemented |
| --- | --- | --- |
| High | At phone and tablet widths, category, venue and topic filters ran offscreen in a horizontal strip with no scrollbar or visible continuation cue. | Keep My picks and Crew visible. Put the remaining controls behind a labelled **Filters** button with an active count, wrapping category choices and visible venue/topic selectors. A result button closes the panel; Escape closes it and restores focus. |
| High | A card labelled “Fast Pass £8” made an included event look like it required another ticket. The explanation was in the detail sheet and footer. | Cards now say **Included · optional Fast Pass**. The full price and conditions remain in event details. Separate tickets and sold-out events remain distinct. |
| High | Back from a speaker or another event reset the previous sheet to the top and could reset its selected section. | Store scroll and event section per navigation entry. Back restores both, including nested visits to the same event. |
| High | Clickable articles acted as buttons while containing pick and crew buttons. Banner controls could also lead keyboard focus into the obscured programme. | Use a native event-title button with a full-card click area and independent pick controls. Constrain modal keyboard navigation, place active banners inside the dialog, and announce banner text. |
| Medium | “Nothing matches” offered suggestions but no recovery action, and could conceal a match on the other festival day. Empty personal picks looked like a failed search. | Add contextual empty states, a reset/browse action, and an other-day button when the same filters find results there. Reset also clears the visible search input. |
| Medium | Filtering the grid by a venue retained all the other, empty venue columns. On phones this made results harder to locate. | Display only venues containing results. Keep the horizontal-navigation hint above the table and add table headers and a focusable, named scroll region. |
| Medium | Small secondary text was too faint, and the phone masthead removed location information. | Strengthen secondary text in both themes, enlarge event titles and several labels, improve card spacing and borders, restore the location, and shorten the repeated disclaimer. |
| Medium | Complete notes appeared before the itinerary and account controls, so a few long notes could bury the primary planning tasks. | Show the itinerary and account/crew controls before the notebook, retaining full note text. |
| Medium | “Edit note” from the notebook opened the hero and event heading above the editor. | Focus and reveal the note editor for that explicit action. Back still restores the prior reading position. |
| Medium | Account inputs relied on disappearing placeholders and asynchronous feedback was not announced. | Add persistent field labels and live status feedback, including a pending state. |
| Low | The default programme had no result summary, and keyboard visitors had to traverse the toolbar before reaching events. | Keep the selected day's event count visible, announce filtered counts, add a skip link, and account for the sticky toolbar when scrolling to content. |

The secondary-text token on white improved from **3.40:1 to 5.18:1**; on the dark card surface it improved from **4.39:1 to 7.02:1**. These are calculated contrast ratios for those specific colour pairs, not a claim of a complete accessibility audit.

## Recommended next work

1. **Completed: browser Back follows detail navigation.** Back, Forward and the in-app Back button share the sheet stack; visited event sections and scroll positions survive navigation within a session. Close/Escape rewinds to the programme. Reload restores public navigation descriptors without adding a duplicate visit. Import and invitation payloads are stripped before history entries are written. This pass includes browser regressions for the combined flows.
2. **Improve long-form section navigation.** Overview, Briefing and Notes still live below the event hero, and switching a section returns to the top. Test keeping section navigation visible while reading, particularly on phones.
3. **Give the growing notebook a direct route.** Moving notes below the itinerary protects the main task. For frequent note-taking, a direct My notes entry would reduce scrolling without truncating writing. Validate the importance of notes versus reading-list access with actual festival users before changing the header again.
4. **Measure first-visit performance on a weak mobile connection.** The production build still reports large chunks: the main JS bundle is about 289 kB compressed and the lazy Firebase bundle about 207 kB. Offline coverage is valuable, but initial load time deserves measurement before deciding what to split or defer.

Items 2–4 remain recommendations. A short usability check with a few festival-goers should ask them to find a Sunday talk, identify whether it costs extra, save two competing events, return from a speaker profile, and revise a saved note. Observe completion and hesitation rather than asking only whether the page looks better.

## Verification and limits

- Production build succeeds; existing bundle-size and build-option warnings remain.
- All **290 unit/component tests** pass.
- The complete **42-test browser suite** passed in Chromium/WebKit. After final refinements, all **16 browsing checks** and **20 detail/mobile checks** were rerun successfully.
- Visual inspection covered light and dark themes, 320 px and 390 px phones, and a 1280 px desktop. Existing landscape, keyboard, scroll-restoration, note export and offline-editing checks also pass.
- The initial review was committed as `a46c9ed`, pushed to `main`, and successfully deployed. No real account sign-in or live crew test was performed. Screen-reader behaviour and physical iOS/Android keyboards still need a device check; browser automation does not substitute for that.
- Separate map work appeared in the shared checkout near the end. It was preserved and included in the successful final build, but its UX is outside this review and the test totals above describe the review changes.

Key implementation files: [toolbar](../src/ui/Toolbar.jsx), [empty states](../src/ui/EmptyEvents.jsx), [cards](../src/ui/EventCard.jsx), [grid](../src/ui/EventGrid.jsx), [detail navigation](../src/ui/Sheet.jsx), and [styles](../src/styles/app.css). Regression coverage is in [browsing tests](../tests/e2e/browse.spec.js) and [mobile/detail tests](../tests/e2e/mobile.spec.js).

### Navigation follow-up

The browser-history improvement is implemented. The combined checkout passes **300 unit/component tests**, **62 browser tests** across Chromium and WebKit, and the production build. Coverage includes nested event/speaker visits, saved sections and scroll positions, Close/Escape, reloads, direct links, and import/invitation cleanup. See the [history bridge](../src/history.js) and [browser regressions](../tests/e2e/history.spec.js).
