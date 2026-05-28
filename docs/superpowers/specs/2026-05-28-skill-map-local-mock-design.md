# Skill Map Local Mock Design

Date: 2026-05-28
Status: Approved

## Context

The Team Skill Map app currently depends on Mushy Shell context, a valid Supabase JWT, and applied app-schema migrations. That blocks quick local UI testing when the developer only needs to inspect the workflow.

## Goal

Add a local mock mode for the Skill Map app so the developer can run Vite locally and test the main UI flows without Supabase or Mushi Shell.

## Activation

Mock mode is enabled only in Vite development when the URL contains `?mock=1`.

Example:

```text
http://127.0.0.1:5173/?mock=1
```

Production and preview builds must continue using the real Mushy/Supabase flow.

## Behavior

Mock mode provides:

- A fake app context for the current user.
- A fake owner-member active scope.
- Seed skill groups, skills, workspace members, member skills, and endorsements.
- In-memory mutations for adding a skill, changing status, deleting a skill, endorsing, and removing endorsements.

The existing UI should stay unchanged except for using mock data when mock mode is active.

## Boundaries

Mock state is in memory only. Refreshing the browser resets it. This is intentional for local UI testing.

Mock mode must not change database migrations or production RLS.

## Verification

Required checks:

- Unit tests for mock mode detection and mock data mutation behavior.
- `npm test`
- `npm run build`
- Start local Vite server and open `/?mock=1`.
