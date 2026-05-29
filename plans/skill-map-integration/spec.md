# Skill Map Main-App Integration Spec

## Objective

Make the Skill Map miniapp ready to integrate into the Mushy main app as a real data-backed miniapp, not only a static mock/demo.

## Required Behavior

- The app reads skills and member skill ratings from Supabase tables in the active workspace scope.
- The app seeds preset skills when a workspace has no skill rows yet.
- Profile edits persist to `member_skills` and survive reload.
- Queries and writes use the active scope workspace id, not a hardcoded workspace.
- The header exposes scope switching and share management using existing Mushy shared components.
- Runtime DB/setup errors show a clear in-app error state instead of a blank screen.
- Local build and Vercel preview remain functional.

## Out Of Scope

- Applying migrations in the Mushy Admin Portal.
- Changing shared infrastructure in `src/lib/*`.
- Adding production-only custom domains.

## Testable Behaviors

- A pure data helper builds heatmap rows from Supabase-style skill/member rows.
- The helper returns preset insert payloads with `workspace_id`, `created_by`, `is_preset`, and stable skill names.
- `npm run build` succeeds.
- Preview URL renders the Skill Map UI.

## Parallelization Strategy

Implementation parallelism: Sequential
Reason: the work is tightly coupled through `App.jsx` state/data flow and the data-layer contract.

Can parallelize: no
Implementation lanes: local controller owns data helper, app wiring, and verification.
Sequential dependencies: tests define data contract before code; data helper before UI wiring; UI wiring before browser smoke.
Verification: node tests, Vite build, Vercel preview/browser smoke.
Recommended Phase 3 Agent Split Gate input: Local only, because the change center is one coupled app surface.
