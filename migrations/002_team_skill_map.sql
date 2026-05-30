-- Team Skill Map MVP tables.
-- Submit this SQL through the Mushy Admin Portal Migration Reviewer.
-- Only reference app_skill_map here; the Reviewer duplicates it for dev automatically.

create table if not exists app_skill_map.skills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  name text not null check (char_length(name) between 1 and 80),
  category text not null default 'Custom' check (char_length(category) between 1 and 40),
  is_preset boolean not null default false,
  catalog_key text,
  status text not null default 'approved' check (status in ('approved', 'pending', 'rejected', 'merged')),
  skill_type text not null default 'tool' check (skill_type in ('capability', 'tool')),
  aliases jsonb not null default '[]'::jsonb,
  description text not null default '' check (char_length(description) <= 500),
  source text not null default 'legacy' check (source in ('catalog', 'proposal', 'legacy')),
  canonical_skill_id uuid,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text not null default '' check (char_length(review_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skills_workspace_name_unique unique (workspace_id, name)
);

create table if not exists app_skill_map.member_skills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null,
  level integer not null default 0 check (level between 0 and 4),
  interest integer not null default 0 check (interest between 0 and 3),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_skills_user_skill_unique unique (workspace_id, user_id, skill_id)
);

alter table app_skill_map.skills
  add column if not exists category text not null default 'Custom' check (char_length(category) between 1 and 40);

alter table app_skill_map.skills
  add column if not exists is_preset boolean not null default false;

alter table app_skill_map.skills
  add column if not exists catalog_key text;

alter table app_skill_map.skills
  add column if not exists status text not null default 'approved' check (status in ('approved', 'pending', 'rejected', 'merged'));

alter table app_skill_map.skills
  add column if not exists skill_type text not null default 'tool' check (skill_type in ('capability', 'tool'));

alter table app_skill_map.skills
  add column if not exists aliases jsonb not null default '[]'::jsonb;

alter table app_skill_map.skills
  add column if not exists description text not null default '' check (char_length(description) <= 500);

alter table app_skill_map.skills
  add column if not exists source text not null default 'legacy' check (source in ('catalog', 'proposal', 'legacy'));

alter table app_skill_map.skills
  add column if not exists canonical_skill_id uuid;

alter table app_skill_map.skills
  add column if not exists reviewed_by uuid references auth.users(id);

alter table app_skill_map.skills
  add column if not exists reviewed_at timestamptz;

alter table app_skill_map.skills
  add column if not exists review_note text not null default '' check (char_length(review_note) <= 500);

alter table app_skill_map.skills
  add column if not exists updated_at timestamptz not null default now();

alter table app_skill_map.member_skills
  add column if not exists level integer not null default 0 check (level between 0 and 4);

alter table app_skill_map.member_skills
  add column if not exists interest integer not null default 0 check (interest between 0 and 3);

alter table app_skill_map.member_skills
  add column if not exists note text not null default '' check (char_length(note) <= 500);

alter table app_skill_map.member_skills
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_skills_workspace on app_skill_map.skills (workspace_id);
create index if not exists idx_skills_workspace_category on app_skill_map.skills (workspace_id, category);
create index if not exists idx_skills_workspace_status on app_skill_map.skills (workspace_id, status);
create unique index if not exists idx_skills_workspace_catalog_key on app_skill_map.skills (workspace_id, catalog_key) where catalog_key is not null;
create unique index if not exists idx_skills_workspace_id_unique on app_skill_map.skills (workspace_id, id);
create index if not exists idx_skills_workspace_canonical on app_skill_map.skills (workspace_id, canonical_skill_id) where canonical_skill_id is not null;
create unique index if not exists idx_skills_workspace_name_unique on app_skill_map.skills (workspace_id, name);
create index if not exists idx_member_skills_workspace on app_skill_map.member_skills (workspace_id);
create index if not exists idx_member_skills_workspace_user on app_skill_map.member_skills (workspace_id, user_id);
create index if not exists idx_member_skills_workspace_skill on app_skill_map.member_skills (workspace_id, skill_id);
create index if not exists idx_member_skills_workspace_level on app_skill_map.member_skills (workspace_id, level desc);
create unique index if not exists idx_member_skills_user_skill_unique on app_skill_map.member_skills (workspace_id, user_id, skill_id);

