-- Keep the app schema compatible with Mushy environments that require
-- skills.normalized_name for inserts/upserts.

alter table app_skill_map.skills
  add column if not exists normalized_name text;

update app_skill_map.skills
set normalized_name = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g'))
where normalized_name is null or normalized_name = '';

alter table app_skill_map.skills
  alter column normalized_name set default '';

alter table app_skill_map.skills
  alter column normalized_name set not null;
