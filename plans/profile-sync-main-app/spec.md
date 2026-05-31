# Profile Sync With Main App

## Goal

Remove remaining mock profile identity from the Skill Map dashboard and keep the current user profile synchronized with the main Mushy app context.

## Sprint Breakdown

1. Data contract
   - Normalize current user profile fields from `APP_CONTEXT` variants.
   - Pass the normalized profile through the Skill Map load path.

2. Member composition
   - Merge the current app profile into `listMembers` and `composeSkillMapView`.
   - Ensure the current user is present even when workspace member rows do not include them.
   - Replace fake labels such as `Thanh vien`, `@me`, and `?` with truthful sync states.

3. Verification
   - Add regression tests for missing workspace member rows and unsynced member profiles.
   - Run unit tests, production build, and browser smoke.

## Testable Behaviors

- When `APP_CONTEXT` contains the current user's name/avatar but `workspace_members` does not return that user, the Profile screen and overview cards still show the app profile.
- Rows with skill data but missing `user_profiles` no longer render as a fake generic member.
- Existing Skill Map CRUD/data logic remains unchanged.

## Parallelization Strategy

Implementation parallelism: Sequential

Reason: The fix is a tightly coupled data-contract change across context, member lookup, and view composition.

Can parallelize: no

Implementation lanes:
- Context normalization in `src/lib/context.js`.
- Member lookup merge behavior in `src/lib/members.js`.
- View composition and tests in `src/lib/app/skill-map-data.js` and `test/skill-map-data.test.js`.

Sequential dependencies:
- Define normalized profile shape before updating member lookup and composer.
- Update tests after deciding the final sync-state labels.

Verification:
- `npm test`
- `npm run build`
- Browser smoke against local Vite server.

Recommended Phase 3 Agent Split Gate input: Local only, because edit ownership overlaps and test feedback should guide the exact data contract.
