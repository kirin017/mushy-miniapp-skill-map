# Team Skill Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Team Skill Map MVP: a workspace-wide skill directory where interns declare skills, teammates endorse skills, and users find the right person to support a work area.

**Architecture:** Keep the app as a client-side React mini-app over Supabase tables in the `app_skill_map` schema. Use focused pure helpers for normalization/ranking, a data API module for Supabase operations, and small UI components for Explore, My Skills, and Member Detail. Seed the starter taxonomy per workspace at runtime because seeded rows require the active `workspace_id`.

**Tech Stack:** Vite, React 18, Supabase JS, Mushy mini-app helpers, Node built-in test runner.

---

## Scope Check

The spec is a single product slice. It has one database model, one data-access layer, and one React app workflow. It can be implemented as one plan with sequential setup tasks and parallelizable UI/data refinements after the shared contracts exist.

Implementation parallelism: Sequential first, then parallel lanes
Reason: Migration, helper contracts, and data API must land before UI lanes can safely work independently.

Parallelization Strategy:

- Can parallelize: yes, after Tasks 1-3 are complete.
- Implementation lanes:
  - Lane A: Explore search/results UI in `src/App.jsx` and `src/App.css`.
  - Lane B: My Skills form/typeahead UI in `src/components/SkillTypeahead.jsx`, `src/components/SkillStatusBadge.jsx`, and `src/App.jsx`.
  - Lane C: Member Detail endorsement UI in `src/components/MemberDetailModal.jsx`.
- Sequential dependencies:
  - Task 1 creates pure helper contracts and tests.
  - Task 2 creates tables and RLS.
  - Task 3 creates Supabase API functions used by every UI lane.
  - Final integration must resolve shared `src/App.jsx` and `src/App.css` edits.
- Verification:
  - Per-lane: `npm test` and `npm run build`.
  - Final: `npm test`, `npm run build`, run local app, browser smoke through add/search/detail flows.
- Recommended Phase 3 Agent Split Gate input: Local only for Tasks 1-3, then Spawn for UI lanes if agent tools are available. Reason: shared contracts are sequential, but UI surfaces are separable once the data layer exists.

## File Structure

- Create `src/lib/skill-map-utils.js`: pure functions for skill name normalization, dataset indexing, member ranking, and grouping.
- Create `test/skill-map-utils.test.mjs`: Node tests for the pure helper behavior.
- Modify `package.json`: add `npm test` using Node's built-in test runner.
- Create `migrations/002_team_skill_map.sql`: tables, indexes, grants, triggers, RLS policies for skill map data.
- Create `src/lib/skill-map-api.js`: Supabase reads, workspace taxonomy bootstrap, skill/member skill mutations, endorsement mutations.
- Create `src/lib/useSkillMapData.js`: React hook that loads context, active scope, members, skill map data, and exposes refresh state.
- Create `src/components/SkillStatusBadge.jsx`: compact visual status component for `learning` and `usable`.
- Create `src/components/SkillTypeahead.jsx`: group selector plus typeahead/create-new skill input.
- Create `src/components/MemberDetailModal.jsx`: member profile details and endorsement actions.
- Replace `src/App.jsx`: main Team Skill Map app layout and workflow.
- Replace `src/App.css`: app-specific responsive styles.

## Task 1: Pure Helpers and Tests

**Files:**
- Create: `src/lib/skill-map-utils.js`
- Create: `test/skill-map-utils.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add the test script**

Modify `package.json` scripts to include:

```json
"test": "node --test test/*.test.mjs"
```

Keep the existing scripts unchanged.

- [ ] **Step 2: Write failing helper tests**

Create `test/skill-map-utils.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSkillMapIndex,
  groupMemberSkills,
  normalizeSkillName,
  rankSkillMatches,
} from '../src/lib/skill-map-utils.js';

test('normalizeSkillName trims, collapses whitespace, and lowercases', () => {
  assert.equal(normalizeSkillName('  React   Query  '), 'react query');
  assert.equal(normalizeSkillName('Git'), 'git');
  assert.equal(normalizeSkillName(''), '');
});

test('rankSkillMatches prioritizes admin endorsements, then peer endorsements, then usable status', () => {
  const members = [
    { user_id: 'u1', full_name: 'Bao' },
    { user_id: 'u2', full_name: 'An' },
    { user_id: 'u3', full_name: 'Chi' },
  ];
  const skills = [{ id: 's1', name: 'Debugging', group_id: 'g1' }];
  const memberSkills = [
    { id: 'ms1', user_id: 'u1', skill_id: 's1', status: 'learning' },
    { id: 'ms2', user_id: 'u2', skill_id: 's1', status: 'usable' },
    { id: 'ms3', user_id: 'u3', skill_id: 's1', status: 'learning' },
  ];
  const endorsements = [
    { id: 'e1', member_skill_id: 'ms1', source_type: 'peer' },
    { id: 'e2', member_skill_id: 'ms1', source_type: 'peer' },
    { id: 'e3', member_skill_id: 'ms3', source_type: 'admin' },
  ];

  const ranked = rankSkillMatches({ members, skills, memberSkills, endorsements, skillId: 's1' });

  assert.deepEqual(ranked.map((r) => r.member.user_id), ['u3', 'u1', 'u2']);
  assert.equal(ranked[0].adminEndorsements, 1);
  assert.equal(ranked[1].peerEndorsements, 2);
});

test('buildSkillMapIndex joins skills, groups, member skills, and endorsements', () => {
  const index = buildSkillMapIndex({
    groups: [{ id: 'g1', name: 'Git', sort_order: 2 }],
    skills: [{ id: 's1', group_id: 'g1', name: 'Pull requests' }],
    memberSkills: [{ id: 'ms1', user_id: 'u1', skill_id: 's1', status: 'usable' }],
    endorsements: [{ id: 'e1', member_skill_id: 'ms1', source_type: 'peer' }],
  });

  assert.equal(index.skillsById.get('s1').group.name, 'Git');
  assert.equal(index.memberSkillsByUser.get('u1')[0].skill.name, 'Pull requests');
  assert.equal(index.endorsementsByMemberSkill.get('ms1').length, 1);
});

