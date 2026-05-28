# Skill Map Onboarding UX Spec

Date: 2026-05-28
Status: Approved

## Problem

When a new workspace or small team opens Team Skill Map, Explore can feel empty because few people have declared skills. A new user also has to understand groups, status, typeahead, and submit flow before adding the first skill. This creates high first-use friction and delays the network effect.

## Goal

Make the first-use path obvious and fast:

- A new user should see a clear next action before Explore feels empty.
- A new user should be able to add a useful skill with one click from suggestions.
- Explore empty states should explain how the team can make the map useful.
- The app should still preserve real data integrity: no fake production people or hidden database writes.

## Product Behavior

### Quick Start

When the current user can edit their profile and has no declared skills, show a compact onboarding panel near the top of the page:

- Headline: `Khai báo 3 skill đầu tiên`
- Short copy that says the map gets useful after members add skills.
- Suggested skill chips derived from existing taxonomy and excluding skills already on the user's profile.
- Clicking a suggestion immediately adds that skill for the current user with status `usable`.

### My Skills Empty State

When the user has no skills, the My Skills section should guide them to quick-add before showing the advanced form. The manual form remains available below quick suggestions for custom skills.

### Explore Empty State

When a selected skill has no matching member skills, show an action-oriented empty state:

- Name the selected skill.
- Explain that nobody has declared it yet.
- If the current user can edit and does not already have that skill, provide a button to add that selected skill to their own profile.

### After Add

After any quick-add or form add, set the selected Explore skill to the added skill so the user immediately sees their contribution reflected.

## Constraints

- No production fake users.
- No schema or RLS change.
- Reuse existing mutation functions and mock-store functions.
- Keep the app compact and mobile-first for Mushy WebView.

## Testable Behaviors

- Helper logic identifies new users who should see onboarding.
- Helper logic returns suggested skills excluding already-declared skills.
- Quick-add uses existing skill rows when possible and adds to the current user.
- Empty Explore state offers an add action for the selected skill when applicable.

## Parallelization Strategy

Implementation parallelism: Sequential
Reason: Changes converge in `App.jsx` and shared helper tests; parallel lanes would create edit conflicts.

Can parallelize: no

Implementation lanes:

- Helper/data lane: add pure onboarding helpers in `src/lib/skill-map-utils.js` and tests.
- UI lane: integrate quick-start and empty-state actions in `src/App.jsx`.
- Style lane: add compact onboarding styles in `src/App.css`.

Sequential dependencies:

- Helper tests must land before UI integration.
- UI integration needs helper contracts.
- Browser smoke follows test/build.

Verification:

- `npm test`
- `npm run build`
- Local browser smoke at `http://127.0.0.1:5173/?mock=1`

Recommended Phase 3 Agent Split Gate input: Local only
Reason: The core files are tightly coupled and small enough for local controller execution.
