# Dashboard Frontend Polish Spec

## Goal

Polish the Skill Map dashboard frontend without changing core app logic. Keep the current dark theme, replace unrelated/random backgrounds with a unified technology, teamwork, learning, and skill-management visual direction, and make component states feel consistent.

## Design Direction

- Tone: compact dark capability command center.
- Visual anchor: one generated raster illustration of a team collaborating around skill maps and learning paths, saved at `public/assets/skill-map-teamwork-hero.png`.
- Palette: charcoal base, cream text/surfaces, lime/cyan skill signals, warm red/gold for risk and error.
- UI rules: no random `picsum` assets, restrained card radius, consistent glass panels, clear focus rings, matching chips/buttons/filters, unified empty/loading/error panels.

## Testable Behaviors

- The rendered frontend has no `picsum.photos` references.
- Overview hero, inline title image, gap banner, popular cards, and motion cards use the project-local skill/teamwork illustration or CSS-derived overlays.
- Loading, empty, error, filter, card, button, tooltip, and navigation states share the same dark visual language.
- Existing app behavior remains intact: tab navigation, search/filter, profile edit controls, report expansion, pending-review buttons, and share modal entry remain wired to the same handlers.

## Sprint Breakdown

1. Asset and background cleanup: install generated image and replace mismatched external backgrounds.
2. Component consistency: normalize shared classes and JSX labels/icons/tooltips while preserving handlers.
3. Verification: run tests/build and browser smoke; record feedback and outcome.

## Parallelization Strategy

Implementation parallelism: Sequential
Reason: The key changes converge on the same two frontend files and require one coherent visual system.

Can parallelize: no

Implementation lanes:
- `src/App.jsx`: minor semantic/icon/state copy improvements only.
- `src/App.css`: dark visual system, background replacement, component-state consistency.
- `public/assets/skill-map-teamwork-hero.png`: project-local generated raster visual asset.

Sequential dependencies:
- Inspect existing UI and locate external/random image references.
- Copy the visual asset before CSS references it.
- Apply JSX changes before final CSS verification.

Verification:
- Per-lane: search for stale `picsum` and obvious broken class references.
- Final: `npm test`, `npm run build`, local browser smoke on the Vite dev server.

Recommended Phase 3 Agent Split Gate input: Local only
Reason: The shared CSS cascade makes independent implementation lanes likely to conflict.