test('groupMemberSkills orders by group sort order and skill name', () => {
  const grouped = groupMemberSkills([
    { id: 'ms2', skill: { name: 'Conflict resolution', group: { id: 'g2', name: 'Git', sort_order: 1 } } },
    { id: 'ms1', skill: { name: 'Debugging logs', group: { id: 'g1', name: 'Debugging', sort_order: 0 } } },
  ]);

  assert.deepEqual(grouped.map((g) => g.group.name), ['Debugging', 'Git']);
  assert.deepEqual(grouped[1].items.map((i) => i.skill.name), ['Conflict resolution']);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test
```

Expected: FAIL because `src/lib/skill-map-utils.js` does not exist yet.

- [ ] **Step 4: Implement helper functions**

Create `src/lib/skill-map-utils.js`:

```js
export function normalizeSkillName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function displayNameForMember(member) {
  return member?.full_name || member?.user_id?.slice(0, 8) || 'Unknown';
}

export function buildSkillMapIndex({ groups = [], skills = [], memberSkills = [], endorsements = [] }) {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const skillsById = new Map(skills.map((skill) => [
    skill.id,
    { ...skill, group: groupsById.get(skill.group_id) || null },
  ]));

  const endorsementsByMemberSkill = new Map();
  for (const endorsement of endorsements) {
    const bucket = endorsementsByMemberSkill.get(endorsement.member_skill_id) || [];
    bucket.push(endorsement);
    endorsementsByMemberSkill.set(endorsement.member_skill_id, bucket);
  }

  const memberSkillsByUser = new Map();
  for (const row of memberSkills) {
    const enriched = {
      ...row,
      skill: skillsById.get(row.skill_id) || null,
      endorsements: endorsementsByMemberSkill.get(row.id) || [],
    };
    const bucket = memberSkillsByUser.get(row.user_id) || [];
    bucket.push(enriched);
    memberSkillsByUser.set(row.user_id, bucket);
  }

  for (const bucket of memberSkillsByUser.values()) {
    bucket.sort(compareMemberSkill);
  }

  return { groupsById, skillsById, endorsementsByMemberSkill, memberSkillsByUser };
}

export function rankSkillMatches({ members = [], skills = [], memberSkills = [], endorsements = [], skillId }) {
  const membersById = new Map(members.map((member) => [member.user_id, member]));
  const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
  const endorsementsByMemberSkill = new Map();

  for (const endorsement of endorsements) {
    const bucket = endorsementsByMemberSkill.get(endorsement.member_skill_id) || [];
    bucket.push(endorsement);
    endorsementsByMemberSkill.set(endorsement.member_skill_id, bucket);
  }

  return memberSkills
    .filter((row) => row.skill_id === skillId)
    .map((row) => {
      const rowEndorsements = endorsementsByMemberSkill.get(row.id) || [];
      const adminEndorsements = rowEndorsements.filter((e) => e.source_type === 'admin').length;
      const peerEndorsements = rowEndorsements.filter((e) => e.source_type === 'peer').length;
      return {
        memberSkill: row,
        member: membersById.get(row.user_id) || { user_id: row.user_id, full_name: null },
        skill: skillsById.get(row.skill_id) || null,
        adminEndorsements,
        peerEndorsements,
        statusWeight: row.status === 'usable' ? 1 : 0,
      };
    })
    .sort((a, b) => {
      if (b.adminEndorsements !== a.adminEndorsements) return b.adminEndorsements - a.adminEndorsements;
      if (b.peerEndorsements !== a.peerEndorsements) return b.peerEndorsements - a.peerEndorsements;
      if (b.statusWeight !== a.statusWeight) return b.statusWeight - a.statusWeight;
      return displayNameForMember(a.member).localeCompare(displayNameForMember(b.member), 'vi');
    });
}

export function groupMemberSkills(items = []) {
  const groups = new Map();

  for (const item of items) {
    const group = item.skill?.group || { id: 'ungrouped', name: 'Khác', sort_order: 999 };
    const bucket = groups.get(group.id) || { group, items: [] };
    bucket.items.push(item);
    groups.set(group.id, bucket);
  }

  return Array.from(groups.values())
    .map((entry) => ({
      ...entry,
      items: entry.items.slice().sort(compareMemberSkill),
    }))
    .sort((a, b) => {
      const byOrder = (a.group.sort_order ?? 999) - (b.group.sort_order ?? 999);
      if (byOrder !== 0) return byOrder;
      return a.group.name.localeCompare(b.group.name, 'vi');
    });
}

function compareMemberSkill(a, b) {
  const aGroup = a.skill?.group?.sort_order ?? 999;
  const bGroup = b.skill?.group?.sort_order ?? 999;
  if (aGroup !== bGroup) return aGroup - bGroup;
  return (a.skill?.name || '').localeCompare(b.skill?.name || '', 'vi');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
npm test
```

Expected: PASS for all helper tests.

- [ ] **Step 6: Commit**

```bash
git add package.json src/lib/skill-map-utils.js test/skill-map-utils.test.mjs
git commit -m "test: add skill map helper coverage"
```

## Task 2: Database Migration

**Files:**
- Create: `migrations/002_team_skill_map.sql`

- [ ] **Step 1: Create migration with tables, indexes, RLS, and triggers**

Create `migrations/002_team_skill_map.sql`:

```sql
create table if not exists app_skill_map.skill_groups (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  name            text not null check (char_length(trim(name)) between 1 and 80),
  normalized_name text not null check (char_length(trim(normalized_name)) between 1 and 80),
  sort_order      integer not null default 0,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, normalized_name)
);

create table if not exists app_skill_map.skills (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  group_id        uuid references app_skill_map.skill_groups(id) on delete set null,
  name            text not null check (char_length(trim(name)) between 1 and 120),
  normalized_name text not null check (char_length(trim(normalized_name)) between 1 and 120),
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, normalized_name)
);

create table if not exists app_skill_map.member_skills (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  skill_id     uuid not null references app_skill_map.skills(id) on delete cascade,
  status       text not null check (status in ('learning', 'usable')),
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, user_id, skill_id)
);

