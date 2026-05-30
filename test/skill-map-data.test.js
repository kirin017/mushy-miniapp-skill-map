import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PRESET_SKILLS,
  buildCatalogSkillRows,
  buildCustomSkillUpsert,
  buildProfileSummary,
  buildMemberSkillUpsert,
  buildPresetSkillRows,
  composeSkillMapView,
  loadSkillMapData,
  saveProfileSkill,
} from '../src/lib/app/skill-map-data.js';

test('preset skills are derived from the approved standard catalog with visual assets where known', () => {
  assert.equal(PRESET_SKILLS.length >= 50, true);
  assert.equal(PRESET_SKILLS.some((skill) => skill.id === 'frontend.react' && skill.name === 'React'), true);

  const knownVisualSkills = PRESET_SKILLS.filter((skill) => ['frontend.react', 'devops.docker', 'data.postgresql', 'design.figma'].includes(skill.id));
  assert.equal(knownVisualSkills.every((skill) => skill.iconUrl?.startsWith('https://cdn.simpleicons.org/')), true);
  assert.equal(PRESET_SKILLS.every((skill) => skill.iconAlt === `${skill.name} icon`), true);
});

test('buildCatalogSkillRows creates approved catalog rows for the active workspace', () => {
  const rows = buildCatalogSkillRows({ workspaceId: 'ws-1', userId: 'user-1' });
  const react = rows.find((row) => row.catalog_key === 'frontend.react');

  assert.equal(rows.length >= 50, true);
  assert.deepEqual(react, {
    workspace_id: 'ws-1',
    created_by: 'user-1',
    catalog_key: 'frontend.react',
    status: 'approved',
    skill_type: 'tool',
    aliases: ['React UI', 'React Components'],
    description: '',
    source: 'catalog',
    canonical_skill_id: null,
    review_note: '',
    name: 'React',
    category: 'Frontend',
    is_preset: true,
  });
  assert.equal(rows.every((row) => row.workspace_id === 'ws-1'), true);
  assert.equal(rows.every((row) => row.created_by === 'user-1'), true);
  assert.equal(rows.every((row) => row.status === 'approved'), true);
  assert.equal(rows.every((row) => row.source === 'catalog'), true);
  assert.equal(rows.every((row) => row.is_preset === true), true);
});

test('buildPresetSkillRows remains a compatibility wrapper for catalog rows', () => {
  assert.deepEqual(
    buildPresetSkillRows({ workspaceId: 'ws-1', userId: 'user-1' }),
    buildCatalogSkillRows({ workspaceId: 'ws-1', userId: 'user-1' }),
  );
});

test('composeSkillMapView derives heatmap members, skills, and current user profile from persisted rows', () => {
  const view = composeSkillMapView({
    currentUserId: 'u-me',
    skills: [
      { id: 'skill-react', name: 'React', category: 'Frontend', is_preset: true },
      { id: 'skill-docker', name: 'Docker', category: 'DevOps', is_preset: true },
      { id: 'skill-security', name: 'Security', category: 'Security', is_preset: true },
    ],
    memberSkills: [
      { user_id: 'u-me', skill_id: 'skill-react', level: 3, interest: 3, note: 'Components' },
      { user_id: 'u-me', skill_id: 'skill-docker', level: 2, interest: 2, note: 'Compose' },
      { user_id: 'u-2', skill_id: 'skill-react', level: 4, interest: 2, note: '' },
    ],
    members: [
      { user_id: 'u-me', full_name: 'Nguyen Ha My', avatar_url: null },
      { user_id: 'u-2', full_name: 'Dau Van Nam', avatar_url: 'https://example.test/nam.png' },
    ],
  });

  assert.equal(view.skills.find((skill) => skill.name === 'React').total, 2);
  assert.match(view.skills.find((skill) => skill.name === 'React').iconUrl, /^https:\/\/cdn\.simpleicons\.org\/react/);
  assert.equal(view.skills.find((skill) => skill.name === 'Docker').iconAlt, 'Docker icon');
  assert.equal(view.skills.find((skill) => skill.name === 'Security').risk, 1);
  assert.equal(view.members[0].name, 'Nguyen Ha My');
  assert.equal(view.members[0].skills.react, 3);
  assert.equal(view.members[1].avatarUrl, 'https://example.test/nam.png');
  assert.deepEqual(view.profileSkills, [
    {
      id: 'react',
      rowId: undefined,
      skillId: 'skill-react',
      level: 3,
      interest: 3,
      note: 'Components',
      status: 'approved',
      name: 'React',
      category: 'Frontend',
    },
    {
      id: 'docker',
      rowId: undefined,
      skillId: 'skill-docker',
      level: 2,
      interest: 2,
      note: 'Compose',
      status: 'approved',
      name: 'Docker',
      category: 'DevOps',
    },
  ]);
});

