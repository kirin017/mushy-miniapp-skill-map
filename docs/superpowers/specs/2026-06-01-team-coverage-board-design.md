# Team Coverage Board Design

## Summary

The current heatmap shows member skill levels as a matrix, but it does not help users make practical team decisions. Skill Map will redesign the Overview heatmap into a Team Coverage board that answers: who can lead work, who can back them up, who is growing into the skill, and where the team is exposed.

The selected v1 approach is:

- Replace the main Overview heatmap panel with a category-based Team Coverage board.
- Use existing catalog categories such as `Frontend`, `Backend`, `AI/ML`, and `DevOps/Cloud`.
- Derive coverage from existing skill level, interest, member, and category data.
- Keep the Search tab and skill drill-down path for member-level detail.
- Redesign the Report screen from a percentage-style risk list into prioritized actions.
- Avoid migrations and AI in v1.

## Current State

The Overview currently renders `Heatmap năng lực` in `src/App.jsx`. It displays a table of up to six members by up to five skills. A mobile list mirrors the same data. The filter switches between `Top kỹ năng` and `Cần bổ sung`.

Data currently comes from `composeSkillMapView()` in `src/lib/app/skill-map-data.js`. Each display skill includes:

- `total`: count of members with level 3 or higher.
- `risk`: `1` when there are no level 3+ members or no level 4 mentor.

This model is too blunt:

- A skill with one strong person and no backup can look similar to a skill with nobody ready.
- Interest is collected but not used for team growth decisions.
- The heatmap is hard to translate into action.
- The Report screen shows `skill.total * 14%`, which is not a meaningful readiness metric.

## Goals

- Make the Overview useful for daily team decisions.
- Show team readiness by skill category, not only raw member scores.
- Identify primary owners, backups, trainees, and coverage risks.
- Turn risk reporting into concrete actions.
- Preserve the existing profile, search, and save flows.
- Keep v1 derived from existing data with no schema migration.

## Non-Goals

- Adding projects, tasks, workstreams, or role taxonomy tables.
- Adding AI recommendations.
- Removing the Search tab.
- Replacing level and interest inputs.
- Building a full workforce planning system.
- Creating custom category management.

## Selected Approach

The Overview will use a category-based Team Coverage board.

Each category section will show a small set of skill rows. Each row summarizes:

- Skill name and icon.
- Coverage status.
- Primary owner.
- Backup count.
- Trainee count.
- Suggested action.

The board is optimized for the question: "Is this team ready to do work in this area, and what should we fix first?"

The old matrix can be removed from the main Overview in v1. Detailed member-by-skill lookup remains available by clicking a skill row, which opens the existing Search screen for that skill.

## Coverage Model

Coverage is derived per skill from existing member skill data.

### Member Roles Per Skill

- `primary`: members with level `>= 3`, sorted by level descending, then interest descending, then name.
- `mentor`: members with level `>= 4`.
- `backup`: members with level `>= 2` who are not the top primary, sorted by level and interest.
- `trainee`: members with interest `>= 2` and level `<= 2`, sorted by interest descending, then level descending.

The first primary is the displayed lead. Additional primary members can count as backups for coverage strength if they are not the displayed lead.

### Coverage Status

Each skill receives one status:

- `healthy`: has at least one primary and at least one backup.
- `thin`: has a primary but no backup, or only one strong person.
- `missing`: has no primary and no meaningful trainee signal.
- `growing`: has no primary but has one or more trainees with interest `>= 2`.

Status priority for action sorting:

1. `missing`
2. `thin`
3. `growing`
4. `healthy`

### Suggested Actions

Each skill gets one short action:

- `missing`: `Cần primary owner`.
- `thin`: `Thêm backup`.
- `growing`: `Ghép trainee với mentor`.
- `healthy`: `Duy trì coverage`.

V1 keeps action text generic. It can show related primary, backup, and trainee people as separate fields, but the action string itself should not dynamically name specific pairings.

### Category Summary

Each category receives:

- `skillCount`
- `healthyCount`
- `thinCount`
- `missingCount`
- `growingCount`
- `topActions`: the highest-priority two or three skill actions in that category.

Categories with more severe actions should appear before fully healthy categories. Within a category, non-healthy skills should appear before healthy skills.

## Overview UI

The panel title changes from `Heatmap năng lực` to `Team Coverage`.

The panel includes:

- A short status line such as `Theo nhóm kỹ năng` or `3 hành động cần xử lý`.
- A mode control:
  - `Theo nhóm`: show category sections.
  - `Cần xử lý`: show only `missing` and `thin`.
  - `Đang phát triển`: show `growing` and trainees.

Each category section shows:

- Category name.
- Compact summary counts.
- Skill coverage rows.

Each skill row shows:

- Skill icon and name.
- Status chip.
- Primary member avatar/name or an empty state.
- Backup count.
- Trainee count.
- Action text.

Clicking a skill row calls the existing `onSelectSkill(skill.id)` path and opens the Search screen focused on that skill.

The existing search input remains. It filters coverage rows by:

- Skill name.
- Category.
- Member name or handle among primary, backup, or trainee people.

## Report Screen

The Report screen changes from `Kỹ năng cần bổ sung` to `Hành động ưu tiên`.

It groups items by severity:

- `Critical`: skills with `missing`.
- `Thin coverage`: skills with `thin`.
- `Growth opportunity`: skills with `growing`.

Each report item shows:

- Skill name and category.
- Suggested action.
- Primary owner if available.
- Backup count.
- Trainee count.

The report must remove the fake percentage calculation based on `skill.total * 14%`. V1 should not display a percent unless it has a meaningful formula.

## Data Flow

1. `loadSkillMapData()` loads skills, member skills, and members as today.
2. `composeSkillMapView()` keeps returning `skills`, `members`, and `profileSkills`.
3. A new helper derives coverage from composed `skills` and `members`.
4. Overview receives the derived coverage groups.
5. Report receives the derived action list.
6. Search screen continues to receive selected skill IDs and member rows as today.

The coverage helper should be pure and testable.

## Component Boundaries

Preferred code structure:

- `src/lib/app/team-coverage.js`: pure coverage helpers.
- `test/team-coverage.test.js`: unit tests for statuses, sorting, and category summaries.
- `src/App.jsx`: UI wiring for Overview and Report.
- `src/App.css`: coverage board and report styles.

Avoid adding another large block of derived-data logic directly inside `Overview`.

## Error And Empty States

When there are no members:

- Show the catalog categories with an empty message.
- Avoid showing fake coverage.

When a category has no matching rows after search/filter:

- Hide that category in filtered modes.

When all visible skills are healthy:

- Report screen shows a positive empty state and explains that no priority actions are currently detected.

When profile data is partially missing:

- Use existing fallback member labels.
- Do not invent names or fake members.

## Testing Plan

Unit tests for `team-coverage.js`:

- No primary and no trainee produces `missing`.
- No primary but interested trainee produces `growing`.
- One primary and no backup produces `thin`.
- Primary plus backup produces `healthy`.
- Level 4 member appears as mentor and primary.
- Backup excludes the displayed lead.
- Trainees require interest `>= 2` and level `<= 2`.
- Category summary counts statuses correctly.
- Action sorting prioritizes `missing`, then `thin`, then `growing`, then `healthy`.
- Search/filter matches skill, category, and related member names.

Existing tests:

- Update `skill-map-data` tests only if fields change.
- Keep existing search/profile/proposal tests passing.

Verification commands:

- `npm run test`
- `npm run build`

Manual visual pass:

- Overview desktop: category sections fit and show useful actions.
- Overview mobile: coverage rows do not overflow and remain scannable.
- Search input filters coverage rows.
- Clicking a skill opens Search screen focused on that skill.
- Report screen lists prioritized actions without fake percentages.

## Rollout Plan

1. Add pure coverage helper and tests.
2. Wire Overview to use coverage groups instead of the matrix.
3. Update Report screen to use prioritized coverage actions.
4. Add styles for coverage sections, rows, status chips, and action groups.
5. Verify tests, build, and visual behavior.

## Risks And Mitigations

- Coverage rules may still feel too generic.
  Mitigation: make actions concrete and expose primary/backup/trainee people.

- Removing the matrix could hide useful detail.
  Mitigation: keep skill rows clickable into the existing Search screen.

- Category grouping may not match actual workstreams.
  Mitigation: use category for v1 and leave role/workstream filtering for a later spec.

- Team with little data may look empty.
  Mitigation: show honest empty states and profile completion prompts rather than fake scores.

- Overview could become visually dense.
  Mitigation: show a small number of high-priority rows per category, with drill-down for more detail later.