create table if not exists app_skill_map.skill_endorsements (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  member_skill_id   uuid not null references app_skill_map.member_skills(id) on delete cascade,
  member_user_id    uuid not null references auth.users(id) on delete cascade,
  skill_id          uuid not null references app_skill_map.skills(id) on delete cascade,
  endorser_user_id  uuid not null references auth.users(id) on delete cascade,
  source_type       text not null check (source_type in ('admin', 'peer')),
  created_at        timestamptz not null default now(),
  check (member_user_id <> endorser_user_id),
  unique (workspace_id, member_skill_id, endorser_user_id)
);

create index if not exists idx_skill_groups_workspace on app_skill_map.skill_groups (workspace_id);
create index if not exists idx_skill_groups_workspace_order on app_skill_map.skill_groups (workspace_id, sort_order, name);
create index if not exists idx_skills_workspace on app_skill_map.skills (workspace_id);
create index if not exists idx_skills_workspace_group on app_skill_map.skills (workspace_id, group_id, name);
create index if not exists idx_member_skills_workspace on app_skill_map.member_skills (workspace_id);
create index if not exists idx_member_skills_workspace_user on app_skill_map.member_skills (workspace_id, user_id);
create index if not exists idx_member_skills_workspace_skill on app_skill_map.member_skills (workspace_id, skill_id);
create index if not exists idx_endorsements_workspace on app_skill_map.skill_endorsements (workspace_id);
create index if not exists idx_endorsements_member_skill on app_skill_map.skill_endorsements (workspace_id, member_skill_id);
create index if not exists idx_endorsements_skill on app_skill_map.skill_endorsements (workspace_id, skill_id);
create index if not exists idx_endorsements_member_user on app_skill_map.skill_endorsements (workspace_id, member_user_id);

grant select, insert, update, delete on app_skill_map.skill_groups to authenticated;
grant select, insert, update, delete on app_skill_map.skills to authenticated;
grant select, insert, update, delete on app_skill_map.member_skills to authenticated;
grant select, insert, update, delete on app_skill_map.skill_endorsements to authenticated;

alter table app_skill_map.skill_groups enable row level security;
alter table app_skill_map.skills enable row level security;
alter table app_skill_map.member_skills enable row level security;
alter table app_skill_map.skill_endorsements enable row level security;

create or replace function app_skill_map.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_skill_groups_updated_at on app_skill_map.skill_groups;
create trigger trg_skill_groups_updated_at
  before update on app_skill_map.skill_groups
  for each row execute function app_skill_map.set_updated_at();

drop trigger if exists trg_skills_updated_at on app_skill_map.skills;
create trigger trg_skills_updated_at
  before update on app_skill_map.skills
  for each row execute function app_skill_map.set_updated_at();

drop trigger if exists trg_member_skills_updated_at on app_skill_map.member_skills;
create trigger trg_member_skills_updated_at
  before update on app_skill_map.member_skills
  for each row execute function app_skill_map.set_updated_at();

drop policy if exists "skill_groups_select" on app_skill_map.skill_groups;
drop policy if exists "skill_groups_insert" on app_skill_map.skill_groups;
drop policy if exists "skill_groups_update" on app_skill_map.skill_groups;
drop policy if exists "skill_groups_delete" on app_skill_map.skill_groups;
create policy "skill_groups_select" on app_skill_map.skill_groups
for select using (public.can_access_app_data(workspace_id, 'skill-map'));
create policy "skill_groups_insert" on app_skill_map.skill_groups
for insert with check (public.can_access_app_data(workspace_id, 'skill-map'));
create policy "skill_groups_update" on app_skill_map.skill_groups
for update using (public.can_access_app_data(workspace_id, 'skill-map'))
with check (public.can_access_app_data(workspace_id, 'skill-map'));
create policy "skill_groups_delete" on app_skill_map.skill_groups
for delete using (public.is_owner_workspace_member(workspace_id));

drop policy if exists "skills_select" on app_skill_map.skills;
drop policy if exists "skills_insert" on app_skill_map.skills;
drop policy if exists "skills_update" on app_skill_map.skills;
drop policy if exists "skills_delete" on app_skill_map.skills;
create policy "skills_select" on app_skill_map.skills
for select using (public.can_access_app_data(workspace_id, 'skill-map'));
create policy "skills_insert" on app_skill_map.skills
for insert with check (public.can_access_app_data(workspace_id, 'skill-map'));
create policy "skills_update" on app_skill_map.skills
for update using (public.can_access_app_data(workspace_id, 'skill-map'))
with check (public.can_access_app_data(workspace_id, 'skill-map'));
create policy "skills_delete" on app_skill_map.skills
for delete using (public.is_owner_workspace_member(workspace_id));

drop policy if exists "member_skills_select" on app_skill_map.member_skills;
drop policy if exists "member_skills_insert" on app_skill_map.member_skills;
drop policy if exists "member_skills_update" on app_skill_map.member_skills;
drop policy if exists "member_skills_delete" on app_skill_map.member_skills;
create policy "member_skills_select" on app_skill_map.member_skills
for select using (public.can_access_app_data(workspace_id, 'skill-map'));
create policy "member_skills_insert" on app_skill_map.member_skills
for insert with check (
  public.can_access_app_data(workspace_id, 'skill-map')
  and user_id = auth.uid()
);
create policy "member_skills_update" on app_skill_map.member_skills
for update using (
  public.can_access_app_data(workspace_id, 'skill-map')
  and user_id = auth.uid()
) with check (
  public.can_access_app_data(workspace_id, 'skill-map')
  and user_id = auth.uid()
);
create policy "member_skills_delete" on app_skill_map.member_skills
for delete using (
  public.can_access_app_data(workspace_id, 'skill-map')
  and user_id = auth.uid()
);

