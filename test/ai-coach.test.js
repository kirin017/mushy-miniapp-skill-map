import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCoachLevelPlanRequest,
  buildCoachSessionInsert,
  listCoachSessions,
  parseCoachLevelPlanText,
  saveCoachSession,
  validateCoachLevelPlanPayload,
} from '../src/lib/app/ai-coach.js';

const profileSkills = [
  {
    id: 'react',
    skill_id: 'internal-react',
    skillId: 'legacy-react',
    name: 'React',
    category: 'Frontend',
    level: 2,
    interest: 3,
    note: 'Build UI',
    privateNotes: 'hidden',
  },
  {
    skill_id: 'node',
    skillId: 'legacy-node',
    name: 'Node.js',
    category: 'Backend',
    level: 1,
    interest: 2,
    note: 'APIs',
  },
  {
    skillId: 'sql',
    name: 'Postgres',
    category: 'Data',
    level: 3,
    interest: 1,
    note: 'Reporting',
  },
];

test('parseCoachLevelPlanText accepts strict JSON', () => {
  const parsed = parseCoachLevelPlanText(JSON.stringify({
    summary: 'Focus on React fundamentals',
    items: [
      { skill_id: 'react', current_level: 2, target_level: 3 },
    ],
  }));

  assert.equal(parsed.summary, 'Focus on React fundamentals');
  assert.equal(parsed.items[0].skill_id, 'react');
});

test('parseCoachLevelPlanText accepts markdown fenced JSON', () => {
  const parsed = parseCoachLevelPlanText('```json\n{"summary":"Plan","items":[{"skill_id":"node","current_level":1,"target_level":2}]}\n```');

  assert.equal(parsed.summary, 'Plan');
  assert.equal(parsed.items[0].skill_id, 'node');
});

test('parseCoachLevelPlanText throws invalid_json for malformed text', () => {
  assert.throws(
    () => parseCoachLevelPlanText('not json'),
    (error) => error.code === 'invalid_json',
  );
});

test('validateCoachLevelPlanPayload drops unknown skill ids and duplicates, validates current levels, and returns summary plus valid items', () => {
  const validated = validateCoachLevelPlanPayload({
    profileSkills,
    payload: {
      summary: 'Level up for product work',
      items: [
        { skill_id: 'react', current_level: 2, target_level: 3, reason: 'More UI ownership', next_step: 'Build a reducer-driven screen' },
        { skill_id: 'unknown', current_level: 0, target_level: 1, reason: 'Unknown', next_step: 'Skip' },
        { skill_id: 'react', current_level: 2, target_level: 4, reason: 'Duplicate', next_step: 'Skip duplicate' },
        { skill_id: 'node', current_level: 2, target_level: 3, reason: 'Wrong current level', next_step: 'Skip' },
        { skill_id: 'sql', current_level: 3, target_level: 4, reason: 'Improve reporting', next_step: 'Tune a query' },
      ],
    },
    maxItems: 6,
  });

  assert.deepEqual(validated, {
    summary: 'Level up for product work',
    items: [
      { skill_id: 'react', current_level: 2, target_level: 3, reason: 'More UI ownership', next_step: 'Build a reducer-driven screen' },
      { skill_id: 'sql', current_level: 3, target_level: 4, reason: 'Improve reporting', next_step: 'Tune a query' },
    ],
  });
});

test('validateCoachLevelPlanPayload rejects plans with no usable items', () => {
  assert.throws(
    () => validateCoachLevelPlanPayload({
      profileSkills,
      payload: {
        summary: 'Nothing usable',
        items: [
          { skill_id: 'unknown', current_level: 0, target_level: 1 },
          { skill_id: 'react', current_level: 2, target_level: 2 },
        ],
      },
    }),
    /coach_plan_empty/,
  );
});

test('validateCoachLevelPlanPayload caps summary, reason, next_step, and max item count', () => {
  const payload = {
    summary: 's'.repeat(300),
    items: Array.from({ length: 10 }, (_, index) => ({
      skill_id: `skill-${index}`,
      current_level: 0,
      target_level: 1,
      reason: 'r'.repeat(300),
      next_step: 'n'.repeat(500),
    })),
  };
  const manyProfileSkills = payload.items.map((item) => ({
    id: item.skill_id,
    level: 0,
    name: item.skill_id,
  }));

  const validated = validateCoachLevelPlanPayload({
    payload,
    profileSkills: manyProfileSkills,
    maxItems: 20,
  });

  assert.equal(validated.summary.length, 240);
  assert.equal(validated.items.length, 8);
  assert.equal(validated.items[0].reason.length, 220);
  assert.equal(validated.items[0].next_step.length, 360);
});

