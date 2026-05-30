import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PRESET_SKILLS,
  buildCustomSkillUpsert,
  buildProfileSummary,
  buildMemberSkillUpsert,
  buildPresetSkillRows,
  composeSkillMapView,
  saveProfileSkill,
} from '../src/lib/app/skill-map-data.js';

test('preset skills expose visual icon assets instead of initials-only labels', () => {
  const textOnlyLabels = new Set(['Go', 'AI', 'QA', 'Sec', 'PG', 'Fig', 'App', 'PM']);

  assert.equal(PRESET_SKILLS.every((skill) => skill.iconUrl?.startsWith('https://cdn.simpleicons.org/')), true);
  assert.equal(PRESET_SKILLS.every((skill) => skill.iconAlt === `${skill.name} icon`), true);
  assert.equal(PRESET_SKILLS.every((skill) => !textOnlyLabels.has(skill.icon)), true);
});

test('buildPresetSkillRows creates RLS-ready preset rows for the active workspace', () => {
  const rows = buildPresetSkillRows({ workspaceId: 'ws-1', userId: 'user-1' });

  assert.equal(rows.length >= 8, true);
  assert.deepEqual(rows[0], {
    workspace_id: 'ws-1',
    created_by: 'user-1',
    name: 'React',
    category: 'Frontend',
    is_preset: true,
  });
  assert.equal(rows.every((row) => row.workspace_id === 'ws-1'), true);
  assert.equal(rows.every((row) => row.created_by === 'user-1'), true);
  assert.equal(rows.every((row) => row.is_preset === true), true);
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
    { id: 'react', rowId: undefined, skillId: 'skill-react', level: 3, interest: 3, note: 'Components' },
    { id: 'docker', rowId: undefined, skillId: 'skill-docker', level: 2, interest: 2, note: 'Compose' },
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

test('buildCustomSkillUpsert creates a normalized non-preset skill row', () => {
  assert.deepEqual(
    buildCustomSkillUpsert({
      workspaceId: 'ws-active',
      userId: 'u-me',
      name: '  Kafka Streams  ',
      category: '  Backend  ',
    }),
    {
      workspace_id: 'ws-active',
      created_by: 'u-me',
      name: 'Kafka Streams',
      category: 'Backend',
      is_preset: false,
    },
  );
});

test('saveProfileSkill creates a custom skill before attaching it to the current profile', async () => {
  const calls = [];
  const db = {
    from(table) {
      return {
        upsert(row, options) {
          calls.push({ table, row, options });
          return {
            select() {
              return {
                single() {
                  if (table === 'skills') {
                    return Promise.resolve({ data: { id: 'skill-kafka', name: row.name }, error: null });
                  }
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
  assert.deepEqual(calls.map((call) => call.table), ['skills', 'member_skills']);
  assert.equal(calls[0].options.onConflict, 'workspace_id,name');
  assert.equal(calls[0].row.is_preset, false);
  assert.equal(calls[1].row.skill_id, 'skill-kafka');
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

  assert.match(sql, /catalog_key text/);
  assert.match(sql, /status text not null default 'approved'/);
  assert.match(sql, /skill_type text not null default 'tool'/);
  assert.match(sql, /aliases jsonb not null default '\[\]'::jsonb/);
  assert.match(sql, /canonical_skill_id uuid/);
  assert.match(sql, /reviewed_by uuid references auth\.users\(id\)/);
  assert.match(sql, /idx_skills_workspace_status/);
  assert.match(sql, /create unique index if not exists idx_skills_workspace_catalog_key/);
  assert.match(sql, /idx_skills_workspace_id_unique/);
  assert.match(sql, /skills_canonical_same_workspace_fk/);
  assert.match(sql, /foreign key \(workspace_id, canonical_skill_id\)/);
  assert.match(sql, /references app_skill_map\.skills\(workspace_id, id\)/);
});
