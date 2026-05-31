import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PRESET_SKILLS,
  approvePendingSkill,
  buildCatalogSkillRows,
  buildCustomSkillUpsert,
  buildLegacySkillCleanupPlan,
  buildProfileSummary,
  buildMemberSkillUpsert,
  buildPresetSkillRows,
  cleanupLegacySkills,
  composeSkillMapView,
  deleteProfileSkill,
  loadSkillMapData,
  mergePendingSkill,
  rejectPendingSkill,
  saveProfileSkill,
} from '../src/lib/app/skill-map-data.js';
import { normalizeContextMemberProfiles, normalizeContextProfile } from '../src/lib/context.js';

test('preset skills are derived from the approved standard catalog with visual assets where known', () => {
  assert.equal(PRESET_SKILLS.length >= 50, true);
  assert.equal(PRESET_SKILLS.some((skill) => skill.id === 'frontend.react' && skill.name === 'React'), true);

  const knownVisualSkills = PRESET_SKILLS.filter((skill) => ['frontend.react', 'devops.docker', 'data.postgresql', 'design.figma'].includes(skill.id));
  assert.equal(knownVisualSkills.every((skill) => skill.iconUrl?.startsWith('https://cdn.simpleicons.org/')), true);
  assert.equal(PRESET_SKILLS.every((skill) => skill.iconUrl), true);
  assert.equal(PRESET_SKILLS.every((skill) => !/amazonwebservices|microsoftazure|playwright/.test(skill.iconUrl)), true);
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
    normalized_name: 'react',
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

test('normalizeContextProfile accepts main app profile shapes', () => {
  assert.deepEqual(
    normalizeContextProfile({
      userId: 'u-me',
      role: 'admin',
      userProfile: {
        fullName: 'Tran Minh Duc',
        avatarUrl: 'https://example.test/duc.png',
        username: 'duc',
        workPhone: '0900000000',
      },
    }),
    {
      user_id: 'u-me',
      role: 'admin',
      full_name: 'Tran Minh Duc',
      handle: '@duc',
      avatar_url: 'https://example.test/duc.png',
      work_phone: '0900000000',
    },
  );
});

test('normalizeContextMemberProfiles accepts main app team member shapes', () => {
  assert.deepEqual(
    normalizeContextMemberProfiles({
      userId: 'u-me',
      userProfile: { fullName: 'Tran Minh Duc' },
      workspaceMembers: [
        {
          userId: 'u-2',
          role: 'member',
          profile: {
            fullName: 'Dau Van Nam',
            avatarUrl: 'https://example.test/nam.png',
          },
        },
      ],
      memberProfilesById: {
        'u-3': {
          full_name: 'Le Thu Ha',
          avatar_url: 'https://example.test/ha.png',
        },
      },
    }),
    [
      {
        user_id: 'u-2',
        role: 'member',
        full_name: 'Dau Van Nam',
        handle: null,
        avatar_url: 'https://example.test/nam.png',
        work_phone: null,
      },
      {
        user_id: 'u-3',
        role: null,
        full_name: 'Le Thu Ha',
        handle: null,
        avatar_url: 'https://example.test/ha.png',
        work_phone: null,
      },
      {
        user_id: 'u-me',
        role: null,
        full_name: 'Tran Minh Duc',
        handle: null,
        avatar_url: null,
        work_phone: null,
      },
    ],
  );
});

test('composeSkillMapView syncs current member from app context when workspace members miss it', () => {
  const view = composeSkillMapView({
    currentUserId: 'u-me',
    currentUserProfile: {
      user_id: 'u-me',
      full_name: 'Tran Minh Duc',
      handle: '@duc',
      avatar_url: 'https://example.test/duc.png',
    },
    skills: [],
    memberSkills: [],
    members: [],
  });

  assert.equal(view.members.length, 1);
  assert.equal(view.members[0].userId, 'u-me');
  assert.equal(view.members[0].name, 'Tran Minh Duc');
  assert.equal(view.members[0].handle, '@duc');
  assert.equal(view.members[0].avatarUrl, 'https://example.test/duc.png');

  const summary = buildProfileSummary({
    currentMember: view.members[0],
    profileSkills: [],
    skills: [],
  });
  assert.equal(summary.name, 'Tran Minh Duc');
  assert.equal(summary.handle, '@duc');
  assert.equal(summary.avatarUrl, 'https://example.test/duc.png');
});

test('composeSkillMapView syncs teammate profiles from app context', () => {
  const view = composeSkillMapView({
    currentUserId: 'u-me',
    contextMemberProfiles: [
      {
        user_id: 'u-2',
        full_name: 'Dau Van Nam',
        avatar_url: 'https://example.test/nam.png',
      },
    ],
    skills: [
      { id: 'skill-react', name: 'React', category: 'Frontend', is_preset: true, status: 'approved' },
    ],
    memberSkills: [
      { user_id: 'u-2', skill_id: 'skill-react', level: 4, interest: 2, note: '' },
    ],
    members: [],
  });

  const teammate = view.members.find((member) => member.userId === 'u-2');
  assert.equal(teammate.name, 'Dau Van Nam');
  assert.equal(teammate.handle, '');
  assert.equal(teammate.avatarUrl, 'https://example.test/nam.png');
  assert.equal(teammate.skills.react, 4);
});

test('loadSkillMapData passes skill-row user ids and app team profiles to member lookup', async () => {
  const listMemberCalls = [];
  const db = {
    from(table) {
      return {
        upsert() {
          return Promise.resolve({ data: null, error: null });
        },
        select() {
          const query = {
            eq() {
              return query;
            },
            in() {
              if (table === 'member_skills') {
                return Promise.resolve({
                  data: [{ user_id: 'u-2', skill_id: 'skill-react', level: 4, interest: 2, note: '' }],
                  error: null,
                });
              }
              return Promise.resolve({ data: [], error: null });
            },
            then(resolve) {
              if (table === 'skills') {
                return Promise.resolve({
                  data: [{
                    id: 'skill-react',
                    name: 'React',
                    category: 'Frontend',
                    is_preset: true,
                    status: 'approved',
                    catalog_key: 'frontend.react',
                    source: 'catalog',
                  }],
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
  const contextMemberProfiles = [
    { user_id: 'u-2', full_name: 'Dau Van Nam', avatar_url: 'https://example.test/nam.png' },
  ];

  const view = await loadSkillMapData({
    db,
    listMembers: async (workspaceId, options) => {
      listMemberCalls.push({ workspaceId, options });
      return [];
    },
    workspaceId: 'ws-active',
    userId: 'u-me',
    contextMemberProfiles,
  });

  assert.deepEqual(listMemberCalls, [
    {
      workspaceId: 'ws-active',
      options: {
        currentUserId: 'u-me',
        currentUserProfile: null,
        contextMemberProfiles,
        extraUserIds: ['u-2'],
      },
    },
  ]);
  assert.equal(view.members.find((member) => member.userId === 'u-2').name, 'Dau Van Nam');
});

test('composeSkillMapView labels missing member profiles as unsynced instead of mock identity', () => {
  const view = composeSkillMapView({
    currentUserId: 'u-me',
    skills: [
      { id: 'skill-react', name: 'React', category: 'Frontend', is_preset: true, status: 'approved' },
    ],
    memberSkills: [
      { user_id: 'u-missing', skill_id: 'skill-react', level: 3, interest: 2, note: '' },
    ],
    members: [],
  });

  const missingMember = view.members.find((member) => member.userId === 'u-missing');
  assert.equal(missingMember.name, 'Chưa đồng bộ hồ sơ');
  assert.equal(missingMember.handle, '');
  assert.notEqual(missingMember.name, 'Thanh vien');
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

test('composeSkillMapView resolves merged member skills to the approved canonical skill', () => {
  const view = composeSkillMapView({
    currentUserId: 'u-me',
    skills: [
      { id: 'skill-react', name: 'React', category: 'Frontend', is_preset: true, status: 'approved' },
      {
        id: 'skill-reactjs',
        name: 'ReactJS',
        category: 'Frontend',
        is_preset: false,
        status: 'merged',
        canonical_skill_id: 'skill-react',
      },
    ],
    memberSkills: [
      { id: 'merged-row', user_id: 'u-me', skill_id: 'skill-reactjs', level: 4, interest: 2, note: 'Legacy ReactJS row' },
    ],
    members: [
      { user_id: 'u-me', full_name: 'Nguyen Ha My' },
    ],
  });

  assert.equal(view.skills.find((skill) => skill.name === 'React').total, 1);
  assert.equal(view.members[0].skills.react, 4);
  assert.equal(view.members[0].interests.react, 2);
  assert.equal(view.members[0].notes.react, 'Legacy ReactJS row');
  assert.deepEqual(view.profileSkills, [
    {
      id: 'react',
      rowId: 'merged-row',
      skillId: 'skill-react',
      sourceSkillId: 'skill-reactjs',
      level: 4,
      interest: 2,
      note: 'Legacy ReactJS row',
      status: 'approved',
      name: 'React',
      category: 'Frontend',
    },
  ]);
});

test('composeSkillMapView deduplicates direct and merged rows for the same member and canonical skill', () => {
  const view = composeSkillMapView({
    currentUserId: 'u-me',
    skills: [
      { id: 'skill-react', name: 'React', category: 'Frontend', is_preset: true, status: 'approved' },
      {
        id: 'skill-reactjs',
        name: 'ReactJS',
        category: 'Frontend',
        is_preset: false,
        status: 'merged',
        canonical_skill_id: 'skill-react',
      },
    ],
    memberSkills: [
      { id: 'direct-row', user_id: 'u-me', skill_id: 'skill-react', level: 3, interest: 1, note: 'Direct canonical' },
      { id: 'merged-row', user_id: 'u-me', skill_id: 'skill-reactjs', level: 4, interest: 3, note: 'Stronger merged row' },
      { id: 'u-2-direct', user_id: 'u-2', skill_id: 'skill-react', level: 4, interest: 2, note: 'Mentor' },
      { id: 'u-2-merged', user_id: 'u-2', skill_id: 'skill-reactjs', level: 4, interest: 1, note: 'Tie merged row' },
    ],
    members: [
      { user_id: 'u-me', full_name: 'Nguyen Ha My' },
      { user_id: 'u-2', full_name: 'Dau Van Nam' },
    ],
  });

  assert.equal(view.skills.find((skill) => skill.name === 'React').total, 2);
  assert.equal(view.members[0].skills.react, 4);
  assert.equal(view.members[0].notes.react, 'Stronger merged row');
  assert.equal(view.members[1].skills.react, 4);
  assert.equal(view.members[1].notes.react, 'Mentor');
  assert.deepEqual(view.profileSkills, [
    {
      id: 'react',
      rowId: 'merged-row',
      memberSkillIds: ['direct-row', 'merged-row'],
      skillId: 'skill-react',
      sourceSkillId: 'skill-reactjs',
      sourceSkillIds: ['skill-react', 'skill-reactjs'],
      level: 4,
      interest: 3,
      note: 'Stronger merged row',
      status: 'approved',
      name: 'React',
      category: 'Frontend',
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
      normalized_name: 'kafkastreams',
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

test('saveProfileSkill attaches merged duplicate names to the canonical approved skill', async () => {
  const calls = [];
  const db = makeSaveProfileSkillDb({
    calls,
    existingSkill: {
      id: 'skill-reactjs',
      name: 'ReactJS',
      status: 'merged',
      canonical_skill_id: 'skill-react',
    },
  });

  const saved = await saveProfileSkill({
    db,
    workspaceId: 'ws-active',
    userId: 'u-me',
    skillName: 'ReactJS',
    category: 'Frontend',
    level: 3,
    interest: 2,
    note: 'Production UI',
  });

  assert.equal(saved.skill_id, 'skill-react');
  assert.equal(calls.some((call) => call.table === 'skills' && call.op === 'insert'), false);
  assert.equal(calls.some((call) => call.table === 'skills' && call.op === 'upsert'), false);
  assert.equal(calls.find((call) => call.table === 'member_skills' && call.op === 'upsert').row.skill_id, 'skill-react');
});

test('saveProfileSkill attaches catalog aliases to the approved catalog skill', async () => {
  const calls = [];
  const db = makeSaveProfileSkillDb({
    calls,
    existingSkill: null,
    catalogSkill: {
      id: 'skill-postgresql',
      name: 'PostgreSQL',
      category: 'Database/Data',
      status: 'approved',
      canonical_skill_id: null,
      catalog_key: 'data.postgresql',
    },
  });

  const saved = await saveProfileSkill({
    db,
    workspaceId: 'ws-active',
    userId: 'u-me',
    skillName: 'Postgres',
    category: 'Database/Data',
    level: 2,
    interest: 3,
    note: 'Query tuning',
  });

  assert.equal(saved.skill_id, 'skill-postgresql');
  assert.equal(calls.some((call) => call.table === 'skills' && call.op === 'insert'), false);
  assert.equal(calls.some((call) => call.table === 'skills' && call.op === 'upsert'), false);
  assert.equal(calls.find((call) => call.op === 'eq' && call.column === 'catalog_key').value, 'data.postgresql');
});

test('saveProfileSkill attaches catalog aliases before reusing stale pending proposals', async () => {
  const calls = [];
  const db = makeSaveProfileSkillDb({
    calls,
    existingSkill: {
      id: 'skill-postgres-pending',
      name: 'Postgres',
      category: 'Database/Data',
      status: 'pending',
      canonical_skill_id: null,
    },
    catalogSkill: {
      id: 'skill-postgresql',
      name: 'PostgreSQL',
      category: 'Database/Data',
      status: 'approved',
      canonical_skill_id: null,
      catalog_key: 'data.postgresql',
    },
  });

  const saved = await saveProfileSkill({
    db,
    workspaceId: 'ws-active',
    userId: 'u-me',
    skillName: 'Postgres',
    category: 'Database/Data',
    level: 2,
    interest: 3,
    note: 'Query tuning',
  });

  assert.equal(saved.skill_id, 'skill-postgresql');
  assert.equal(calls.some((call) => call.table === 'skills' && call.op === 'insert'), false);
  assert.equal(calls.find((call) => call.op === 'eq' && call.column === 'catalog_key').value, 'data.postgresql');
});

test('saveProfileSkill updates an existing member skill row by row id', async () => {
  const calls = [];
  const db = {
    from(table) {
      return {
        update(row) {
          calls.push({ table, op: 'update', row });
          return {
            eq(column, value) {
              calls.push({ table, op: 'eq', column, value });
              return this;
            },
            select(columns) {
              calls.push({ table, op: 'select', columns });
              return {
                single() {
                  return Promise.resolve({
                    data: {
                      id: 'member-skill-merged',
                      user_id: 'u-me',
                      skill_id: 'skill-reactjs',
                      ...row,
                    },
                    error: null,
                  });
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
    memberSkillId: 'member-skill-merged',
    level: 1,
    interest: 3,
    note: 'Adjusted merged row',
  });

  assert.equal(saved.id, 'member-skill-merged');
  assert.equal(saved.skill_id, 'skill-reactjs');
  assert.deepEqual(calls.filter((call) => call.op === 'eq'), [
    { table: 'member_skills', op: 'eq', column: 'workspace_id', value: 'ws-active' },
    { table: 'member_skills', op: 'eq', column: 'user_id', value: 'u-me' },
    { table: 'member_skills', op: 'eq', column: 'id', value: 'member-skill-merged' },
  ]);
  assert.equal(calls.some((call) => call.op === 'upsert'), false);
});

test('saveProfileSkill updates all deduped member skill rows by row ids', async () => {
  const calls = [];
  const db = {
    from(table) {
      return {
        update(row) {
          calls.push({ table, op: 'update', row });
          return {
            eq(column, value) {
              calls.push({ table, op: 'eq', column, value });
              return this;
            },
            in(column, values) {
              calls.push({ table, op: 'in', column, values });
              return this;
            },
            select(columns) {
              calls.push({ table, op: 'select', columns });
              return Promise.resolve({
                data: [
                  { id: 'direct-row', user_id: 'u-me', skill_id: 'skill-react', ...row },
                  { id: 'merged-row', user_id: 'u-me', skill_id: 'skill-reactjs', ...row },
                ],
                error: null,
              });
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
    memberSkillIds: ['direct-row', 'merged-row'],
    level: 1,
    interest: 3,
    note: 'Adjusted all duplicate rows',
  });

  assert.equal(saved.id, 'direct-row');
  assert.deepEqual(calls.filter((call) => call.op === 'eq'), [
    { table: 'member_skills', op: 'eq', column: 'workspace_id', value: 'ws-active' },
    { table: 'member_skills', op: 'eq', column: 'user_id', value: 'u-me' },
  ]);
  assert.deepEqual(calls.find((call) => call.op === 'in'), {
    table: 'member_skills',
    op: 'in',
    column: 'id',
    values: ['direct-row', 'merged-row'],
  });
  assert.equal(calls.some((call) => call.op === 'upsert'), false);
});

test('deleteProfileSkill deletes an existing member skill row by row id', async () => {
  const calls = [];
  const db = {
    from(table) {
      return {
        delete() {
          calls.push({ table, op: 'delete' });
          return {
            eq(column, value) {
              calls.push({ table, op: 'eq', column, value });
              return this;
            },
            then(resolve) {
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
        },
      };
    },
  };

  await deleteProfileSkill({
    db,
    workspaceId: 'ws-active',
    userId: 'u-me',
    memberSkillId: 'member-skill-pending',
  });

  assert.deepEqual(calls, [
    { table: 'member_skills', op: 'delete' },
    { table: 'member_skills', op: 'eq', column: 'workspace_id', value: 'ws-active' },
    { table: 'member_skills', op: 'eq', column: 'user_id', value: 'u-me' },
    { table: 'member_skills', op: 'eq', column: 'id', value: 'member-skill-pending' },
  ]);
});

test('deleteProfileSkill deletes all deduped member skill rows by row ids', async () => {
  const calls = [];
  const db = {
    from(table) {
      return {
        delete() {
          calls.push({ table, op: 'delete' });
          return {
            eq(column, value) {
              calls.push({ table, op: 'eq', column, value });
              return this;
            },
            in(column, values) {
              calls.push({ table, op: 'in', column, values });
              return this;
            },
            then(resolve) {
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
        },
      };
    },
  };

  await deleteProfileSkill({
    db,
    workspaceId: 'ws-active',
    userId: 'u-me',
    memberSkillIds: ['direct-row', 'merged-row'],
  });

  assert.deepEqual(calls, [
    { table: 'member_skills', op: 'delete' },
    { table: 'member_skills', op: 'eq', column: 'workspace_id', value: 'ws-active' },
    { table: 'member_skills', op: 'eq', column: 'user_id', value: 'u-me' },
    { table: 'member_skills', op: 'in', column: 'id', values: ['direct-row', 'merged-row'] },
  ]);
});

test('buildLegacySkillCleanupPlan maps obvious legacy skills and leaves unknown pending', () => {
  const plan = buildLegacySkillCleanupPlan({
    skills: [
      { id: 'legacy-react', name: 'React.js', status: 'approved', catalog_key: null },
      { id: 'legacy-kafka', name: 'Kafka Streams', status: 'approved', catalog_key: null },
      { id: 'catalog-react', name: 'React', status: 'approved', catalog_key: 'frontend.react' },
    ],
  });

  assert.deepEqual(plan.memberSkillMoves, [
    { fromSkillId: 'legacy-react', toSkillId: 'catalog-react' },
  ]);
  assert.deepEqual(plan.skillUpdates, [
    {
      id: 'legacy-react',
      status: 'merged',
      canonical_skill_id: 'catalog-react',
      review_note: 'Auto-merged by catalog alias: frontend.react',
    },
    {
      id: 'legacy-kafka',
      status: 'pending',
      source: 'legacy',
      review_note: 'Needs workspace admin review',
    },
  ]);
});

test('cleanupLegacySkills moves members and updates legacy skill review state', async () => {
  const calls = [];
  const db = fakeUpdateDb(calls);

  const plan = await cleanupLegacySkills({
    db,
    workspaceId: 'ws-active',
    skills: [
      { id: 'legacy-react', name: 'React.js', status: 'approved', catalog_key: null },
      { id: 'legacy-kafka', name: 'Kafka Streams', status: 'approved', catalog_key: null },
      { id: 'catalog-react', name: 'React', status: 'approved', catalog_key: 'frontend.react' },
    ],
  });

  assert.deepEqual(plan.memberSkillMoves, [
    { fromSkillId: 'legacy-react', toSkillId: 'catalog-react' },
  ]);
  assert.deepEqual(calls, [
    {
      table: 'member_skills',
      patch: { skill_id: 'catalog-react' },
      filters: { workspace_id: 'ws-active', skill_id: 'legacy-react' },
    },
    {
      table: 'skills',
      patch: {
        status: 'merged',
        canonical_skill_id: 'catalog-react',
        review_note: 'Auto-merged by catalog alias: frontend.react',
      },
      filters: { workspace_id: 'ws-active', id: 'legacy-react' },
    },
    {
      table: 'skills',
      patch: {
        status: 'pending',
        source: 'legacy',
        review_note: 'Needs workspace admin review',
      },
      filters: { workspace_id: 'ws-active', id: 'legacy-kafka' },
    },
  ]);
});

test('approvePendingSkill marks a proposal approved with audit metadata', async () => {
  const calls = [];
  const db = fakeUpdateDb(calls);

  await approvePendingSkill({
    db,
    workspaceId: 'ws-1',
    reviewerId: 'u-admin',
    skillId: 'skill-kafka',
    description: 'Kafka stream processing',
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    table: 'skills',
    patch: {
      status: 'approved',
      source: 'proposal',
      description: 'Kafka stream processing',
      reviewed_by: 'u-admin',
      reviewed_at: calls[0].patch.reviewed_at,
      review_note: 'Approved as workspace skill',
    },
    filters: { workspace_id: 'ws-1', id: 'skill-kafka' },
  });
  assert.match(calls[0].patch.reviewed_at, /^\d{4}-\d{2}-\d{2}T/);
});

test('mergePendingSkill moves member skill rows and marks proposal merged', async () => {
  const calls = [];
  const db = fakeUpdateDb(calls);

  await mergePendingSkill({
    db,
    workspaceId: 'ws-1',
    reviewerId: 'u-admin',
    fromSkillId: 'skill-reactjs',
    toSkillId: 'skill-react',
  });

  assert.equal(calls[0].table, 'member_skills');
  assert.deepEqual(calls[0].patch, { skill_id: 'skill-react' });
  assert.deepEqual(calls[0].filters, { workspace_id: 'ws-1', skill_id: 'skill-reactjs' });
  assert.equal(calls[1].table, 'skills');
  assert.equal(calls[1].patch.status, 'merged');
  assert.equal(calls[1].patch.canonical_skill_id, 'skill-react');
  assert.equal(calls[1].patch.reviewed_by, 'u-admin');
  assert.match(calls[1].patch.reviewed_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(calls[1].patch.review_note, 'Merged into skill-react');
  assert.deepEqual(calls[1].filters, { workspace_id: 'ws-1', id: 'skill-reactjs' });
});

test('rejectPendingSkill marks proposal rejected with review note', async () => {
  const calls = [];
  const db = fakeUpdateDb(calls);

  await rejectPendingSkill({
    db,
    workspaceId: 'ws-1',
    reviewerId: 'u-admin',
    skillId: 'skill-cloud',
    note: 'Too broad',
  });

  assert.deepEqual(calls[0], {
    table: 'skills',
    patch: {
      status: 'rejected',
      reviewed_by: 'u-admin',
      reviewed_at: calls[0].patch.reviewed_at,
      review_note: 'Too broad',
    },
    filters: { workspace_id: 'ws-1', id: 'skill-cloud' },
  });
});

function makeSaveProfileSkillDb({ calls, existingSkill, catalogSkill = null }) {
  return {
    from(table) {
      const filters = {};
      return {
        select(columns) {
          calls.push({ table, op: 'select', columns });
          return {
            eq(column, value) {
              filters[column] = value;
              calls.push({ table, op: 'eq', column, value });
              return this;
            },
            maybeSingle() {
              calls.push({ table, op: 'maybeSingle' });
              const data = filters.catalog_key ? catalogSkill : existingSkill;
              return Promise.resolve({ data, error: null });
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

function fakeUpdateDb(calls, { updateError = null } = {}) {
  return {
    from(table) {
      const call = { table, patch: null, filters: {} };
      calls.push(call);
      return {
        update(patch) {
          call.patch = patch;
          return {
            eq(column, value) {
              call.filters[column] = value;
              return this;
            },
            then(resolve) {
              return Promise.resolve({ data: null, error: updateError }).then(resolve);
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
                  data: [{
                    id: 'skill-react',
                    name: 'React',
                    category: 'Frontend',
                    is_preset: true,
                    status: 'approved',
                    catalog_key: 'frontend.react',
                    source: 'catalog',
                  }],
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

test('loadSkillMapData passes app profile through when member lookup returns no current user', async () => {
  const listMemberCalls = [];
  const db = {
    from(table) {
      return {
        upsert() {
          return Promise.resolve({ data: null, error: null });
        },
        select() {
          const query = {
            eq() {
              return query;
            },
            then(resolve) {
              return Promise.resolve({ data: [], error: null }).then(resolve);
            },
          };
          return query;
        },
      };
    },
  };

  const currentUserProfile = {
    user_id: 'u-me',
    full_name: 'Tran Minh Duc',
    handle: '@duc',
    avatar_url: 'https://example.test/duc.png',
  };
  const view = await loadSkillMapData({
    db,
    listMembers: async (workspaceId, options) => {
      listMemberCalls.push({ workspaceId, options });
      return [];
    },
    workspaceId: 'ws-active',
    userId: 'u-me',
    currentUserProfile,
  });

  assert.deepEqual(listMemberCalls, [
    {
      workspaceId: 'ws-active',
      options: {
        currentUserId: 'u-me',
        currentUserProfile,
        contextMemberProfiles: [],
        extraUserIds: [],
      },
    },
  ]);
  assert.equal(view.members[0].name, 'Tran Minh Duc');
  assert.equal(view.members[0].avatarUrl, 'https://example.test/duc.png');
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
  const memberSkillsDeletePolicy = sql.match(/create policy "member_skills_delete"[\s\S]*?create or replace function app_skill_map\.set_updated_at/)?.[0] ?? '';

  assert.match(sql, /catalog_key text/);
  assert.match(sql, /normalized_name text not null default ''/);
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
  assert.doesNotMatch(sql, /idx_skills_workspace_catalog_key[\s\S]*where catalog_key is not null/i);
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
  assert.match(memberSkillsDeletePolicy, /public\.can_access_app_data\(workspace_id, 'skill-map'\)/);
  assert.match(memberSkillsDeletePolicy, /user_id = auth\.uid\(\)\s*and created_by = auth\.uid\(\)/);
  assert.match(memberSkillsDeletePolicy, /from public\.workspace_members wm/);
  assert.match(memberSkillsDeletePolicy, /wm\.workspace_id = member_skills\.workspace_id/);
  assert.match(memberSkillsDeletePolicy, /wm\.user_id = auth\.uid\(\)/);
  assert.match(memberSkillsDeletePolicy, /wm\.role in \('owner', 'admin'\)/);
  assert.doesNotMatch(memberSkillsDeletePolicy, /public\.is_owner_workspace_member\(workspace_id\)/);
});

test('catalog upsert repair migration creates a non-partial conflict index', () => {
  const sql = readFileSync(new URL('../migrations/003_fix_skill_catalog_upsert_constraint.sql', import.meta.url), 'utf8');

  assert.match(sql, /drop index if exists app_skill_map\.idx_skills_workspace_catalog_key/);
  assert.match(sql, /create unique index if not exists idx_skills_workspace_catalog_key\s+on app_skill_map\.skills \(workspace_id, catalog_key\)/i);
  assert.doesNotMatch(sql, /where catalog_key is not null/i);
});

test('normalized name compatibility migration backfills required skill names', () => {
  const sql = readFileSync(new URL('../migrations/004_add_skill_normalized_name_compat.sql', import.meta.url), 'utf8');

  assert.match(sql, /add column if not exists normalized_name text/);
  assert.match(sql, /set normalized_name = lower\(regexp_replace\(name/);
  assert.match(sql, /where normalized_name is null or normalized_name = ''/);
  assert.match(sql, /alter column normalized_name set not null/);
});

test('reset migration rebuilds skill map schema from scratch', () => {
  const sql = readFileSync(new URL('../migrations/005_reset_team_skill_map_schema.sql', import.meta.url), 'utf8');

  assert.match(sql, /drop table if exists app_skill_map\.member_skills cascade/);
  assert.match(sql, /drop table if exists app_skill_map\.skills cascade/);
  assert.match(sql, /-- @realtime\s+create table if not exists app_skill_map\.skills/);
  assert.match(sql, /-- @realtime\s+create table if not exists app_skill_map\.member_skills/);
  assert.match(sql, /normalized_name text not null default ''/);
  assert.match(sql, /constraint skills_workspace_catalog_key_unique unique \(workspace_id, catalog_key\)/);
  assert.doesNotMatch(sql, /where catalog_key is not null/i);
  assert.match(sql, /constraint member_skills_skill_same_workspace_fk/);
  assert.match(sql, /create index if not exists idx_skills_workspace on app_skill_map\.skills \(workspace_id\)/);
  assert.match(sql, /create index if not exists idx_member_skills_workspace on app_skill_map\.member_skills \(workspace_id\)/);
  assert.match(sql, /alter table app_skill_map\.skills enable row level security/);
  assert.match(sql, /alter table app_skill_map\.member_skills enable row level security/);
  assert.match(sql, /drop policy if exists "skills_update" on app_skill_map\.skills/);
  assert.match(sql, /drop policy if exists "member_skills_update" on app_skill_map\.member_skills/);
  assert.match(sql, /create policy "skills_update" on app_skill_map\.skills/);
  assert.match(sql, /create policy "member_skills_update" on app_skill_map\.member_skills/);
  assert.match(sql, /public\.can_access_app_data\(workspace_id, 'skill-map'\)/);
});
