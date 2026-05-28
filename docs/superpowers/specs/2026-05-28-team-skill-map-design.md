# Team Skill Map Design

Date: 2026-05-28
Status: Approved design, pending implementation plan

## Context

This mini-app is a Mushy workspace app with Vite, React 18, Supabase, and the shared Mushy mini-app helpers. The current app is still the bridge/context demo. The `skill-map` slug is already configured in `mushy.config.json`.

The feature should replace the demo with a practical internal skill directory for an intern team. The app should help teammates and mentors quickly answer:

- Who in this workspace is strong in a given area?
- Who can support another intern on a matching skill?
- Who should a mentor consider when assigning work in an external task system?

The app does not manage tasks or assignments in the MVP.

## Goals

- Let every workspace member view the team skill map.
- Let interns maintain their own skill profile.
- Let users find people by skill or working capability.
- Use endorsements as a ranking signal without making the UI feel like a leaderboard.
- Keep the data model simple enough for an MVP, while leaving room for a future dedicated mentor role.

## Non-Goals

- No task management or task assignment workflow.
- No numeric skill levels.
- No full audit log beyond standard metadata.
- No approval workflow for newly created skills in MVP.
- No skill matrix/spreadsheet view in MVP.

## User Model

For the MVP, Mushy workspace roles are used for permissions:

- `owner` and `admin` are treated as admin/mentor-like users.
- `member` is treated as a normal intern/member.

This is a product and permission shortcut only. The schema should avoid hard-coding a permanent mentor concept so the app can later support a separate app-level mentor role.

All workspace members can:

- View the skill map.
- Search/filter skills.
- View member skill profiles.
- Add, edit, and delete their own declared skills.
- Endorse another member's declared skill.
- Remove their own endorsement.

Admin/owner users can additionally remove inappropriate endorsements.

## Product Scope

The MVP is a Team Skill Directory. The first screen is a searchable team-wide skill map for both mentors and interns.

Users can declare a skill with one of two self-assessed states:

- `learning`: the user is currently learning this skill.
- `usable`: the user can use this skill in team work.

Endorsements are separate from self-declared status. They are used as a trust and ranking signal, not as visible points on the main screen.

Skills are organized by working-capability groups rather than only technical domains. Initial groups and skills are seeded so the team can use the app immediately, but users can also create new skills directly through typeahead when declaring their profile.

## Initial Skill Taxonomy

Seed data should include basic working-capability groups:

- Coding
- Testing
- Debugging
- Git
- Deployment
- Communication

Each group should have a small default skill list. The exact list can be adjusted during implementation, but it should stay broad and practical for interns rather than becoming a long expert taxonomy.

Examples:

- Coding: JavaScript, React, API integration, data modeling
- Testing: manual testing, test cases, unit tests
- Debugging: browser DevTools, reading logs, reproducing bugs
- Git: branching, pull requests, conflict resolution
- Deployment: Vercel preview, environment variables, release checks
- Communication: asking for help, documenting findings, handoff notes

## UI Structure

The React app should replace the current demo UI with three main areas.

### Explore

Explore is the default screen. It supports:

- Search by skill name.
- Filter by skill group.
- See a ranked list of matching members.
- Open a member detail view.

Member result cards should stay compact for mobile WebView usage. Each result should show:

- Name and avatar if available.
- Workspace role.
- Work phone if available from the shared profile helper.
- Matching skill.
- Self-declared status for that skill.
- A small set of related skills if useful.

The main result cards should not show raw endorsement counts.

### My Skills

My Skills lets the current user maintain their own profile:

- Choose a skill group first.
- Add a skill using typeahead against existing skills.
- Create a new skill in the selected group immediately if the typeahead has no match.
- Choose `learning` or `usable`.
- Change the status later.
- Delete their own skill entry.

The empty state should guide the user to add their first skill.

### Member Detail

Member Detail opens from Explore and shows:

- Profile information from `listMembers()`.
- All declared skills grouped by capability group.
- The viewer's current endorsement state for each skill.
- Actions to endorse or remove the viewer's own endorsement.
- Admin/owner action to remove inappropriate endorsements.

Endorsement detail can be visible here, but the MVP should avoid turning this into a score table.

## Data Model

All app tables live in the app schema for the configured slug:

- Production schema: `app_skill_map`
- Development and preview schema: `app_skill_map_dev`

Migration SQL should reference only the production schema name. The Mushy migration reviewer handles dev schema rewriting.

### `skill_groups`

Purpose: stores working-capability groups.

Fields:

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references public.workspaces(id) on delete cascade`
- `name text not null`
- `normalized_name text not null`
- `sort_order integer not null default 0`
- `created_by uuid references auth.users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- Unique normalized group name per workspace.
- Index on `workspace_id`.
- Index on `(workspace_id, sort_order, name)`.

`normalized_name` uses the same normalization rule as `skills.normalized_name`.

### `skills`

Purpose: stores specific skills.

Fields:

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references public.workspaces(id) on delete cascade`
- `group_id uuid references app_skill_map.skill_groups(id) on delete set null`
- `name text not null`
- `normalized_name text not null`
- `created_by uuid references auth.users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- Unique `(workspace_id, normalized_name)`.
- Index on `workspace_id`.
- Index on `(workspace_id, group_id, name)`.