alter table app_skill_map.member_skills
  drop constraint if exists member_skills_skill_id_fkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'member_skills_skill_same_workspace_fk'
      and conrelid = 'app_skill_map.member_skills'::regclass
  ) then
    alter table app_skill_map.member_skills
      add constraint member_skills_skill_same_workspace_fk
      foreign key (workspace_id, skill_id)
      references app_skill_map.skills(workspace_id, id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'skills_canonical_same_workspace_fk'
      and conrelid = 'app_skill_map.skills'::regclass
  ) then
    alter table app_skill_map.skills
      add constraint skills_canonical_same_workspace_fk
      foreign key (workspace_id, canonical_skill_id)
      references app_skill_map.skills(workspace_id, id)
      on delete set null (canonical_skill_id);
  end if;
end $$;

grant select, insert, update, delete on app_skill_map.skills to authenticated;
grant select, insert, update, delete on app_skill_map.member_skills to authenticated;

alter table app_skill_map.skills enable row level security;
alter table app_skill_map.member_skills enable row level security;

drop policy if exists "skills_select" on app_skill_map.skills;
create policy "skills_select" on app_skill_map.skills
for select using (
  public.can_access_app_data(workspace_id, 'skill-map')
);

drop policy if exists "skills_insert" on app_skill_map.skills;
create policy "skills_insert" on app_skill_map.skills
for insert with check (
  created_by = auth.uid()
  and (
    public.is_owner_workspace_member(workspace_id)
    or (
      public.can_access_app_data(workspace_id, 'skill-map')
      and source = 'proposal'
      and status = 'pending'
      and is_preset = false
      and catalog_key is null
      and canonical_skill_id is null
      and reviewed_by is null
      and reviewed_at is null
      and review_note = ''
    )
  )
);

drop policy if exists "skills_update" on app_skill_map.skills;
create policy "skills_update" on app_skill_map.skills
for update using (
  public.is_owner_workspace_member(workspace_id)
) with check (
  public.is_owner_workspace_member(workspace_id)
);

drop policy if exists "skills_delete" on app_skill_map.skills;
create policy "skills_delete" on app_skill_map.skills
for delete using (
  public.is_owner_workspace_member(workspace_id)
);

drop policy if exists "member_skills_select" on app_skill_map.member_skills;
create policy "member_skills_select" on app_skill_map.member_skills
for select using (
  public.can_access_app_data(workspace_id, 'skill-map')
);

drop policy if exists "member_skills_insert" on app_skill_map.member_skills;
create policy "member_skills_insert" on app_skill_map.member_skills
for insert with check (
  public.can_access_app_data(workspace_id, 'skill-map')
  and user_id = auth.uid()
  and created_by = auth.uid()
);

drop policy if exists "member_skills_update" on app_skill_map.member_skills;
create policy "member_skills_update" on app_skill_map.member_skills
for update using (
  public.can_access_app_data(workspace_id, 'skill-map')
  and (
    (user_id = auth.uid() and created_by = auth.uid())
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = member_skills.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
) with check (
  public.can_access_app_data(workspace_id, 'skill-map')
  and (
    (user_id = auth.uid() and created_by = auth.uid())
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = member_skills.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
);

drop policy if exists "member_skills_delete" on app_skill_map.member_skills;
create policy "member_skills_delete" on app_skill_map.member_skills
for delete using (
  public.is_owner_workspace_member(workspace_id)
);

create or replace function app_skill_map.set_updated_at() returns trigger
language plpgsql
as '
begin
  new.updated_at = now();
  return new;
end;
';

drop trigger if exists trg_skills_updated_at on app_skill_map.skills;
create trigger trg_skills_updated_at
  before update on app_skill_map.skills
  for each row execute function app_skill_map.set_updated_at();

drop trigger if exists trg_member_skills_updated_at on app_skill_map.member_skills;
create trigger trg_member_skills_updated_at
  before update on app_skill_map.member_skills
  for each row execute function app_skill_map.set_updated_at();
