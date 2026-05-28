# Design System Builder Skill

Use this skill when frontend work introduces, changes, or standardizes visual patterns.

## Goal

Create a lightweight, practical design system that fits the existing app. Do not introduce a heavy UI framework or
large abstraction unless the repository already uses one or the user explicitly asks for it.

## Checklist

- Reuse existing components, tokens, utility classes, and naming conventions first.
- Define or normalize tokens for color, typography, spacing, borders, radius, shadows, and layout width.
- Keep component variants explicit: primary, secondary, destructive, disabled, loading, selected, active, and empty.
- Standardize common UI pieces: buttons, inputs, selects, textareas, tables, cards, modals, drawers, tabs, badges,
  toasts, empty states, loading states, and error states when they appear in scope.
- Prefer reusable components or shared styles over repeated one-off classes.
- Keep visual hierarchy clear: page title, section heading, body text, metadata, actions, and destructive actions.
- Avoid decorative UI that does not help the workflow.
- Preserve brand or product identity if it already exists.
- Keep color contrast and focus states usable.
- Ensure icons are from the existing icon set when one exists.

## Implementation Rules

- Do not put cards inside cards unless the existing design system already does so for the same pattern.
- Do not create a landing page when the user asked for an app, dashboard, workflow, or tool.
- Do not use one-off spacing, font sizes, or colors when a reusable token or local convention exists.
- Do not change business logic while refactoring visual structure.
- Keep new abstractions small and tied to repeated usage.

## Required Notes

When design-system decisions are made, record them in `docs/FRONTEND_FINAL_REPORT.md`.

For broad design-system work, also create or update `docs/DESIGN_SYSTEM_NOTES.md` with:

- tokens introduced or reused
- components standardized
- important variants and states
- migration notes or follow-up cleanup
