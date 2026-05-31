-- Fix catalog sync upsert conflict target.
-- 002 originally created a partial unique index on (workspace_id, catalog_key).
-- PostgREST upsert emits ON CONFLICT(workspace_id, catalog_key), which requires a
-- matching non-partial unique index/constraint.

drop index if exists app_skill_map.idx_skills_workspace_catalog_key;

create unique index if not exists idx_skills_workspace_catalog_key
  on app_skill_map.skills (workspace_id, catalog_key);
