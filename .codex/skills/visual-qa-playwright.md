# Visual QA Playwright Skill

Use this skill after frontend changes when Playwright, Playwright MCP, or an equivalent browser automation tool is
available.

## Goal

Verify the changed UI in a real browser, not only by reading code or relying on build output.

## Required Browser Coverage

Check each changed route, screen, or important state at these minimum viewports:

- Mobile: 390x844
- Tablet: 768x1024
- Desktop: 1440x900

If a viewport is not relevant or cannot be checked, record why in `docs/FRONTEND_FINAL_REPORT.md`.

## Checklist

- Start the correct dev server command for the project.
- Open every changed route or UI state.
- Capture or inspect the page at mobile, tablet, and desktop sizes.
- Check for blank screens, hydration errors, broken route loading, and console errors.
- Check visible layout overflow in both axes.
- Check text clipping, collapsed controls, overlapping content, and unreadable labels.
- Check primary navigation, dialogs, dropdowns, menus, tabs, drawers, and forms.
- Check images, icons, fonts, and canvas/SVG rendering when present.
- Exercise the primary user workflow touched by the change.
- Fix visible issues and repeat the affected viewport checks.

## Screenshot Evidence

When screenshots are practical, save them with descriptive names under an existing screenshot/report location, or record
the tool-provided screenshot references in `docs/FRONTEND_FINAL_REPORT.md`.

## Fallback

If Playwright is unavailable:

- state that Playwright was unavailable in `docs/FRONTEND_FINAL_REPORT.md`
- explain what blocked it
- perform static review, available browser checks, or command-line verification instead
- do not claim Playwright visual QA passed

## Enforcement

- Do not mark frontend visual QA as complete unless browser routes were opened and inspected.
- Do not ignore console errors; classify each as fixed, pre-existing, or out of scope.
- Do not finish with known visible regressions unless the user accepts them or they are documented as limitations.
