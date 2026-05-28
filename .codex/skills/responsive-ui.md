# Responsive UI Skill

Use this skill for every frontend change that affects layout, navigation, content density, forms, tables, dialogs, or
interactive controls.

## Goal

Ensure changed UI works across mobile, tablet, and desktop without horizontal overflow, clipped content, inaccessible
controls, or hidden primary workflows.

## Checklist

- Define the affected layout regions: app shell, navigation, content area, sidebars, panels, cards, tables, and modals.
- Use responsive grids, flex layouts, wrapping, and min/max constraints instead of fixed desktop widths.
- Keep tap targets usable on mobile.
- Ensure text wraps naturally and does not overlap icons, buttons, or adjacent content.
- Ensure headings and controls fit their containers without viewport-scaled font hacks.
- Make navigation usable on small screens.
- Ensure modals, drawers, popovers, dropdowns, and menus fit within the viewport and remain dismissible.
- Make wide tables scroll, stack, or reduce columns intentionally.
- Preserve important actions above excessive scrolling when possible.
- Test empty, loading, error, and long-content states for overflow.

## Minimum Viewports

Verify changed UI at:

- 390x844 mobile
- 768x1024 tablet
- 1440x900 desktop

Use additional breakpoints when the app has known layout thresholds.

## Rejection Criteria

A changed frontend is not complete if:

- horizontal overflow appears on normal mobile viewport widths
- primary navigation is unusable on mobile
- important text or controls are clipped
- content overlaps incoherently
- buttons or links are too small to tap
- tables break the page layout
- a primary workflow disappears at a breakpoint

## Reporting

Record responsive checks, failures, and fixes in `docs/FRONTEND_FINAL_REPORT.md`.
