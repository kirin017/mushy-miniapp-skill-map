# Skill Profile Progress Card Design

Date: 2026-05-28
Status: Approved design, pending implementation plan

## Context

Team Skill Map already lets workspace members search skills, maintain their own skill profile, endorse teammates, and use a local `?mock=1` mode for fast UI testing. The current onboarding surface is a simple quick-start panel shown only when the current user has no skills.

The next improvement should make the app more useful for both interns and mentors without expanding the database model. The selected product direction is a lightweight progress checklist that helps interns complete a higher-quality profile. A better-filled profile also gives mentors a more useful team skill map.

## Goal

Replace the current one-time quick-start prompt with a `Profile Progress Card` that shows clear progress toward a useful skill profile.

The card should help the current user answer:

- What is missing from my skill profile?
- What action can I take in the next few seconds?
- When is my profile useful enough for the team skill map?

## Non-Goals

- No required onboarding flow.
- No blocking gate before using Explore.
- No new database tables or columns.
- No mentor/admin dashboard in this iteration.
- No AI-generated recommendations.
- No numeric skill score or public profile grade.

## Product Behavior

The card appears near the top of the page, before the main `Explore` and `My Skills` grid, when all of these are true:

- The main dataset has finished loading.
- The current user can edit their own profile in the active scope.
- The user's profile checklist is not complete.

The card is hidden when the profile reaches the checklist target. It is also hidden for read-only shared scopes where the viewer cannot edit their own profile.

The checklist has five items:

- Add at least 3 skills.
- Cover at least 2 skill groups.
- Mark at least 1 skill as `usable`.
- Keep at least 1 skill as `learning`.
- Have at least 1 endorsement interaction, either received on the user's skills or sent by the current user to another member.

This is intentionally a soft guide. Users can ignore it and continue using the app.

## UI Design

The card replaces `QuickStartPanel` rather than adding a second onboarding component.

Primary content:

- Title: `Hoàn thiện skill profile`
- Compact progress label, for example `2/5 bước`
- A thin progress bar
- A five-item checklist with done/pending states
- A short next-action area using quick-add skill suggestions

Suggested Vietnamese copy:

- Title: `Hoàn thiện skill profile`
- Supporting copy: `Một profile đủ rõ giúp team biết khi nào nên hỏi bạn và mentor thấy nhóm đang thiếu gì.`
- Progress label: `{completed}/{total} bước`
- Empty suggestion copy: `Bạn đã thêm hết skill gợi ý hiện có.`

Suggested checklist labels:

- `Thêm ít nhất 3 skill`
- `Có skill ở ít nhất 2 nhóm`
- `Có 1 skill dùng được`
- `Giữ 1 skill đang học`
- `Có 1 lượt endorse`

Suggested quick-add button copy:

- `Thêm {skill.name}`

The visual style should stay compact and mobile-first, matching the existing Mushy card, chip, and button styles. It should not become a large landing-style hero.

## Logic Design

Add a testable helper in `src/lib/skill-map-utils.js`, tentatively named `getProfileProgress()`.

Inputs:

- `groups`
- `skills`
- `memberSkills`
- `endorsements`
- `userId`
- `suggestionLimit`

Output shape:

```js
{
  total: 5,
  completed: 2,
  complete: false,
  items: [
    { id: 'skill-count', label: 'Thêm ít nhất 3 skill', done: false },
  ],
  suggestions: []
}
```

The helper should derive all progress from existing loaded data. It should not fetch data or mutate state.

Rules:

- Count only `memberSkills` owned by `userId` for skill-count, group-coverage, usable, and learning checks.
- Group coverage counts distinct `skill.group_id` values for the user's declared skills.
- The endorsement step is done if either:
  - any endorsement points to a `member_skill` owned by `userId`, or
  - any endorsement has `endorser_user_id === userId`.
- Suggestions should reuse the existing behavior of excluding skills already declared by the current user and ordering by group sort order, then skill name.

## Component Design

Add a new component:

```text
src/components/ProfileProgressCard.jsx
```

Responsibilities:

- Render progress label and bar.
- Render checklist rows.
- Render quick-add skill buttons.
- Call `onAddSkill(skill)` when a suggestion is selected.
- Stay presentational; progress calculation remains in `skill-map-utils.js`.

`App.jsx` should:

- Replace `showOnboarding` and `QuickStartPanel` with profile progress calculation.
- Render `ProfileProgressCard` when `canEditOwnProfile && !loading && !progress.complete`.
- Pass `saving`, `progress`, and `quickAddSkill`.

The old `QuickStartPanel` can be removed if no longer used.

## Data Flow

On load, the existing `useSkillMapData()` hook continues to fetch or mock the full dataset.

`SkillMapApp` derives:

1. Current user's member skill rows.
2. Profile progress via `getProfileProgress()`.
3. Whether to show the progress card.

When a user quick-adds a suggested skill:

1. Existing `quickAddSkill(skill)` runs.
2. The mutation uses the existing real or mock data path.
3. `refresh()` reloads the dataset.
4. `getProfileProgress()` recomputes progress from the refreshed data.

## Error Handling

No new user-facing error path is needed. Quick-add failures should continue using the existing `runMutation()` and `useDialog()` behavior.

Required UI states:

- Loading: do not render the progress card until the dataset is ready.
- Read-only profile: do not render the card.
- Completed profile: do not render the card.
- No suggestions left: render checklist progress without quick-add buttons.
- Saving quick-add: disable quick-add buttons using the existing `saving` state.

## Testing

Add focused tests for `getProfileProgress()` in `test/skill-map-utils.test.mjs`.

Required cases:

- Empty profile returns `0/5`, incomplete checklist, and suggestions.
- Three declared skills complete the skill-count item.
- Skills across two groups complete the group-coverage item.
- At least one `usable` skill completes the usable item.
- At least one `learning` skill completes the learning item.
- Received endorsement completes the endorsement item.
- Sent endorsement completes the endorsement item.
- Suggestions exclude skills the user already declared.

Required verification:

- `npm test`
- `npm run build`
- Browser smoke in local mock mode at `/?mock=1`:
  - Progress card appears for an incomplete profile.
  - Quick-add updates the checklist after refresh.
  - Card hides when all checklist items are complete, if reachable in mock data.

## Implementation Parallelism

Implementation parallelism: Sequential

Reason: the change is small and touches tightly related utility, component, app render, CSS, and tests. Parallel work would increase handoff overhead more than it would reduce delivery time.

## Meta-Harness Rubric

Target score: 7

Criteria:

- Correctness: progress items are computed from existing data and match the approved rules.
- Completeness: the previous quick-start behavior is replaced by the new card, including no-suggestion and completed-profile states.
- Edge cases: read-only scopes, loading, mock mode, and endorsement direction are handled.
- Craft: UI remains compact, mobile-friendly, and consistent with the current app.

## Self-Review

- Placeholder scan: no TBD or TODO placeholders remain.
- Consistency check: the UI, logic, data flow, and testing sections all describe the same no-DB-change feature.
- Scope check: the design is small enough for one implementation plan and one focused implementation pass.
- Ambiguity check: the endorsement rule, completion rule, and render conditions are explicit.
