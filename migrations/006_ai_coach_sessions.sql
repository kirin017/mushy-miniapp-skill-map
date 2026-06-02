-- Adds personal AI Coach session history for Skill Map.
-- The Admin Portal owns schema creation/exposure; this migration creates app data only.

-- @realtime
create table if not exists app_skill_map.ai_coach_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_text text not null check (char_length(goal_text) between 1 and 240),
  summary text not null check (char_length(summary) between 1 and 240),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_coach_sessions_workspace_user_created
  on app_skill_map.ai_coach_sessions (workspace_id, user_id, created_at desc);

grant select, insert on app_skill_map.ai_coach_sessions to authenticated;

alter table app_skill_map.ai_coach_sessions enable row level security;

drop policy if exists "ai_coach_sessions_select" on app_skill_map.ai_coach_sessions;
drop policy if exists "ai_coach_sessions_insert" on app_skill_map.ai_coach_sessions;

create policy "ai_coach_sessions_select" on app_skill_map.ai_coach_sessions
for select using (
  public.can_access_app_data(workspace_id, 'skill-map')
  and user_id = auth.uid()
);

create policy "ai_coach_sessions_insert" on app_skill_map.ai_coach_sessions
for insert with check (
  public.can_access_app_data(workspace_id, 'skill-map')
  and user_id = auth.uid()
);