test('composeSkillMapView excludes non-approved skills and preserves current user pending profile skills', () => {
  const view = composeSkillMapView({
    currentUserId: 'u-me',
    skills: [
      { id: 'skill-react', name: 'React', category: 'Frontend', is_preset: true, status: 'approved' },
      { id: 'skill-rust', name: 'Rust', category: 'Backend', is_preset: false, status: 'pending' },
      { id: 'skill-flash', name: 'Flash', category: 'Frontend', is_preset: false, status: 'rejected' },
      { id: 'skill-js-old', name: 'JavaScript Old', category: 'Frontend', is_preset: false, status: 'merged' },
    ],
    memberSkills: [
      { user_id: 'u-me', skill_id: 'skill-react', level: 3, interest: 2, note: 'Components' },
      { id: 'pending-row', user_id: 'u-me', skill_id: 'skill-rust', level: 2, interest: 3, note: 'Want systems' },
      { user_id: 'u-2', skill_id: 'skill-flash', level: 4, interest: 1, note: 'Legacy' },
      { user_id: 'u-2', skill_id: 'skill-js-old', level: 4, interest: 1, note: 'Merged away' },
    ],
    members: [
      { user_id: 'u-me', full_name: 'Nguyen Ha My' },
      { user_id: 'u-2', full_name: 'Dau Van Nam' },
    ],
  });

  assert.deepEqual(view.skills.map((skill) => skill.name), ['React']);
  assert.equal(view.members[0].skills.react, 3);
  assert.equal(view.members[0].skills.rust, undefined);
  assert.deepEqual(view.members[0].pendingSkills, [
    {
      id: 'rust',
      rowId: 'pending-row',
      skillId: 'skill-rust',
      name: 'Rust',
      category: 'Backend',
      status: 'pending',
      level: 2,
      interest: 3,
      note: 'Want systems',
    },
  ]);
  assert.deepEqual(view.members[1].pendingSkills, []);
  assert.deepEqual(view.profileSkills, [
    {
      id: 'react',
      rowId: undefined,
      skillId: 'skill-react',
      level: 3,
      interest: 2,
      note: 'Components',
      status: 'approved',
      name: 'React',
      category: 'Frontend',
    },
    {
      id: 'rust',
      rowId: 'pending-row',
      skillId: 'skill-rust',
      level: 2,
      interest: 3,
      note: 'Want systems',
      status: 'pending',
      name: 'Rust',
      category: 'Backend',
    },
  ]);
});

test('buildMemberSkillUpsert writes the selected scope and current user', () => {
  assert.deepEqual(
    buildMemberSkillUpsert({
      workspaceId: 'ws-active',
      userId: 'u-me',
      skillId: 'skill-react',
      level: 4,
      interest: 3,
      note: 'Mentoring',
    }),
    {
      workspace_id: 'ws-active',
      created_by: 'u-me',
      user_id: 'u-me',
      skill_id: 'skill-react',
      level: 4,
      interest: 3,
      note: 'Mentoring',
    },
  );
});

test('buildCustomSkillUpsert creates a pending proposal skill row', () => {
  assert.deepEqual(
    buildCustomSkillUpsert({
      workspaceId: 'ws-active',
      userId: 'u-me',
      name: '  Kafka Streams  ',
      category: '  Backend  ',
      note: ` ${'Production stream processing '.repeat(30)} `,
    }),
    {
      workspace_id: 'ws-active',
      created_by: 'u-me',
      name: 'Kafka Streams',
      category: 'Backend',
      status: 'pending',
      source: 'proposal',
      is_preset: false,
      catalog_key: null,
      skill_type: 'tool',
      aliases: [],
      canonical_skill_id: null,
      review_note: '',
      description: `${'Production stream processing '.repeat(30)}`.slice(0, 500),
    },
  );
});