`normalized_name` should be generated by app code before insert. It should trim whitespace, collapse repeated spaces, and compare case-insensitively.

### `member_skills`

Purpose: stores a member's self-declared skills.

Fields:

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references public.workspaces(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `skill_id uuid not null references app_skill_map.skills(id) on delete cascade`
- `status text not null check (status in ('learning', 'usable'))`
- `created_by uuid references auth.users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- Unique `(workspace_id, user_id, skill_id)`.
- Index on `workspace_id`.
- Index on `(workspace_id, user_id)`.
- Index on `(workspace_id, skill_id)`.

App-level behavior:

- Users may insert/update/delete only their own `member_skills`.
- Admin/owner users do not edit other users' skill declarations in MVP.

### `skill_endorsements`

Purpose: stores endorsements for declared member skills.

Fields:

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references public.workspaces(id) on delete cascade`
- `member_skill_id uuid not null references app_skill_map.member_skills(id) on delete cascade`
- `member_user_id uuid not null references auth.users(id) on delete cascade`
- `skill_id uuid not null references app_skill_map.skills(id) on delete cascade`
- `endorser_user_id uuid not null references auth.users(id) on delete cascade`
- `source_type text not null check (source_type in ('admin', 'peer'))`
- `created_at timestamptz not null default now()`

Constraints/indexes:

- Unique `(workspace_id, member_skill_id, endorser_user_id)`.
- Check that users cannot endorse themselves.
- Index on `workspace_id`.
- Index on `(workspace_id, member_skill_id)`.
- Index on `(workspace_id, skill_id)`.
- Index on `(workspace_id, member_user_id)`.

`source_type` is captured at creation time from the endorser's current workspace role:

- `admin` for workspace `owner` or `admin`.
- `peer` for workspace `member`.

This snapshot makes ranking stable even if the endorser role changes later.

## RLS and Permissions

Every table must follow the Mushy app RLS pattern:

- Include `workspace_id`.
- Reference `public.workspaces(id)` with `on delete cascade`.
- Enable RLS.
- Use `public.can_access_app_data(workspace_id, 'skill-map')` for select/insert/update checks where appropriate.
- Use owner-workspace membership for delete policies where required.

The RLS layer should protect workspace isolation. Additional ownership checks should be enforced either through table policies or app-side guards:

- `member_skills`: only the `user_id` owner can update/delete their own rows.
- `skill_endorsements`: the endorser can delete their own row.
- `skill_endorsements`: admin/owner users can delete inappropriate endorsement rows.
- Users cannot endorse their own `member_skills`.

All queries in app code must filter by the active workspace scope:

```js
.eq('workspace_id', activeScope.workspaceId)
```

## Data Flow

On app load:

1. Read app context with `getContext()`.
2. Initialize active scope with the existing sharing helpers.
3. Load workspace members with `listMembers(activeScope.workspaceId)`.
4. Load `skill_groups`, `skills`, `member_skills`, and `skill_endorsements` filtered by `workspace_id`.
5. Build in-memory indexes for Explore and Member Detail.

For the MVP, Explore can join and rank data client-side. The expected intern team size is small enough that this keeps implementation simple and avoids early database functions.

Mutations:

- Add skill declaration: choose a group, find or create `skills` in that group, then upsert `member_skills`.
- Update skill declaration: update `member_skills.status`.
- Delete skill declaration: delete the user's `member_skills` row; endorsements cascade.
- Endorse: insert into `skill_endorsements`.
- Remove endorsement: delete the matching row.

After each mutation, refetch the main dataset to keep UI state consistent.

## Ranking

When a user searches for a skill, matching members are sorted by:

1. Has at least one `admin` endorsement.
2. Number of `peer` endorsements.
3. Self-declared status, with `usable` before `learning`.
4. Member display name for stable ordering.

Raw endorsement counts should not be displayed on the main Explore cards. Member Detail may show enough endorsement context for users to understand why a skill is trusted.

## Error Handling

The app should use `useDialog()` for user-facing errors instead of native `alert` or `confirm`.

Required states:

- Loading state for Explore and My Skills.
- Empty state when no skills exist yet.
- Empty state when search has no matches.
- Error state when the dataset cannot be loaded.
- Inline duplicate handling when a new skill normalizes to an existing skill.

If member profile data such as phone or avatar is missing, the app should continue rendering skill data without blocking the page.

## Testing and Verification

Implementation should include focused helper tests where practical:

- Skill name normalization.
- Ranking behavior.
- Grouping/filtering behavior.

Required verification:

- `npm run build`
- Manual smoke test in the browser:
  - Add an existing skill.
  - Create a new skill through typeahead.
  - Change `learning` to `usable`.
  - Delete a skill entry.
  - Endorse another member.
  - Remove an endorsement.
  - Search/filter by skill.
  - Open member detail.

If no automated test runner exists in the repo, helper functions should still be written in a way that is easy to test later.

## Open Implementation Notes

- Reuse existing helpers: `getContext`, `useActiveScope`, `listMembers`, `db`, and `useDialog`.
- Keep UI mobile-first for the Mushy WebView.
- Use the existing Mushy theme tokens, but avoid keeping the current demo layout.
- Realtime is not required for MVP; explicit refetch after mutations is sufficient.
- Cross-workspace sharing support should come from the existing active-scope pattern, but the MVP can be validated first inside one workspace.