test('buildCoachLevelPlanRequest sends reduced personal skill fields only and omits internal skillId values', () => {
  const request = buildCoachLevelPlanRequest({
    goalText: '  Grow   toward frontend lead  ',
    profileSkills,
    levelLabels: ['None', 'Basic', 'Working'],
    maxItems: 12,
  });

  assert.deepEqual(request, {
    action: 'coach_level_plan',
    goalText: 'Grow toward frontend lead',
    profileSkills: [
      { skill_id: 'react', name: 'React', category: 'Frontend', level: 2, interest: 3, note: 'Build UI' },
      { skill_id: 'node', name: 'Node.js', category: 'Backend', level: 1, interest: 2, note: 'APIs' },
      { skill_id: 'sql', name: 'Postgres', category: 'Data', level: 3, interest: 1, note: 'Reporting' },
    ],
    levelLabels: ['None', 'Basic', 'Working'],
    maxItems: 8,
  });
  assert.equal(JSON.stringify(request).includes('legacy-react'), false);
  assert.equal(JSON.stringify(request).includes('skillId'), false);
});

test('buildCoachSessionInsert creates a scoped insert row', () => {
  assert.deepEqual(
    buildCoachSessionInsert({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      goalText: '  Reach   level 3  ',
      plan: {
        summary: '  Practical plan  ',
        items: [{ skill_id: 'react', current_level: 2, target_level: 3 }],
      },
    }),
    {
      workspace_id: 'workspace-1',
      user_id: 'user-1',
      goal_text: 'Reach level 3',
      summary: 'Practical plan',
      items: [{ skill_id: 'react', current_level: 2, target_level: 3 }],
    },
  );
});

test('saveCoachSession inserts, selects the stored session fields, and returns the stored session', async () => {
  const stored = {
    id: 'session-1',
    workspace_id: 'workspace-1',
    user_id: 'user-1',
    goal_text: 'Reach level 3',
    summary: 'Plan',
    items: [],
    created_at: '2026-06-02T00:00:00.000Z',
  };
  const calls = [];
  const supabase = {
    from(table) {
      calls.push(['from', table]);
      return {
        insert(row) {
          calls.push(['insert', row]);
          return {
            select(columns) {
              calls.push(['select', columns]);
              return {
                single() {
                  calls.push(['single']);
                  return Promise.resolve({ data: stored, error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await saveCoachSession({
    supabase,
    workspaceId: 'workspace-1',
    userId: 'user-1',
    goalText: 'Reach level 3',
    plan: { summary: 'Plan', items: [] },
  });

  assert.equal(result, stored);
  assert.deepEqual(calls, [
    ['from', 'ai_coach_sessions'],
    ['insert', { workspace_id: 'workspace-1', user_id: 'user-1', goal_text: 'Reach level 3', summary: 'Plan', items: [] }],
    ['select', 'id,workspace_id,user_id,goal_text,summary,items,created_at'],
    ['single'],
  ]);
});

test('listCoachSessions scopes by workspace and user, orders newest first, and clamps requested limit', async () => {
  const stored = [{ id: 'session-1' }];
  const calls = [];
  const supabase = {
    from(table) {
      calls.push(['from', table]);
      return {
        select(columns) {
          calls.push(['select', columns]);
          return {
            eq(column, value) {
              calls.push(['eq', column, value]);
              return this;
            },
            order(column, options) {
              calls.push(['order', column, options]);
              return this;
            },
            limit(value) {
              calls.push(['limit', value]);
              return Promise.resolve({ data: stored, error: null });
            },
          };
        },
      };
    },
  };

  const result = await listCoachSessions({
    supabase,
    workspaceId: 'workspace-1',
    userId: 'user-1',
    limit: 100,
  });

  assert.equal(result, stored);
  assert.deepEqual(calls, [
    ['from', 'ai_coach_sessions'],
    ['select', 'id,workspace_id,user_id,goal_text,summary,items,created_at'],
    ['eq', 'workspace_id', 'workspace-1'],
    ['eq', 'user_id', 'user-1'],
    ['order', 'created_at', { ascending: false }],
    ['limit', 50],
  ]);
});