test('saveProfileSkill creates a custom skill before attaching it to the current profile', async () => {
  const calls = [];
  const db = {
    from(table) {
      return {
        select(columns) {
          calls.push({ table, op: 'select', columns });
          return {
            eq(column, value) {
              calls.push({ table, op: 'eq', column, value });
              return this;
            },
            maybeSingle() {
              calls.push({ table, op: 'maybeSingle' });
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
        insert(row) {
          calls.push({ table, op: 'insert', row });
          return {
            select(columns) {
              calls.push({ table, op: 'insertSelect', columns });
              return {
                single() {
                  return Promise.resolve({ data: { id: 'skill-kafka', name: row.name }, error: null });
                },
              };
            },
          };
        },
        upsert(row, options) {
          calls.push({ table, op: 'upsert', row, options });
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({ data: { id: 'member-skill-1', ...row }, error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  const saved = await saveProfileSkill({
    db,
    workspaceId: 'ws-active',
    userId: 'u-me',
    skillName: 'Kafka Streams',
    category: 'Backend',
    level: 2,
    interest: 3,
    note: 'Want production tasks',
  });

  assert.equal(saved.skill_id, 'skill-kafka');
  assert.equal(calls.some((call) => call.table === 'skills' && call.op === 'upsert'), false);
  const skillInsert = calls.find((call) => call.table === 'skills' && call.op === 'insert');
  assert.equal(skillInsert.row.is_preset, false);
  assert.equal(skillInsert.row.status, 'pending');
  assert.equal(skillInsert.row.source, 'proposal');
  assert.equal(skillInsert.row.description, 'Want production tasks');
  assert.equal(calls.find((call) => call.table === 'member_skills' && call.op === 'upsert').row.skill_id, 'skill-kafka');
});

test('saveProfileSkill reuses an existing pending custom skill proposal', async () => {
  const calls = [];
  const db = makeSaveProfileSkillDb({
    calls,
    existingSkill: {
      id: 'skill-kafka-pending',
      name: 'Kafka Streams',
      category: 'Backend',
      status: 'pending',
      canonical_skill_id: null,
    },
  });

  const saved = await saveProfileSkill({
    db,
    workspaceId: 'ws-active',
    userId: 'u-me',
    skillName: 'Kafka Streams',
    category: 'Backend',
    level: 2,
    interest: 3,
    note: 'Want production tasks',
  });

  assert.equal(saved.skill_id, 'skill-kafka-pending');
  assert.equal(calls.some((call) => call.table === 'skills' && call.op === 'insert'), false);
  assert.equal(calls.some((call) => call.table === 'skills' && call.op === 'upsert'), false);
});

test('saveProfileSkill attaches approved duplicate names to the canonical approved skill', async () => {
  const calls = [];
  const db = makeSaveProfileSkillDb({
    calls,
    existingSkill: {
      id: 'skill-kafka-approved',
      name: 'Kafka Streams',
      category: 'Backend',
      status: 'approved',
      canonical_skill_id: null,
    },
  });

  const saved = await saveProfileSkill({
    db,
    workspaceId: 'ws-active',
    userId: 'u-me',
    skillName: 'Kafka Streams',
    category: 'Backend',
    level: 4,
    interest: 2,
    note: 'Production owner',
  });

  assert.equal(saved.skill_id, 'skill-kafka-approved');
  assert.equal(calls.some((call) => call.table === 'skills' && call.op === 'insert'), false);
  assert.equal(calls.some((call) => call.table === 'skills' && call.op === 'upsert'), false);
});

function makeSaveProfileSkillDb({ calls, existingSkill }) {
  return {
    from(table) {
      return {
        select(columns) {
          calls.push({ table, op: 'select', columns });
          return {
            eq(column, value) {
              calls.push({ table, op: 'eq', column, value });
              return this;
            },
            maybeSingle() {
              calls.push({ table, op: 'maybeSingle' });
              return Promise.resolve({ data: existingSkill, error: null });
            },
          };
        },
        insert(row) {
          calls.push({ table, op: 'insert', row });
          return {
            select(columns) {
              calls.push({ table, op: 'insertSelect', columns });
              return {
                single() {
                  return Promise.resolve({ data: { id: 'skill-new', ...row }, error: null });
                },
              };
            },
          };
        },
        upsert(row, options) {
          calls.push({ table, op: 'upsert', row, options });
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({ data: { id: 'member-skill-1', ...row }, error: null });
                },
              };
            },
          };
        },
      };
    },
  };
}

test('loadSkillMapData syncs catalog rows and continues when catalog sync is blocked by RLS', async () => {
  const upserts = [];
  const selects = [];
  const db = {
    from(table) {
      return {
        upsert(rows, options) {
          upserts.push({ table, rows, options });
          return Promise.resolve({ data: null, error: { message: 'new row violates row-level security policy' } });
        },
        select(columns) {
          selects.push({ table, columns });
          const query = {
            eq() {
              return query;
            },
            in() {
              return Promise.resolve({ data: [], error: null });
            },
            then(resolve) {
              if (table === 'skills') {
                return Promise.resolve({
                  data: [{ id: 'skill-react', name: 'React', category: 'Frontend', is_preset: true, status: 'approved' }],
                  error: null,
                }).then(resolve);
              }
              return Promise.resolve({ data: [], error: null }).then(resolve);
            },
          };
          return query;
        },
      };
    },
  };

  const view = await loadSkillMapData({
    db,
    listMembers: async () => [{ user_id: 'u-me', full_name: 'Nguyen Ha My' }],
    workspaceId: 'ws-active',
    userId: 'u-me',
  });

  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].table, 'skills');
  assert.equal(upserts[0].options.onConflict, 'workspace_id,catalog_key');
  assert.equal(upserts[0].options.ignoreDuplicates, true);
  assert.equal(upserts[0].rows.length >= 50, true);
  assert.match(selects.find((select) => select.table === 'skills').columns, /catalog_key/);
  assert.deepEqual(view.skills.map((skill) => skill.name), ['React']);
});

test('loadSkillMapData throws non-permission catalog sync errors', async () => {
  const db = {
    from(table) {
      return {
        upsert() {
          return Promise.resolve({ data: null, error: { message: 'database is unavailable', code: 'XX000' } });
        },
        select() {
          throw new Error(`unexpected select for ${table}`);
        },
      };
    },
  };

  await assert.rejects(
    loadSkillMapData({
      db,
      listMembers: async () => [],
      workspaceId: 'ws-active',
      userId: 'u-me',
    }),
    /sync catalog skills: database is unavailable/,
  );
});

test('buildProfileSummary uses the current Mushy member instead of fallback mock identity', () => {
  const summary = buildProfileSummary({
    currentMember: {
      userId: 'u-real',
      name: 'Tran Minh Duc',
      handle: '@duc',
      avatar: 'TD',
      avatarUrl: 'https://example.test/duc.png',
    },
    profileSkills: [
      { id: 'react', level: 3 },
      { id: 'docker', level: 1 },
    ],
    skills: [
      { id: 'react', name: 'React' },
      { id: 'docker', name: 'Docker' },
    ],
  });

  assert.deepEqual(summary, {
    name: 'Tran Minh Duc',
    handle: '@duc',
    avatar: 'TD',
    avatarUrl: 'https://example.test/duc.png',
    skillCount: 2,
    learningCount: 1,
    featuredSkills: ['React', 'Docker'],
  });
});

test('skill map migration includes catalog review metadata', () => {
  const sql = readFileSync(new URL('../migrations/002_team_skill_map.sql', import.meta.url), 'utf8');
  const skillsInsertPolicy = sql.match(/create policy "skills_insert"[\s\S]*?drop policy if exists "skills_update"/)?.[0] ?? '';
  const skillsUpdatePolicy = sql.match(/create policy "skills_update"[\s\S]*?drop policy if exists "skills_delete"/)?.[0] ?? '';
  const memberSkillsInsertPolicy = sql.match(/create policy "member_skills_insert"[\s\S]*?drop policy if exists "member_skills_update"/)?.[0] ?? '';
  const memberSkillsUpdatePolicy = sql.match(/create policy "member_skills_update"[\s\S]*?drop policy if exists "member_skills_delete"/)?.[0] ?? '';

  assert.match(sql, /catalog_key text/);
  assert.match(sql, /status text not null default 'approved'/);
  assert.match(sql, /skill_type text not null default 'tool'/);
  assert.match(sql, /description text not null default ''/);
  assert.match(sql, /source text not null default 'legacy'/);
  assert.match(sql, /reviewed_at timestamptz/);
  assert.match(sql, /review_note text not null default ''/);
  assert.match(sql, /aliases jsonb not null default '\[\]'::jsonb/);
  assert.match(sql, /canonical_skill_id uuid/);
  assert.match(sql, /reviewed_by uuid references auth\.users\(id\)/);
  assert.match(sql, /idx_skills_workspace_status/);
  assert.match(sql, /create unique index if not exists idx_skills_workspace_catalog_key/);
  assert.match(sql, /idx_skills_workspace_id_unique/);
  assert.match(sql, /idx_skills_workspace_name_unique/);
  assert.match(sql, /idx_member_skills_user_skill_unique/);
  assert.match(sql, /skills_canonical_same_workspace_fk/);
  assert.match(sql, /foreign key \(workspace_id, canonical_skill_id\)/);
  assert.match(sql, /references app_skill_map\.skills\(workspace_id, id\)/);
  assert.match(sql, /on delete set null \(canonical_skill_id\)/);
  assert.match(sql, /drop constraint if exists member_skills_skill_id_fkey/);
  assert.match(sql, /member_skills_skill_same_workspace_fk/);
  assert.match(sql, /foreign key \(workspace_id, skill_id\)/);
  assert.match(sql, /references app_skill_map\.skills\(workspace_id, id\)/);
  assert.doesNotMatch(sql, /skill_id uuid not null references app_skill_map\.skills\(id\) on delete cascade/);
  assert.match(skillsInsertPolicy, /from public\.workspace_members wm/);
  assert.match(skillsInsertPolicy, /wm\.workspace_id = skills\.workspace_id/);
  assert.match(skillsInsertPolicy, /wm\.user_id = auth\.uid\(\)/);
  assert.match(skillsInsertPolicy, /wm\.role in \('owner', 'admin'\)/);
  assert.doesNotMatch(skillsInsertPolicy, /public\.is_owner_workspace_member\(workspace_id\)/);
  assert.match(skillsInsertPolicy, /public\.can_access_app_data\(workspace_id, 'skill-map'\)/);
  assert.match(skillsInsertPolicy, /source = 'proposal'/);
  assert.match(skillsInsertPolicy, /for insert with check \(\s*created_by = auth\.uid\(\)\s+and\s+\(/);
  assert.match(skillsInsertPolicy, /status = 'pending'/);
  assert.match(skillsInsertPolicy, /is_preset = false/);
  assert.match(skillsInsertPolicy, /catalog_key is null/);
  assert.match(skillsInsertPolicy, /canonical_skill_id is null/);
  assert.match(skillsInsertPolicy, /reviewed_by is null/);
  assert.match(skillsInsertPolicy, /reviewed_at is null/);
  assert.match(skillsInsertPolicy, /review_note = ''/);
  assert.match(skillsUpdatePolicy, /for update using \(\s*exists \(/);
  assert.match(skillsUpdatePolicy, /with check \(\s*exists \(/);
  assert.match(skillsUpdatePolicy, /from public\.workspace_members wm/);
  assert.match(skillsUpdatePolicy, /wm\.workspace_id = skills\.workspace_id/);
  assert.match(skillsUpdatePolicy, /wm\.user_id = auth\.uid\(\)/);
  assert.match(skillsUpdatePolicy, /wm\.role in \('owner', 'admin'\)/);
  assert.doesNotMatch(skillsUpdatePolicy, /public\.is_owner_workspace_member\(workspace_id\)/);
  assert.match(memberSkillsInsertPolicy, /public\.can_access_app_data\(workspace_id, 'skill-map'\)/);
  assert.match(memberSkillsInsertPolicy, /user_id = auth\.uid\(\)/);
  assert.match(memberSkillsInsertPolicy, /created_by = auth\.uid\(\)/);
  assert.match(memberSkillsUpdatePolicy, /public\.can_access_app_data\(workspace_id, 'skill-map'\)/);
  assert.match(memberSkillsUpdatePolicy, /user_id = auth\.uid\(\)/);
  assert.match(memberSkillsUpdatePolicy, /user_id = auth\.uid\(\)\s*and created_by = auth\.uid\(\)/);
  assert.match(memberSkillsUpdatePolicy, /from public\.workspace_members wm/);
  assert.match(memberSkillsUpdatePolicy, /wm\.workspace_id = member_skills\.workspace_id/);
  assert.match(memberSkillsUpdatePolicy, /wm\.user_id = auth\.uid\(\)/);
  assert.match(memberSkillsUpdatePolicy, /wm\.role in \('owner', 'admin'\)/);
});