drop policy if exists "skill_endorsements_select" on app_skill_map.skill_endorsements;
drop policy if exists "skill_endorsements_insert" on app_skill_map.skill_endorsements;
drop policy if exists "skill_endorsements_delete" on app_skill_map.skill_endorsements;
create policy "skill_endorsements_select" on app_skill_map.skill_endorsements
for select using (public.can_access_app_data(workspace_id, 'skill-map'));
create policy "skill_endorsements_insert" on app_skill_map.skill_endorsements
for insert with check (
  public.can_access_app_data(workspace_id, 'skill-map')
  and endorser_user_id = auth.uid()
  and member_user_id <> auth.uid()
  and (
    (source_type = 'admin' and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = skill_endorsements.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    ))
    or
    (source_type = 'peer' and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = skill_endorsements.workspace_id
        and wm.user_id = auth.uid()
        and wm.role not in ('owner', 'admin')
    ))
  )
);
create policy "skill_endorsements_delete" on app_skill_map.skill_endorsements
for delete using (
  public.can_access_app_data(workspace_id, 'skill-map')
  and (
    endorser_user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = skill_endorsements.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
);
```

- [ ] **Step 2: Sanity-check migration text**

Run:

```bash
rg -n "app_skill_map_dev|public\\.skill|TODO|TBD" migrations/002_team_skill_map.sql
```

Expected: no output. The migration must not reference `_dev` directly.

- [ ] **Step 3: Commit**

```bash
git add migrations/002_team_skill_map.sql
git commit -m "feat: add skill map migration"
```

## Task 3: Supabase Data API and Runtime Seed

**Files:**
- Create: `src/lib/skill-map-api.js`

- [ ] **Step 1: Create data API module**

Create `src/lib/skill-map-api.js`:

```js
import { getContext } from './context.js';
import { listMembers } from './members.js';
import { db } from './supabase.js';
import { normalizeSkillName } from './skill-map-utils.js';

export const SKILL_STATUSES = {
  learning: 'Đang học',
  usable: 'Dùng được',
};

export const SEED_TAXONOMY = [
  { name: 'Coding', sort_order: 10, skills: ['JavaScript', 'React', 'API integration', 'Data modeling'] },
  { name: 'Testing', sort_order: 20, skills: ['Manual testing', 'Test cases', 'Unit tests'] },
  { name: 'Debugging', sort_order: 30, skills: ['Browser DevTools', 'Reading logs', 'Reproducing bugs'] },
  { name: 'Git', sort_order: 40, skills: ['Branching', 'Pull requests', 'Conflict resolution'] },
  { name: 'Deployment', sort_order: 50, skills: ['Vercel preview', 'Environment variables', 'Release checks'] },
  { name: 'Communication', sort_order: 60, skills: ['Asking for help', 'Documenting findings', 'Handoff notes'] },
];

export async function loadSkillMapDataset(workspaceId) {
  if (!workspaceId) throw new Error('workspaceId is required');
  const [members, groups, skills, memberSkills, endorsements] = await Promise.all([
    listMembers(workspaceId),
    selectAll('skill_groups', workspaceId, 'sort_order', true),
    selectAll('skills', workspaceId, 'name', true),
    selectAll('member_skills', workspaceId, 'updated_at', false),
    selectAll('skill_endorsements', workspaceId, 'created_at', false),
  ]);

  return { members, groups, skills, memberSkills, endorsements };
}

export async function ensureSeedTaxonomy(workspaceId) {
  const ctx = getContext();
  for (const group of SEED_TAXONOMY) {
    const savedGroup = await findOrCreateGroup({
      workspaceId,
      name: group.name,
      sortOrder: group.sort_order,
      createdBy: ctx.userId,
    });
    for (const skillName of group.skills) {
      await findOrCreateSkill({
        workspaceId,
        groupId: savedGroup.id,
        name: skillName,
        createdBy: ctx.userId,
      });
    }
  }
}

export async function findOrCreateGroup({ workspaceId, name, sortOrder = 100, createdBy }) {
  const normalizedName = normalizeSkillName(name);
  if (!normalizedName) throw new Error('Tên nhóm không hợp lệ');

  const existing = await findByNormalizedName('skill_groups', workspaceId, normalizedName);
  if (existing) return existing;

  const { data, error } = await db
    .from('skill_groups')
    .insert({
      workspace_id: workspaceId,
      name: name.trim().replace(/\s+/g, ' '),
      normalized_name: normalizedName,
      sort_order: sortOrder,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    const raced = await findByNormalizedName('skill_groups', workspaceId, normalizedName);
    if (raced) return raced;
    throw error;
  }
  return data;
}

export async function findOrCreateSkill({ workspaceId, groupId, name, createdBy }) {
  const normalizedName = normalizeSkillName(name);
  if (!normalizedName) throw new Error('Tên skill không hợp lệ');

  const existing = await findByNormalizedName('skills', workspaceId, normalizedName);
  if (existing) return existing;

  const { data, error } = await db
    .from('skills')
    .insert({
      workspace_id: workspaceId,
      group_id: groupId,
      name: name.trim().replace(/\s+/g, ' '),
      normalized_name: normalizedName,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    const raced = await findByNormalizedName('skills', workspaceId, normalizedName);
    if (raced) return raced;
    throw error;
  }
  return data;
}

export async function saveMemberSkill({ workspaceId, userId, skillId, status }) {
  const { data, error } = await db
    .from('member_skills')
    .upsert({
      workspace_id: workspaceId,
      user_id: userId,
      skill_id: skillId,
      status,
      created_by: userId,
    }, { onConflict: 'workspace_id,user_id,skill_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMemberSkillStatus({ id, workspaceId, status }) {
  const { data, error } = await db
    .from('member_skills')
    .update({ status })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMemberSkill({ id, workspaceId }) {
  const { error } = await db
    .from('member_skills')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);
  if (error) throw error;
}

export async function endorseMemberSkill({ workspaceId, memberSkill, currentUserRole }) {
  const ctx = getContext();
  const sourceType = ['owner', 'admin'].includes(currentUserRole) ? 'admin' : 'peer';
  const { data, error } = await db
    .from('skill_endorsements')
    .insert({
      workspace_id: workspaceId,
      member_skill_id: memberSkill.id,
      member_user_id: memberSkill.user_id,
      skill_id: memberSkill.skill_id,
      endorser_user_id: ctx.userId,
      source_type: sourceType,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeEndorsement({ id, workspaceId }) {
  const { error } = await db
    .from('skill_endorsements')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);
  if (error) throw error;
}

async function selectAll(table, workspaceId, orderColumn, ascending) {
  const { data, error } = await db
    .from(table)
    .select('*')
    .eq('workspace_id', workspaceId)
    .order(orderColumn, { ascending });
  if (error) throw error;
  return data || [];
}

async function findByNormalizedName(table, workspaceId, normalizedName) {
  const { data, error } = await db
    .from(table)
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('normalized_name', normalizedName)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
```

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS. The new module should compile.

- [ ] **Step 3: Commit**

```bash
git add src/lib/skill-map-api.js
git commit -m "feat: add skill map data API"
```

## Task 4: Data Loading Hook

**Files:**
- Create: `src/lib/useSkillMapData.js`

- [ ] **Step 1: Create hook**

Create `src/lib/useSkillMapData.js`:

```js
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getContext } from './context.js';
import { getActiveScope, useActiveScope, useDefaultScopeInitializer } from './sharing.js';
import { ensureSeedTaxonomy, loadSkillMapDataset } from './skill-map-api.js';
import { buildSkillMapIndex } from './skill-map-utils.js';

export function useSkillMapData() {
  useDefaultScopeInitializer();
  const activeScope = useActiveScope();
  const [ctx, setCtx] = useState(null);
  const [ctxError, setCtxError] = useState(null);
  const [dataset, setDataset] = useState(emptyDataset);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    try {
      setCtx(getContext());
      setCtxError(null);
    } catch (e) {
      setCtx(null);
      setCtxError(e);
    }
  }, []);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    if (!ctx || !activeScope.workspaceId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const scope = getActiveScope();
        await ensureSeedTaxonomy(scope.workspaceId);
        const next = await loadSkillMapDataset(scope.workspaceId);
        if (!cancelled) setDataset(next);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [ctx, activeScope.workspaceId, version]);

  const index = useMemo(() => buildSkillMapIndex(dataset), [dataset]);

  return {
    activeScope,
    ctx,
    ctxError,
    dataset,
    error,
    index,
    loading,
    refresh,
  };
}

const emptyDataset = {
  members: [],
  groups: [],
  skills: [],
  memberSkills: [],
  endorsements: [],
};
```

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/useSkillMapData.js
git commit -m "feat: add skill map data hook"
```

## Task 5: Shared UI Components

**Files:**
- Create: `src/components/SkillStatusBadge.jsx`
- Create: `src/components/SkillTypeahead.jsx`
- Create: `src/components/MemberDetailModal.jsx`

- [ ] **Step 1: Add status badge**

Create `src/components/SkillStatusBadge.jsx`:

```jsx
import React from 'react';

export default function SkillStatusBadge({ status }) {
  const usable = status === 'usable';
  return (
    <span className={`skill-status ${usable ? 'skill-status--usable' : 'skill-status--learning'}`}>
      <span className="skill-status__dot" />
      {usable ? 'Dùng được' : 'Đang học'}
    </span>
  );
}
```

- [ ] **Step 2: Add skill typeahead**

Create `src/components/SkillTypeahead.jsx`:

```jsx
import React, { useMemo, useState } from 'react';
import Select from './Select.jsx';
import { normalizeSkillName } from '../lib/skill-map-utils.js';

export default function SkillTypeahead({ groups, skills, disabled, onSubmit }) {
  const [groupId, setGroupId] = useState(groups[0]?.id || '');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('usable');

  const groupOptions = groups.map((group) => ({ value: group.id, label: group.name }));
  const statusOptions = [
    { value: 'usable', label: 'Dùng được' },
    { value: 'learning', label: 'Đang học' },
  ];

  const suggestions = useMemo(() => {
    const normalizedQuery = normalizeSkillName(name);
    if (!normalizedQuery) return [];
    return skills
      .filter((skill) => skill.group_id === groupId)
      .filter((skill) => skill.normalized_name.includes(normalizedQuery))
      .slice(0, 6);
  }, [groupId, name, skills]);

  const exactMatch = suggestions.find((skill) => skill.normalized_name === normalizeSkillName(name));

  async function submit(event) {
    event.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!groupId || !cleanName) return;
    await onSubmit({ groupId, name: cleanName, status });
    setName('');
    setStatus('usable');
  }

  return (
    <form className="skill-form" onSubmit={submit}>
      <div className="skill-form__grid">
        <div>
          <label className="mushy-label">Nhóm</label>
          <Select value={groupId} onChange={setGroupId} options={groupOptions} disabled={disabled} />
        </div>
        <div>
          <label className="mushy-label">Trạng thái</label>
          <Select value={status} onChange={setStatus} options={statusOptions} disabled={disabled} />
        </div>
      </div>

      <label className="mushy-label">Skill</label>
      <input
        className="mushy-input"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={disabled}
        placeholder="Nhập skill hoặc chọn gợi ý"
        autoComplete="off"
      />

      {suggestions.length > 0 && (
        <div className="skill-suggestions">
          {suggestions.map((skill) => (
            <button key={skill.id} type="button" onClick={() => setName(skill.name)} disabled={disabled}>
              {skill.name}
            </button>
          ))}
        </div>
      )}

      <button className="mushy-btn mushy-btn--primary mushy-btn--block" type="submit" disabled={disabled || !groupId || !name.trim()}>
        {exactMatch ? 'Thêm skill' : 'Tạo skill và thêm'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Add member detail modal**

Create `src/components/MemberDetailModal.jsx`:

```jsx
import React from 'react';
import SkillStatusBadge from './SkillStatusBadge.jsx';
import { displayNameForMember, groupMemberSkills } from '../lib/skill-map-utils.js';

export default function MemberDetailModal({
  currentUserId,
  isCurrentUserAdmin,
  member,
  memberSkills,
  onClose,
  onEndorse,
  onRemoveEndorsement,
}) {
  const grouped = groupMemberSkills(memberSkills);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card member-modal" onClick={(event) => event.stopPropagation()}>
        <div className="member-modal__header">
          <div className="avatar avatar--large">{initials(displayNameForMember(member))}</div>
          <div>
            <h3>{displayNameForMember(member)}</h3>
            <p>{member.role || 'member'}{member.work_phone ? ` · ${member.work_phone}` : ''}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Đóng">×</button>
        </div>

        {grouped.length === 0 ? (
          <p className="empty-copy">Chưa có skill nào được khai báo.</p>
        ) : grouped.map((group) => (
          <section key={group.group.id} className="detail-group">
            <h4>{group.group.name}</h4>
            {group.items.map((item) => {
              const ownEndorsement = item.endorsements.find((e) => e.endorser_user_id === currentUserId);
              const canEndorse = item.user_id !== currentUserId;
              return (
                <div className="detail-skill" key={item.id}>
                  <div>
                    <div className="detail-skill__name">{item.skill?.name || 'Unknown skill'}</div>
                    <div className="detail-skill__meta">
                      <SkillStatusBadge status={item.status} />
                      {item.endorsements.some((e) => e.source_type === 'admin') && <span>Đã được admin xác nhận</span>}
                    </div>
                  </div>
                  <div className="detail-skill__actions">
                    {canEndorse && ownEndorsement && (
                      <button className="mushy-btn mushy-btn--ghost" type="button" onClick={() => onRemoveEndorsement(ownEndorsement)}>
                        Bỏ endorse
                      </button>
                    )}
                    {canEndorse && !ownEndorsement && (
                      <button className="mushy-btn mushy-btn--primary" type="button" onClick={() => onEndorse(item)}>
                        Endorse
                      </button>
                    )}
                    {isCurrentUserAdmin && item.endorsements.filter((e) => e.endorser_user_id !== currentUserId).map((endorsement) => (
                      <button className="text-danger" key={endorsement.id} type="button" onClick={() => onRemoveEndorsement(endorsement)}>
                        Gỡ {endorsement.source_type}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SkillStatusBadge.jsx src/components/SkillTypeahead.jsx src/components/MemberDetailModal.jsx
git commit -m "feat: add skill map UI components"
```

## Task 6: Replace App With Team Skill Map Workflow

**Files:**
- Replace: `src/App.jsx`

- [ ] **Step 1: Replace app component**

Replace `src/App.jsx` with:

```jsx
import React, { useMemo, useState } from 'react';
import MemberDetailModal from './components/MemberDetailModal.jsx';
import ScopeSwitcher from './components/ScopeSwitcher.jsx';
import ShareManageModal from './components/ShareManageModal.jsx';
import SkillStatusBadge from './components/SkillStatusBadge.jsx';
import SkillTypeahead from './components/SkillTypeahead.jsx';
import { useDialog } from './components/Dialog.jsx';
import {
  deleteMemberSkill,
  endorseMemberSkill,
  findOrCreateSkill,
  removeEndorsement,
  saveMemberSkill,
  updateMemberSkillStatus,
} from './lib/skill-map-api.js';
import { useSkillMapData } from './lib/useSkillMapData.js';
import { buildSkillMapIndex, displayNameForMember, rankSkillMatches } from './lib/skill-map-utils.js';
import './App.css';

export default function App() {
  const dialog = useDialog();
  const { activeScope, ctx, ctxError, dataset, error, index, loading, refresh } = useSkillMapData();
  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState('all');
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isCurrentUserAdmin = ['owner', 'admin'].includes(ctx?.role);
  const mySkills = ctx ? index.memberSkillsByUser.get(ctx.userId) || [] : [];
  const selectedMember = dataset.members.find((member) => member.user_id === selectedMemberId);
  const selectedMemberSkills = selectedMemberId ? index.memberSkillsByUser.get(selectedMemberId) || [] : [];

  const visibleSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return dataset.skills
      .filter((skill) => groupId === 'all' || skill.group_id === groupId)
      .filter((skill) => !normalizedQuery || skill.name.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [dataset.skills, groupId, query]);

  const rankedResults = useMemo(() => {
    const targetSkill = visibleSkills[0];
    if (!targetSkill) return [];
    return rankSkillMatches({
      members: dataset.members,
      skills: dataset.skills,
      memberSkills: dataset.memberSkills,
      endorsements: dataset.endorsements,
      skillId: targetSkill.id,
    });
  }, [dataset, visibleSkills]);

  async function runMutation(action, errorTitle) {
    setSaving(true);
    try {
      await action();
      refresh();
    } catch (e) {
      await dialog.error(errorTitle, e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function addSkill({ groupId: selectedGroupId, name, status }) {
    await runMutation(async () => {
      const skill = await findOrCreateSkill({
        workspaceId: activeScope.workspaceId,
        groupId: selectedGroupId,
        name,
        createdBy: ctx.userId,
      });
      await saveMemberSkill({
        workspaceId: activeScope.workspaceId,
        userId: ctx.userId,
        skillId: skill.id,
        status,
      });
    }, 'Không thêm được skill');
  }

  async function changeStatus(row, status) {
    await runMutation(() => updateMemberSkillStatus({ id: row.id, workspaceId: activeScope.workspaceId, status }), 'Không cập nhật được skill');
  }

  async function deleteSkill(row) {
    const ok = await dialog.confirm('Xóa skill khỏi profile?', row.skill?.name || 'Skill này', {
      danger: true,
      confirmLabel: 'Xóa',
      cancelLabel: 'Huỷ',
    });
    if (!ok) return;
    await runMutation(() => deleteMemberSkill({ id: row.id, workspaceId: activeScope.workspaceId }), 'Không xóa được skill');
  }

  async function endorse(row) {
    await runMutation(() => endorseMemberSkill({
      workspaceId: activeScope.workspaceId,
      memberSkill: row,
      currentUserRole: ctx.role,
    }), 'Không endorse được skill');
  }

  async function removeEndorsementRow(row) {
    await runMutation(() => removeEndorsement({ id: row.id, workspaceId: activeScope.workspaceId }), 'Không gỡ được endorsement');
  }

  if (ctxError) {
    return <div className="mushy-page"><section className="mushy-card error-card">{ctxError.message}</section></div>;
  }

  return (
    <div className="mushy-page skill-map-page">
      <header className="app-header">
        <div>
          <p className="eyebrow">Team Skill Map</p>
          <h1>Ai mạnh mảng nào?</h1>
          <p>Tìm người support đúng kỹ năng trong workspace.</p>
        </div>
        <ScopeSwitcher onManageGrants={() => setShareOpen(true)} />
      </header>

      {error && <section className="mushy-card error-card">Không tải được dữ liệu: {error.message}</section>}

      <main className="main-grid">
        <section className="mushy-card explore-panel">
          <div className="section-head">
            <div>
              <h2>Explore</h2>
              <p>Tìm skill, xem ai phù hợp nhất.</p>
            </div>
            {loading && <span className="mushy-spinner" />}
          </div>

          <div className="filters">
            <input className="mushy-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skill..." />
            <div className="chip-row">
              <button className={groupId === 'all' ? 'chip chip--active' : 'chip'} type="button" onClick={() => setGroupId('all')}>Tất cả</button>
              {dataset.groups.map((group) => (
                <button key={group.id} className={groupId === group.id ? 'chip chip--active' : 'chip'} type="button" onClick={() => setGroupId(group.id)}>
                  {group.name}
                </button>
              ))}
            </div>
          </div>

          <SkillResults
            loading={loading}
            skills={visibleSkills}
            rankedResults={rankedResults}
            index={index}
            onOpenMember={setSelectedMemberId}
          />
        </section>

        <section className="mushy-card my-skills-panel">
          <div className="section-head">
            <div>
              <h2>My Skills</h2>
              <p>Cập nhật skill bạn có thể chia sẻ với team.</p>
            </div>
          </div>

          <SkillTypeahead groups={dataset.groups} skills={dataset.skills} disabled={saving || loading || !ctx} onSubmit={addSkill} />

          <div className="my-skill-list">
            {mySkills.length === 0 && <p className="empty-copy">Bạn chưa khai báo skill nào.</p>}
            {mySkills.map((row) => (
              <div className="my-skill-row" key={row.id}>
                <div>
                  <strong>{row.skill?.name}</strong>
                  <span>{row.skill?.group?.name || 'Khác'}</span>
                </div>
                <div className="row-actions">
                  <button type="button" className="ghost-link" onClick={() => changeStatus(row, row.status === 'usable' ? 'learning' : 'usable')}>
                    <SkillStatusBadge status={row.status} />
                  </button>
                  <button type="button" className="text-danger" onClick={() => deleteSkill(row)}>Xóa</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {selectedMember && (
        <MemberDetailModal
          currentUserId={ctx?.userId}
          isCurrentUserAdmin={isCurrentUserAdmin}
          member={selectedMember}
          memberSkills={selectedMemberSkills}
          onClose={() => setSelectedMemberId(null)}
          onEndorse={endorse}
          onRemoveEndorsement={removeEndorsementRow}
        />
      )}

      <ShareManageModal open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}

function SkillResults({ loading, skills, rankedResults, index, onOpenMember }) {
  if (loading) return <p className="empty-copy">Đang tải skill map...</p>;
  if (skills.length === 0) return <p className="empty-copy">Không tìm thấy skill phù hợp.</p>;

  const targetSkill = skills[0];
  if (rankedResults.length === 0) {
    return (
      <div className="result-empty">
        <h3>{targetSkill.name}</h3>
        <p>Chưa có ai khai báo skill này.</p>
      </div>
    );
  }

  return (
    <div className="results">
      <div className="target-skill">
        <span>Đang xem</span>
        <strong>{targetSkill.name}</strong>
      </div>
      {rankedResults.map((result) => {
        const related = index.memberSkillsByUser.get(result.member.user_id) || [];
        return (
          <button className="member-card" key={result.memberSkill.id} type="button" onClick={() => onOpenMember(result.member.user_id)}>
            <div className="avatar">{initials(displayNameForMember(result.member))}</div>
            <div className="member-card__body">
              <div className="member-card__top">
                <strong>{displayNameForMember(result.member)}</strong>
                <SkillStatusBadge status={result.memberSkill.status} />
              </div>
              <p>{result.member.role || 'member'}{result.member.work_phone ? ` · ${result.member.work_phone}` : ''}</p>
              <div className="related-skills">
                {related.slice(0, 3).map((row) => <span key={row.id}>{row.skill?.name}</span>)}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}
```

- [ ] **Step 2: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: build team skill map workflow"
```

## Task 7: App Styling

**Files:**
- Replace: `src/App.css`

- [ ] **Step 1: Replace app CSS**

Replace `src/App.css` with:

```css
.skill-map-page {
  max-width: 960px;
}

.app-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 0 18px;
}

.app-header h1,
.section-head h2 {
  margin: 0;
  color: var(--ink);
  letter-spacing: 0;
}

.app-header h1 {
  font-size: 26px;
  line-height: 1.15;
}

.app-header p,
.section-head p,
.empty-copy {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--brand);
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.7fr);
  gap: 14px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.filters {
  display: grid;
  gap: 10px;
}

.chip-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.chip {
  border: 1px solid var(--hairline);
  background: var(--surface);
  color: var(--ink);
  border-radius: 999px;
  padding: 8px 12px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.chip--active {
  background: var(--ink);
  color: #fff;
}

.target-skill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 16px 0 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--surface-muted);
}

.target-skill span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.results,
.my-skill-list {
  display: grid;
  gap: 10px;
}

.member-card,
.my-skill-row,
.detail-skill {
  border: 1px solid var(--hairline);
  background: var(--surface);
  border-radius: 14px;
}

.member-card {
  width: 100%;
  display: flex;
  gap: 12px;
  padding: 12px;
  text-align: left;
  cursor: pointer;
}

.member-card__body {
  min-width: 0;
  flex: 1;
}

.member-card__top,
.my-skill-row,
.detail-skill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.member-card p,
.my-skill-row span {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: var(--ink);
  color: #fff;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 800;
}

.avatar--large {
  width: 54px;
  height: 54px;
  font-size: 15px;
}

.related-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.related-skills span {
  background: var(--surface-muted);
  border-radius: 999px;
  color: var(--muted);
  font-size: 11px;
  padding: 3px 8px;
}

.skill-form {
  display: grid;
  gap: 10px;
}

.skill-form__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.skill-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.skill-suggestions button,
.ghost-link,
.text-danger,
.icon-button {
  appearance: none;
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.skill-suggestions button {
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--ink);
  font-size: 12px;
  font-weight: 700;
  padding: 6px 10px;
}

.my-skill-list {
  margin-top: 16px;
}

.my-skill-row,
.detail-skill {
  padding: 12px;
}

.row-actions,
.detail-skill__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.skill-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  padding: 4px 8px;
  white-space: nowrap;
}

.skill-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
}

.skill-status--usable {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.skill-status--usable .skill-status__dot {
  background: #10b981;
}

.skill-status--learning {
  background: rgba(245, 158, 11, 0.14);
  color: #92400e;
}

.skill-status--learning .skill-status__dot {
  background: #f59e0b;
}

.member-modal {
  max-width: 620px;
}

.member-modal__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.member-modal__header h3 {
  margin: 0;
  color: var(--ink);
  font-size: 19px;
}

.member-modal__header p {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.icon-button {
  margin-left: auto;
  color: var(--muted);
  font-size: 24px;
}

.detail-group + .detail-group {
  margin-top: 18px;
}

.detail-group h4 {
  margin: 0 0 8px;
  color: var(--ink);
  font-size: 13px;
  text-transform: uppercase;
}

.detail-skill + .detail-skill {
  margin-top: 8px;
}

.detail-skill__name {
  font-weight: 800;
  color: var(--ink);
}

.detail-skill__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  color: var(--muted);
  font-size: 12px;
}

.text-danger {
  color: var(--danger);
  font-size: 12px;
  font-weight: 800;
}

.error-card {
  color: var(--danger);
}

.result-empty {
  margin-top: 16px;
  padding: 18px;
  border-radius: 14px;
  background: var(--surface-muted);
  text-align: center;
}

.result-empty h3 {
  margin: 0;
}

.result-empty p {
  margin: 4px 0 0;
  color: var(--muted);
}

@media (max-width: 760px) {
  .app-header {
    flex-direction: column;
  }

  .main-grid {
    grid-template-columns: 1fr;
  }

  .skill-form__grid {
    grid-template-columns: 1fr;
  }

  .member-card__top,
  .my-skill-row,
  .detail-skill {
    align-items: flex-start;
    flex-direction: column;
  }

  .row-actions,
  .detail-skill__actions {
    justify-content: flex-start;
  }
}
```

- [ ] **Step 2: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: both PASS and no CSS syntax errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "style: add skill map interface"
```

## Task 8: Final Runtime Verification

**Files:**
- Modify if needed based on verification findings.

- [ ] **Step 1: Run full static verification**

Run:

```bash
npm test
npm run build
```

Expected: PASS for tests and production build.

- [ ] **Step 2: Start the dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 3: Browser smoke**

Open the local URL and verify:

- Header renders `Team Skill Map`.
- Explore shows seeded skill groups after data loads.
- My Skills form renders group selector, status selector, and skill input.
- Search does not overlap or resize the layout on mobile width.
- Member Detail opens when a result exists.

If database migrations have not been applied to the dev Supabase schema yet, record that runtime data smoke is blocked by missing tables and still verify that the app renders a clear load error.

- [ ] **Step 4: Commit verification fixes**

If fixes were needed:

```bash
git add src/App.jsx src/App.css src/components src/lib
git commit -m "fix: polish skill map verification issues"
```

If no fixes were needed, do not create an empty commit.

## Meta-Harness Execution Notes

Use this plan as the execution source. Harness target:

- target: 7
- target_min: 6
- max_iter: 3
- intent: DELIVER

Rubric criteria:

- Correctness: data model, RLS intent, app actions, and helper ranking match the approved spec.
- Completeness: Explore, My Skills, Member Detail, seed taxonomy, and endorsement flows are present.
- Edge cases: empty states, missing profile fields, duplicate skill names, self-endorsement prevention, mutation errors.
- Craft: mobile-first UI, restrained dashboard layout, no visible endorsement leaderboard.
- Verification: tests/build pass and browser smoke is documented.
