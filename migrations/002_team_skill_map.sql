-- Team Skill Map MVP tables.
-- Submit this migration through Mushy Admin Portal Reviewer.
-- Reference only the production schema name; reviewer rewrites schema for dev.

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
