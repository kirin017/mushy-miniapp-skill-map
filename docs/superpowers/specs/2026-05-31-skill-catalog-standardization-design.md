# Skill Catalog Standardization Design

## Summary

Skill Map will move from an open-ended skills table to a repo-versioned standard catalog with workspace-level proposals. The goal is to keep the heatmap clear and comparable while still allowing teams to request skills that are missing from the catalog.

The selected approach is:

- Standard catalog lives in the repo and is synced into each workspace.
- Catalog v1 contains roughly 50-70 skills.
- Skills can be capabilities or important tools/frameworks.
- Each catalog skill has aliases for mapping old data and user input.
- Existing dirty skills are auto-mapped with medium confidence.
- Unclear skills become pending proposals for workspace owner/admin review.

Reference sources for catalog shape:

- SFIA 9 for professional technology capability categories.
- O*NET Technology Skills for concrete tools/framework naming and aliases.
- NICE Framework for cybersecurity terminology.
- ESCO as a broad secondary reference for skills classification.

## Current State

The app currently defines `PRESET_SKILLS` in `src/lib/app/skill-map-data.js`. These presets are inserted only when the workspace `skills` table is empty. Users can also create arbitrary custom skills from the profile flow.

The database currently stores:

- `name`
- `category`
- `is_preset`

This is not enough to distinguish approved catalog skills from user proposals, merge duplicate skills, record aliases, or preserve review history. As a result, the DB can contain unclear, duplicated, or user-invented skills that pollute the picker and heatmap.

## Goals

- Provide a clear standard catalog for team skill mapping.
- Preserve existing member skill data during cleanup.
- Automatically merge obvious duplicates into canonical skills.
- Avoid unsafe automatic merges for ambiguous skill names.
- Let workspace owner/admin review new skill proposals.
- Keep the member-facing picker and heatmap focused on approved skills.
- Keep catalog changes reviewable through git.

## Non-Goals

- Importing full SFIA, ESCO, O*NET, or NICE datasets into the app.
- Building a global system-admin approval workflow.
- Letting each workspace freely redefine the standard catalog.
- Adding AI-based matching in the first implementation.
- Deleting historical member skill data during cleanup.

## Catalog Model

The repo will contain a standard catalog file. Each skill should include:

- `key`: stable catalog key, for example `frontend.react` or `devops.ci_cd`.
- `name`: display name.
- `category`: high-level group such as `Frontend`, `Backend`, `DevOps/Cloud`, or `Security`.
- `skillType`: `capability` or `tool`.
- `aliases`: alternative names used for matching, such as `ReactJS`, `React.js`, or `Postgres`.
- `description`: short explanation of what the skill means.
- `sourceRefs`: optional source hints such as `SFIA`, `O*NET`, or `NICE`.
- `status`: catalog entry status, initially `approved`.

Catalog v1 should be medium-sized, around 50-70 entries. It should mix capability skills and important tool/framework skills in a controlled way.

Suggested category shape:

- Frontend
- Backend
- Database/Data
- AI/ML
- Mobile
- DevOps/Cloud
- Quality
- Security
- Design/Product

## Database Model

The existing `skills` table remains the workspace-facing skill table, but should gain metadata:

- `catalog_key`: stable key from the repo catalog for standard skills.
- `status`: `approved`, `pending`, `rejected`, or `merged`.
- `skill_type`: `capability` or `tool`.
- `aliases`: aliases used for matching and display support.
- `description`: short skill definition.
- `source`: source of the row, such as `catalog`, `proposal`, or `legacy`.
- `canonical_skill_id`: points to the approved skill when a legacy/proposed skill is merged.
- `reviewed_by`: user who reviewed a pending skill.
- `reviewed_at`: timestamp of review.
- `review_note`: short note for merge/reject decisions.

Implementation constraints:

- Unique approved catalog skill per workspace and `catalog_key`.
- Preserve workspace/name uniqueness for active `approved` and `pending` skills. Merge logic must resolve name conflicts before a stricter uniqueness constraint is enforced.
- `member_skills.skill_id` should ultimately point to approved canonical skills for heatmap use.

## Data Flow

### Startup and Sync

On app startup or a dedicated sync path, the app ensures catalog skills exist in the active workspace:

- If a catalog skill is missing, insert it as `approved`.
- If a catalog skill exists, update safe metadata such as aliases, description, category, and type.
- Do not overwrite member levels, interests, or notes.

This replaces the current behavior where presets are inserted only if the skills table is empty.

### Existing Dirty Skills

Legacy skills already in the DB should be processed by the mapper:

- If a legacy skill clearly matches a catalog skill, merge it into the canonical catalog skill.
- Member skill records keep their level, interest, and note and are moved to the canonical `skill_id`.
- If the mapper cannot make a confident match, the skill becomes `pending`.
- Pending skills do not appear in the main picker or heatmap.

### Member Skill Entry

Members choose from approved skills. If a skill is missing, they can propose a new skill.

A proposal should include:

- Skill name.
- Suggested category.
- Optional note explaining why the skill is needed.

The proposal is stored as `pending`. It does not become part of the main heatmap until reviewed.

### Admin Review

Workspace owner/admin can review pending skills and choose:

- Approve as a workspace-specific skill.
- Merge into an existing approved skill.
- Reject with a short note.

When approving or merging, related member skill records must be preserved.

## Mapping Rules

Matching uses medium confidence:

1. Normalize names and aliases:
   - Lowercase.
   - Remove Vietnamese accents.
   - Normalize separators such as spaces, hyphens, underscores, slashes, and dots.
   - Trim repeated whitespace.

2. Exact and alias matching:
   - Match normalized skill name to catalog name.
   - Match normalized skill name to any catalog alias.

3. Safe fuzzy matching:
   - Allow obvious variants such as `postgres` to `PostgreSQL`.
   - Allow separator variants such as `ci cd` to `CI/CD`.
   - Allow common spelling variants such as `reactjs` to `React`.

4. Ambiguity handling:
   - Do not auto-merge broad terms such as `cloud`, `backend`, `automation`, or `AI` unless explicitly listed as aliases.
   - If multiple catalog entries match with similar confidence, mark pending.
   - If confidence is below the selected threshold, mark pending.

## UI Behavior

### Member Picker

- Shows approved skills only.
- Offers a proposal action when the needed skill is missing.
- Does not let members create approved catalog skills directly.

### Profile

- Shows approved member skills in the main list.
- Shows pending proposed skills separately so users know their data was not lost.

### Overview and Heatmap

- Use approved skills only.
- Merged and rejected skills are excluded.
- Pending skills are excluded until reviewed.

### Admin Queue

Workspace owner/admin sees a pending queue with enough context to decide:

- Proposed name.
- Suggested category.
- Proposer/member count.
- Suggested matches from the mapper.
- Actions: approve, merge, reject.

## Testing Plan

Unit tests:

- Catalog validation: unique keys, valid categories, valid skill types, no duplicate aliases after normalization.
- Mapper: exact matches, alias matches, safe fuzzy matches, ambiguous matches, pending fallback.
- Merge behavior: member levels/interests/notes are preserved when skill IDs are canonicalized.

Integration/data tests:

- Catalog sync inserts missing approved skills.
- Catalog sync updates safe metadata without overwriting member data.
- Pending skills do not appear in heatmap composition.
- Approved workspace-specific skills appear after review.

UI/source checks:

- Profile flow creates pending proposals instead of approved skills for unknown inputs.
- Picker excludes pending/rejected/merged skills.
- Admin queue actions are wired to review state changes.

Verification commands:

- `npm run test`
- `npm run build`

## Rollout Plan

1. Add the repo catalog and validation tests.
2. Add schema migration for skill metadata and review state.
3. Implement mapper and unit tests.
4. Implement catalog sync and legacy cleanup path.
5. Update profile skill creation to produce pending proposals.
6. Filter overview/search/heatmap to approved canonical skills.
7. Add a small admin review queue for workspace owner/admin.
8. Verify with current tests, new mapper tests, build, and a local visual pass.

## Risks and Mitigations

- Wrong merge could corrupt meaning of member skills.
  Mitigation: medium confidence only, explicit aliases, ambiguous cases go pending.

- Catalog v1 may still miss important skills.
  Mitigation: proposal flow allows workspace admins to approve missing skills.

- Schema migration may conflict with existing unique names.
  Mitigation: implement merge logic before enforcing stricter catalog uniqueness.

- Admin UI could become too large.
  Mitigation: keep v1 queue small with approve/merge/reject only.
