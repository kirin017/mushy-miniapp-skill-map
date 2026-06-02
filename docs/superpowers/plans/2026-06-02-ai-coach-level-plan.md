# AI Coach Level Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal AI Coach that generates, stores, and displays level-up plans from the current user's own skill profile.

**Architecture:** Reuse the existing Gemini serverless proxy with a new `coach_level_plan` action and strict JSON validation. Store validated coach sessions in a new `ai_coach_sessions` app-schema table, then render a dedicated React coach screen opened from the overview quick actions.

**Tech Stack:** Vite, React 18, Supabase client, Vercel Serverless Functions, Gemini API, Node `node:test`, SQL migrations.

---

## File Structure

- Create `src/lib/app/ai-coach.js`
  - Owns coach request shaping, AI response parsing, validation, and Supabase persistence helpers.
  - Keeps coach logic out of `src/App.jsx` and avoids expanding `api/ai-proxy.js` with client-specific mapping.
- Modify `api/ai-proxy.js`
  - Adds `buildCoachLevelPlanPrompt` and `handleCoachLevelPlanRequest`.
  - Routes `action: "coach_level_plan"` through the existing verified proxy.
- Create `test/ai-coach.test.js`
  - Tests parser, validator, client payload builder, and persistence helpers with fake DBs.
- Modify `test/ai-proxy-role-suggestions.test.js`
  - Adds proxy tests for the new action while preserving existing role suggestion coverage.
- Create `migrations/006_ai_coach_sessions.sql`
  - Adds the coach history table, indexes, grants, and RLS policies.
- Modify `test/skill-map-data.test.js`
  - Adds migration assertions for `006_ai_coach_sessions.sql`.
- Modify `src/App.jsx`
  - Adds the overview `AI Coach` quick card.
  - Adds `CoachScreen` and hooks it into the existing tab-like screen state.
- Modify `src/App.css`
  - Adds compact styles for the coach goal form, plan cards, and history list.

## Task 1: Add Coach Parser, Validator, And Persistence Helpers

**Files:**
- Create: `src/lib/app/ai-coach.js`
- Create: `test/ai-coach.test.js`

- [ ] **Step 1: Write failing parser and validator tests**

Create `test/ai-coach.test.js` with:

```js
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
    skillId: 'skill-react',
    name: 'React',
    category: 'Frontend',
    level: 2,
    interest: 3,
    note: 'Built forms',
  },
  {
    id: 'typescript',
    skillId: 'skill-ts',
    name: 'TypeScript',
    category: 'Frontend',
    level: 1,
    interest: 2,
    note: 'Learning types',
  },
];

test('parseCoachLevelPlanText accepts strict JSON', () => {
  const payload = parseCoachLevelPlanText(JSON.stringify({
    summary: 'Focus React first',
    items: [{ skill_id: 'react', current_level: 2, target_level: 3, reason: 'Core UI skill', next_step: 'Build a data form' }],
  }));

  assert.equal(payload.summary, 'Focus React first');
  assert.equal(payload.items.length, 1);
});

test('parseCoachLevelPlanText accepts markdown fenced JSON', () => {
  const payload = parseCoachLevelPlanText('```json\n{"summary":"Plan","items":[]}\n```');

  assert.deepEqual(payload, { summary: 'Plan', items: [] });
});

test('parseCoachLevelPlanText throws invalid_json for malformed text', () => {
  assert.throws(
    () => parseCoachLevelPlanText('not json'),
    (error) => error.code === 'invalid_json',
  );
});

test('validateCoachLevelPlanPayload drops invalid skills and duplicate items', () => {
  const result = validateCoachLevelPlanPayload({
    payload: {
      summary: '  Build frontend depth  ',
      items: [
        { skill_id: 'react', current_level: 2, target_level: 3, reason: 'React depth', next_step: 'Ship a stateful screen' },
        { skill_id: 'unknown', current_level: 1, target_level: 2, reason: 'Unknown', next_step: 'Nope' },
        { skill_id: 'react', current_level: 2, target_level: 4, reason: 'Duplicate', next_step: 'Nope' },
        { skill_id: 'typescript', current_level: 1, target_level: 2, reason: 'Type safety', next_step: 'Type API data' },
      ],
    },
    profileSkills,
    maxItems: 4,
  });

  assert.deepEqual(result, {
    summary: 'Build frontend depth',
    items: [
      { skill_id: 'react', current_level: 2, target_level: 3, reason: 'React depth', next_step: 'Ship a stateful screen' },
      { skill_id: 'typescript', current_level: 1, target_level: 2, reason: 'Type safety', next_step: 'Type API data' },
    ],
  });
});

test('validateCoachLevelPlanPayload rejects plans with no usable items', () => {
  assert.throws(
    () => validateCoachLevelPlanPayload({
      payload: {
        summary: 'Invalid plan',
        items: [
          { skill_id: 'react', current_level: 2, target_level: 2, reason: 'Same level', next_step: 'No progress' },
          { skill_id: 'typescript', current_level: 0, target_level: 2, reason: 'Wrong current', next_step: 'Mismatch' },
        ],
      },
      profileSkills,
      maxItems: 4,
    }),
    /coach_plan_empty/,
  );
});

test('validateCoachLevelPlanPayload caps item count and text length', () => {
  const result = validateCoachLevelPlanPayload({
    payload: {
      summary: 'S'.repeat(500),
      items: [
        { skill_id: 'react', current_level: 2, target_level: 3, reason: 'R'.repeat(500), next_step: 'N'.repeat(800) },
        { skill_id: 'typescript', current_level: 1, target_level: 2, reason: 'Type safety', next_step: 'Type one API response' },
      ],
    },
    profileSkills,
    maxItems: 1,
  });

  assert.equal(result.summary.length, 240);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].reason.length, 220);
  assert.equal(result.items[0].next_step.length, 360);
});

test('buildCoachLevelPlanRequest sends reduced personal skill fields only', () => {
  const request = buildCoachLevelPlanRequest({
    goalText: '  Muốn lên Middle Frontend  ',
    profileSkills,
    levelLabels: ['Học', 'Cơ bản', 'Làm được', 'Thành thạo', 'Mentor'],
    maxItems: 6,
  });

  assert.deepEqual(request, {
    action: 'coach_level_plan',
    goalText: 'Muốn lên Middle Frontend',
    profileSkills: [
      { skill_id: 'react', name: 'React', category: 'Frontend', level: 2, interest: 3, note: 'Built forms' },
      { skill_id: 'typescript', name: 'TypeScript', category: 'Frontend', level: 1, interest: 2, note: 'Learning types' },
    ],
    levelLabels: ['Học', 'Cơ bản', 'Làm được', 'Thành thạo', 'Mentor'],
    maxItems: 6,
  });
  assert.equal(JSON.stringify(request).includes('skill-react'), false);
});

test('buildCoachSessionInsert creates a scoped session row', () => {
  const row = buildCoachSessionInsert({
    workspaceId: 'ws-1',
    userId: 'u-1',
    goalText: 'Middle Frontend',
    plan: {
      summary: 'React first',
      items: [{ skill_id: 'react', current_level: 2, target_level: 3, reason: 'Core', next_step: 'Build UI' }],
    },
  });

  assert.deepEqual(row, {
    workspace_id: 'ws-1',
    user_id: 'u-1',
    goal_text: 'Middle Frontend',
    summary: 'React first',
    items: [{ skill_id: 'react', current_level: 2, target_level: 3, reason: 'Core', next_step: 'Build UI' }],
  });
});

test('saveCoachSession inserts and returns the stored session', async () => {
  const calls = [];
  const db = {
    from(table) {
      calls.push({ table });
      return {
        insert(row) {
          calls.push({ op: 'insert', row });
          return {
            select(columns) {
              calls.push({ op: 'select', columns });
              return {
                single() {
                  return Promise.resolve({ data: { id: 'session-1', created_at: '2026-06-02T00:00:00Z', ...row }, error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  const saved = await saveCoachSession({
    db,
    workspaceId: 'ws-1',
    userId: 'u-1',
    goalText: 'Middle Frontend',
    plan: { summary: 'React first', items: [] },
  });

  assert.equal(saved.id, 'session-1');
  assert.equal(calls[0].table, 'ai_coach_sessions');
  assert.equal(calls[1].row.workspace_id, 'ws-1');
});

test('listCoachSessions scopes by workspace and user and limits recent history', async () => {
  const calls = [];
  const db = {
    from(table) {
      calls.push({ op: 'from', table });
      return {
        select(columns) {
          calls.push({ op: 'select', columns });
          return this;
        },
        eq(column, value) {
          calls.push({ op: 'eq', column, value });
          return this;
        },
        order(column, options) {
          calls.push({ op: 'order', column, options });
          return this;
        },
        limit(value) {
          calls.push({ op: 'limit', value });
          return Promise.resolve({ data: [{ id: 'session-1' }], error: null });
        },
      };
    },
  };

  const rows = await listCoachSessions({ db, workspaceId: 'ws-1', userId: 'u-1', limit: 12 });

  assert.deepEqual(rows, [{ id: 'session-1' }]);
  assert.deepEqual(calls, [
    { op: 'from', table: 'ai_coach_sessions' },
    { op: 'select', columns: 'id,workspace_id,user_id,goal_text,summary,items,created_at' },
    { op: 'eq', column: 'workspace_id', value: 'ws-1' },
    { op: 'eq', column: 'user_id', value: 'u-1' },
    { op: 'order', column: 'created_at', options: { ascending: false } },
    { op: 'limit', value: 12 },
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- test/ai-coach.test.js
```

Expected: FAIL with an import error because `src/lib/app/ai-coach.js` does not exist.

- [ ] **Step 3: Implement `src/lib/app/ai-coach.js`**

Create `src/lib/app/ai-coach.js` with:

```js
const MAX_GOAL_LENGTH = 240;
const MAX_SUMMARY_LENGTH = 240;
const MAX_REASON_LENGTH = 220;
const MAX_NEXT_STEP_LENGTH = 360;
const MAX_NOTE_LENGTH = 220;
const DEFAULT_MAX_ITEMS = 6;
const MAX_ITEMS = 8;
const MAX_LEVEL = 4;

export function buildCoachLevelPlanRequest({ goalText, profileSkills = [], levelLabels = [], maxItems = DEFAULT_MAX_ITEMS }) {
  return {
    action: 'coach_level_plan',
    goalText: cleanText(goalText, MAX_GOAL_LENGTH),
    profileSkills: profileSkills.map(toCoachProfileSkill).filter(Boolean),
    levelLabels: Array.isArray(levelLabels) ? levelLabels.map((label) => cleanText(label, 40)).filter(Boolean).slice(0, 8) : [],
    maxItems: clampInteger(maxItems, 1, MAX_ITEMS),
  };
}

export function parseCoachLevelPlanText(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonText = fenced ? fenced[1].trim() : raw;

  try {
    return JSON.parse(jsonText);
  } catch {
    const error = new Error('invalid_json');
    error.code = 'invalid_json';
    throw error;
  }
}

export function validateCoachLevelPlanPayload({ payload, profileSkills = [], maxItems = DEFAULT_MAX_ITEMS }) {
  const limit = clampInteger(maxItems, 1, MAX_ITEMS);
  const profileById = new Map(profileSkills.map((skill) => [coachSkillId(skill), skill]).filter(([id]) => id));
  const seen = new Set();
  const items = [];

  for (const item of Array.isArray(payload?.items) ? payload.items : []) {
    const skillId = cleanText(item?.skill_id, 120);
    if (!skillId || seen.has(skillId)) continue;

    const profileSkill = profileById.get(skillId);
    if (!profileSkill) continue;

    const currentLevel = clampInteger(item?.current_level, 0, MAX_LEVEL);
    const profileLevel = clampInteger(profileSkill.level, 0, MAX_LEVEL);
    const targetLevel = clampInteger(item?.target_level, 0, MAX_LEVEL);
    if (currentLevel !== profileLevel || targetLevel <= currentLevel || targetLevel > MAX_LEVEL) continue;

    seen.add(skillId);
    items.push({
      skill_id: skillId,
      current_level: currentLevel,
      target_level: targetLevel,
      reason: cleanText(item?.reason, MAX_REASON_LENGTH),
      next_step: cleanText(item?.next_step, MAX_NEXT_STEP_LENGTH),
    });
    if (items.length >= limit) break;
  }

  if (!items.length) {
    throw new Error('coach_plan_empty');
  }

  return {
    summary: cleanText(payload?.summary, MAX_SUMMARY_LENGTH) || 'Kế hoạch tập trung nâng cấp kỹ năng tiếp theo.',
    items,
  };
}

export function buildCoachSessionInsert({ workspaceId, userId, goalText, plan }) {
  return {
    workspace_id: workspaceId,
    user_id: userId,
    goal_text: cleanText(goalText, MAX_GOAL_LENGTH),
    summary: cleanText(plan?.summary, MAX_SUMMARY_LENGTH),
    items: Array.isArray(plan?.items) ? plan.items : [],
  };
}

export async function saveCoachSession({ db, workspaceId, userId, goalText, plan }) {
  const row = buildCoachSessionInsert({ workspaceId, userId, goalText, plan });
  const { data, error } = await db
    .from('ai_coach_sessions')
    .insert(row)
    .select('id,workspace_id,user_id,goal_text,summary,items,created_at')
    .single();
  if (error) throw new Error('save coach session: ' + error.message);
  return data;
}

export async function listCoachSessions({ db, workspaceId, userId, limit = 10 }) {
  const { data, error } = await db
    .from('ai_coach_sessions')
    .select('id,workspace_id,user_id,goal_text,summary,items,created_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(clampInteger(limit, 1, 20));
  if (error) throw new Error('load coach sessions: ' + error.message);
  return data || [];
}

function toCoachProfileSkill(skill) {
  const skillId = coachSkillId(skill);
  const name = cleanText(skill?.name || skill?.id, 120);
  if (!skillId || !name) return null;
  return {
    skill_id: skillId,
    name,
    category: cleanText(skill?.category || 'Custom', 80),
    level: clampInteger(skill?.level, 0, MAX_LEVEL),
    interest: clampInteger(skill?.interest, 0, 3),
    note: cleanText(skill?.note, MAX_NOTE_LENGTH),
  };
}

function coachSkillId(skill) {
  return cleanText(skill?.id || skill?.skill_id || skill?.skillId, 120);
}

function cleanText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function clampInteger(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
npm run test -- test/ai-coach.test.js
```

Expected: PASS for all tests in `test/ai-coach.test.js`.

- [ ] **Step 5: Commit helper work**

Run:

```bash
git add src/lib/app/ai-coach.js test/ai-coach.test.js
git commit -m "test: add ai coach plan helpers"
```

Expected: commit succeeds.

## Task 2: Add Coach Action To The AI Proxy

**Files:**
- Modify: `api/ai-proxy.js`
- Modify: `test/ai-proxy-role-suggestions.test.js`

- [ ] **Step 1: Add failing proxy tests**

Append these imports to the existing import from `../api/ai-proxy.js` in `test/ai-proxy-role-suggestions.test.js`:

```js
  buildCoachLevelPlanPrompt,
  handleCoachLevelPlanRequest,
```

Append these tests to `test/ai-proxy-role-suggestions.test.js`:

```js
test('buildCoachLevelPlanPrompt includes goal, personal skills, and JSON contract', () => {
  const prompt = buildCoachLevelPlanPrompt({
    goalText: 'Middle Frontend',
    profileSkills: [{ skill_id: 'react', name: 'React', category: 'Frontend', level: 2, interest: 3, note: 'Forms' }],
    levelLabels: ['Học', 'Cơ bản', 'Làm được', 'Thành thạo', 'Mentor'],
    maxItems: 4,
  });

  assert.match(prompt, /Middle Frontend/);
  assert.match(prompt, /React/);
  assert.match(prompt, /target_level/);
  assert.match(prompt, /Return JSON only/i);
  assert.doesNotMatch(prompt, /workspace|team coverage/i);
});

test('handleCoachLevelPlanRequest validates Gemini output against personal skills', async () => {
  const response = await handleCoachLevelPlanRequest({
    body: {
      goalText: 'Middle Frontend',
      profileSkills: [
        { skill_id: 'react', name: 'React', category: 'Frontend', level: 2, interest: 3, note: 'Forms' },
        { skill_id: 'typescript', name: 'TypeScript', category: 'Frontend', level: 1, interest: 2, note: '' },
      ],
      levelLabels: ['Học', 'Cơ bản', 'Làm được', 'Thành thạo', 'Mentor'],
      maxItems: 2,
    },
    apiKey: 'gemini-key',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                summary: 'Focus frontend fundamentals',
                items: [
                  { skill_id: 'react', current_level: 2, target_level: 3, reason: 'Core UI skill', next_step: 'Build a stateful screen' },
                  { skill_id: 'unknown', current_level: 1, target_level: 2, reason: 'Unknown', next_step: 'Nope' },
                  { skill_id: 'typescript', current_level: 1, target_level: 2, reason: 'Safer UI data', next_step: 'Type API responses' },
                ],
              }),
            }],
          },
        }],
      }),
    }),
  });

  assert.deepEqual(response, {
    status: 200,
    body: {
      summary: 'Focus frontend fundamentals',
      items: [
        { skill_id: 'react', current_level: 2, target_level: 3, reason: 'Core UI skill', next_step: 'Build a stateful screen' },
        { skill_id: 'typescript', current_level: 1, target_level: 2, reason: 'Safer UI data', next_step: 'Type API responses' },
      ],
    },
  });
});

test('handleCoachLevelPlanRequest rejects empty goal before Gemini call', async () => {
  const response = await handleCoachLevelPlanRequest({
    body: {
      goalText: '',
      profileSkills: [{ skill_id: 'react', name: 'React', category: 'Frontend', level: 2, interest: 3, note: '' }],
    },
    apiKey: 'gemini-key',
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'goal_text_required');
});

test('handleCoachLevelPlanRequest rejects empty personal skills before Gemini call', async () => {
  const response = await handleCoachLevelPlanRequest({
    body: { goalText: 'Middle Frontend', profileSkills: [] },
    apiKey: 'gemini-key',
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'profile_skills_required');
});

test('handleCoachLevelPlanRequest returns validation error for malformed Gemini JSON', async () => {
  const response = await handleCoachLevelPlanRequest({
    body: {
      goalText: 'Middle Frontend',
      profileSkills: [{ skill_id: 'react', name: 'React', category: 'Frontend', level: 2, interest: 3, note: '' }],
    },
    apiKey: 'gemini-key',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'not json' }] } }],
      }),
    }),
  });

  assert.equal(response.status, 502);
  assert.equal(response.body.error, 'invalid_ai_json');
});

test('handleCoachLevelPlanRequest returns validation error when no coach items survive', async () => {
  const response = await handleCoachLevelPlanRequest({
    body: {
      goalText: 'Middle Frontend',
      profileSkills: [{ skill_id: 'react', name: 'React', category: 'Frontend', level: 2, interest: 3, note: '' }],
    },
    apiKey: 'gemini-key',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                summary: 'Invalid',
                items: [{ skill_id: 'react', current_level: 2, target_level: 2, reason: 'Same', next_step: 'No progress' }],
              }),
            }],
          },
        }],
      }),
    }),
  });

  assert.equal(response.status, 502);
  assert.equal(response.body.error, 'invalid_coach_plan');
});
```

- [ ] **Step 2: Run proxy tests to verify they fail**

Run:

```bash
npm run test -- test/ai-proxy-role-suggestions.test.js
```

Expected: FAIL because `buildCoachLevelPlanPrompt` and `handleCoachLevelPlanRequest` are not exported.

- [ ] **Step 3: Modify `api/ai-proxy.js` imports**

Add this import near the existing role suggestion imports:

```js
import {
  buildCoachLevelPlanRequest,
  parseCoachLevelPlanText,
  validateCoachLevelPlanPayload,
} from '../src/lib/app/ai-coach.js';
```

- [ ] **Step 4: Add coach constants and prompt builder**

Add after the existing role prompt constants:

```js
const MAX_COACH_PROMPT_LENGTH = 12000;

export function buildCoachLevelPlanPrompt({ goalText, profileSkills, levelLabels, maxItems }) {
  const skillsJson = JSON.stringify(profileSkills, null, 2);
  const labelsJson = JSON.stringify(levelLabels || [], null, 2);

  return [
    'You are a personal skill coach for one user.',
    'Use only the personal skills supplied below.',
    'Do not infer or mention data about other people, managers, or organization-level coverage.',
    `Goal: ${goalText}`,
    `Return up to ${maxItems} level-up items.`,
    'Each item must use a skill_id from the personal skills exactly.',
    'target_level must be greater than current_level and no higher than 4.',
    'Return JSON only with this shape:',
    '{"summary":"short summary","items":[{"skill_id":"react","current_level":2,"target_level":3,"reason":"short reason","next_step":"concrete next step"}]}',
    'Level labels:',
    labelsJson,
    'Personal skills:',
    skillsJson,
  ].join('\n');
}
```

- [ ] **Step 5: Add `handleCoachLevelPlanRequest`**

Add before `handleGenericPromptRequest`:

```js
export async function handleCoachLevelPlanRequest({ body, apiKey, fetchImpl = fetch }) {
  const request = buildCoachLevelPlanRequest({
    goalText: body?.goalText,
    profileSkills: body?.profileSkills,
    levelLabels: body?.levelLabels,
    maxItems: body?.maxItems ?? 6,
  });

  if (!request.goalText) {
    return { status: 400, body: { error: 'goal_text_required' } };
  }

  if (!request.profileSkills.length) {
    return { status: 400, body: { error: 'profile_skills_required' } };
  }

  if (!apiKey) {
    return { status: 500, body: { error: 'missing_gemini_api_key' } };
  }

  const prompt = buildCoachLevelPlanPrompt(request);
  if (prompt.length > MAX_COACH_PROMPT_LENGTH) {
    return { status: 400, body: { error: 'prompt_too_large' } };
  }

  let response;
  try {
    response = await fetchImpl(`${GEMINI_FLASH_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
  } catch {
    return { status: 502, body: { error: 'upstream_fetch_failed' } };
  }

  if (!response.ok) {
    const detail = await response.text();
    return { status: 502, body: { error: 'upstream', detail } };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { status: 502, body: { error: 'upstream_json_invalid' } };
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  let payload;
  try {
    payload = parseCoachLevelPlanText(text);
  } catch (error) {
    if (error?.code === 'invalid_json') {
      return { status: 502, body: { error: 'invalid_ai_json' } };
    }
    throw error;
  }

  try {
    const validated = validateCoachLevelPlanPayload({
      payload,
      profileSkills: request.profileSkills,
      maxItems: request.maxItems,
    });
    return { status: 200, body: validated };
  } catch {
    return { status: 502, body: { error: 'invalid_coach_plan' } };
  }
}
```

- [ ] **Step 6: Route the new action in the default handler**

In `handler`, add this block after the `suggest_role_skills` branch and before the generic prompt path:

```js
  if (req.body?.action === 'coach_level_plan') {
    const response = await handleCoachLevelPlanRequest({
      body: req.body,
      apiKey: process.env.GEMINI_API_KEY,
      fetchImpl: fetch,
    });
    return res.status(response.status).json(response.body);
  }
```

- [ ] **Step 7: Run proxy and coach tests**

Run:

```bash
npm run test -- test/ai-coach.test.js test/ai-proxy-role-suggestions.test.js
```

Expected: PASS for both test files.

- [ ] **Step 8: Commit proxy work**

Run:

```bash
git add api/ai-proxy.js test/ai-proxy-role-suggestions.test.js
git commit -m "feat: add ai coach proxy action"
```

Expected: commit succeeds.

## Task 3: Add Coach Session Migration

**Files:**
- Create: `migrations/006_ai_coach_sessions.sql`
- Modify: `test/skill-map-data.test.js`

- [ ] **Step 1: Add failing migration test**

Append this test to `test/skill-map-data.test.js`:

```js
test('ai coach migration creates personal session history with scoped RLS', () => {
  const sql = readFileSync(new URL('../migrations/006_ai_coach_sessions.sql', import.meta.url), 'utf8');

  assert.match(sql, /create table if not exists app_skill_map\.ai_coach_sessions/);
  assert.match(sql, /workspace_id uuid not null references public\.workspaces\(id\) on delete cascade/);
  assert.match(sql, /user_id uuid not null references auth\.users\(id\) on delete cascade/);
  assert.match(sql, /goal_text text not null/);
  assert.match(sql, /summary text not null/);
  assert.match(sql, /items jsonb not null default '\[\]'::jsonb/);
  assert.match(sql, /check \(jsonb_typeof\(items\) = 'array'\)/);
  assert.match(sql, /create index if not exists idx_ai_coach_sessions_workspace_user_created/);
  assert.match(sql, /grant select, insert on app_skill_map\.ai_coach_sessions to authenticated/);
  assert.match(sql, /alter table app_skill_map\.ai_coach_sessions enable row level security/);
  assert.match(sql, /create policy "ai_coach_sessions_select"/);
  assert.match(sql, /create policy "ai_coach_sessions_insert"/);
  assert.match(sql, /public\.can_access_app_data\(workspace_id, 'skill-map'\)/);
  assert.match(sql, /user_id = auth\.uid\(\)/);
});
```

- [ ] **Step 2: Run migration test to verify it fails**

Run:

```bash
npm run test -- test/skill-map-data.test.js
```

Expected: FAIL because `migrations/006_ai_coach_sessions.sql` does not exist.

- [ ] **Step 3: Create migration**

Create `migrations/006_ai_coach_sessions.sql` with:

```sql
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
```

- [ ] **Step 4: Run migration tests**

Run:

```bash
npm run test -- test/skill-map-data.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit migration work**

Run:

```bash
git add migrations/006_ai_coach_sessions.sql test/skill-map-data.test.js
git commit -m "feat: add ai coach session migration"
```

Expected: commit succeeds.

## Task 4: Add Coach Screen Wiring And Data Flow

**Files:**
- Modify: `src/App.jsx`
- Test: use existing helper tests from `test/ai-coach.test.js`

- [ ] **Step 1: Update imports in `src/App.jsx`**

Add these imports near other `src/lib/app` imports:

```js
import {
  buildCoachLevelPlanRequest,
  listCoachSessions,
  saveCoachSession,
} from './lib/app/ai-coach.js';
```

- [ ] **Step 2: Add coach navigation state**

In `SkillMapApp`, keep the existing `tab` state and add `coach` as a supported value. No separate router is needed.

Add a prop to `Overview` where it is rendered:

```jsx
          onCoach={() => setTab('coach')}
```

Add a coach screen branch after the profile branch and before the report branch:

```jsx
      {tab === 'coach' && (
        <CoachScreen
          ctx={ctx}
          activeScope={activeScope}
          profileSkills={profileSkills}
          skillCatalog={skills}
          onBack={() => setTab('overview')}
          onProfile={() => setTab('profile')}
        />
      )}
```

- [ ] **Step 3: Add `onCoach` to `Overview` signature**

Change the `Overview` props signature to include `onCoach`:

```js
function Overview({
  skills,
  members,
  currentMember,
  onSearch,
  onReport,
  onProfile,
  onCoach,
  onSelectSkill,
  selectedSkill,
  profileSkills,
  teamCoverage,
  isWorkspaceAdmin,
  saving,
  onApprovePendingSkill,
  onMergePendingSkill,
  onRejectPendingSkill,
}) {
```

- [ ] **Step 4: Add the overview quick card**

In the `quick-grid`, add a third quick card after the search card:

```jsx
          <button className="quick-card" type="button" onClick={onCoach}>
            <span className="quick-icon coach-icon" aria-hidden="true">
              <i /><i /><i />
            </span>
            <span>
              <strong>AI Coach</strong>
              <small>Lập kế hoạch nâng level</small>
            </span>
          </button>
```

- [ ] **Step 5: Add `CoachScreen` component**

Add this component before `ReportScreen`:

```jsx
function CoachScreen({ ctx, activeScope, profileSkills, skillCatalog, onBack, onProfile }) {
  const [goalText, setGoalText] = useState('');
  const [latestPlan, setLatestPlan] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const skillMap = useMemo(() => new Map(skillCatalog.map((skill) => [skill.id, skill])), [skillCatalog]);
  const hasProfileSkills = profileSkills.length > 0;
  const canGenerate = hasProfileSkills && goalText.trim() && !generating;

  const reloadSessions = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const rows = await listCoachSessions({
        db,
        workspaceId: activeScope.workspaceId,
        userId: ctx.userId,
        limit: 10,
      });
      setSessions(rows);
      setLatestPlan((current) => current || rows[0] || null);
    } catch (historyError) {
      setError(historyError);
    } finally {
      setLoadingHistory(false);
    }
  }, [activeScope.workspaceId, ctx.userId]);

  useEffect(() => {
    reloadSessions();
  }, [reloadSessions]);

  async function generatePlan() {
    const request = buildCoachLevelPlanRequest({
      goalText,
      profileSkills,
      levelLabels: LEVEL_LABELS,
      maxItems: 6,
    });
    if (!request.goalText || !request.profileSkills.length) return;

    setGenerating(true);
    setError(null);
    setSaveError(null);
    try {
      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.token}`,
          'X-Workspace-Id': activeScope.workspaceId,
          'X-Home-Workspace-Id': ctx.workspaceId,
        },
        body: JSON.stringify(request),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error || `coach failed: ${response.status}`);
      }

      const transientPlan = {
        id: `local-${Date.now()}`,
        workspace_id: activeScope.workspaceId,
        user_id: ctx.userId,
        goal_text: request.goalText,
        summary: json.summary,
        items: json.items || [],
        created_at: new Date().toISOString(),
      };
      setLatestPlan(transientPlan);

      try {
        const saved = await saveCoachSession({
          db,
          workspaceId: activeScope.workspaceId,
          userId: ctx.userId,
          goalText: request.goalText,
          plan: json,
        });
        setLatestPlan(saved);
        await reloadSessions();
      } catch (sessionError) {
        setSaveError(sessionError);
      }
    } catch (coachError) {
      setError(coachError);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="screen compact-screen coach-screen">
      <TopBar title="AI Coach" onBack={onBack} />

      {!hasProfileSkills && (
        <section className="empty-panel">
          <strong>Chưa có kỹ năng cá nhân</strong>
          <p>Thêm kỹ năng trong hồ sơ trước khi tạo kế hoạch nâng level.</p>
          <button type="button" onClick={onProfile}>Mở hồ sơ cá nhân</button>
        </section>
      )}

      {hasProfileSkills && (
        <section className="coach-goal-panel">
          <label className="text-field">
            <span>Mục tiêu</span>
            <textarea
              rows="3"
              value={goalText}
              maxLength="240"
              onChange={(event) => setGoalText(event.target.value)}
              placeholder="Ví dụ: Muốn lên Middle Frontend, muốn cải thiện Docker..."
            />
          </label>
          <button type="button" onClick={generatePlan} disabled={!canGenerate}>
            {generating ? 'Đang tạo...' : 'Tạo kế hoạch'}
          </button>
        </section>
      )}

      {error && (
        <section className="data-error" role="alert">
          <strong>Chưa tạo được kế hoạch</strong>
          <p>{error.message}</p>
        </section>
      )}

      {saveError && (
        <section className="data-error" role="alert">
          <strong>Kế hoạch đã tạo nhưng chưa lưu vào lịch sử</strong>
          <p>{saveError.message}</p>
        </section>
      )}

      {latestPlan && (
        <CoachPlanCard session={latestPlan} skillMap={skillMap} featured />
      )}

      <section className="coach-history">
        <header>
          <strong>Lịch sử coach</strong>
          <small>{loadingHistory ? 'Đang tải...' : `${sessions.length} phiên gần nhất`}</small>
        </header>
        {sessions.map((session) => (
          <button key={session.id} type="button" onClick={() => setLatestPlan(session)}>
            <span>{session.goal_text}</span>
            <small>{formatDateTime(session.created_at)}</small>
          </button>
        ))}
        {!loadingHistory && sessions.length === 0 && hasProfileSkills && (
          <p>Chưa có lịch sử. Tạo kế hoạch đầu tiên để lưu lại.</p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Add coach card helpers**

Add these components/functions after `CoachScreen`:

```jsx
function CoachPlanCard({ session, skillMap, featured = false }) {
  return (
    <section className={featured ? 'coach-plan coach-plan--featured' : 'coach-plan'}>
      <header>
        <span>{formatDateTime(session.created_at)}</span>
        <strong>{session.goal_text}</strong>
        <p>{session.summary}</p>
      </header>
      <div className="coach-plan-items">
        {(session.items || []).map((item) => {
          const skill = skillMap.get(item.skill_id) || { name: item.skill_id, icon: 'SK', iconUrl: null };
          return (
            <article className="coach-plan-item" key={item.skill_id}>
              <SkillIcon skill={skill} compact />
              <div>
                <strong>{skill.name}</strong>
                <small>{LEVEL_LABELS[item.current_level]} -> {LEVEL_LABELS[item.target_level]}</small>
                <p>{item.reason}</p>
                <em>{item.next_step}</em>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
}
```

- [ ] **Step 7: Add `coach` to bottom nav handling**

Do not add a new bottom nav item. Keep `BottomNav` unchanged so the coach screen is opened from overview only. The active bottom nav will show no selected item while `tab === 'coach'`, matching the "separate screen, no new tab" design.

- [ ] **Step 8: Run build to catch JSX errors**

Run:

```bash
npm run build
```

Expected: PASS and Vite prints a production build summary.

- [ ] **Step 9: Commit UI wiring**

Run:

```bash
git add src/App.jsx
git commit -m "feat: add ai coach screen"
```

Expected: commit succeeds.

## Task 5: Style The Coach Screen

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add coach icon and screen styles**

Append these styles to `src/App.css`:

```css
.coach-icon {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  align-content: center;
  justify-content: center;
}

.coach-icon i {
  width: 6px;
  height: 18px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.8;
}

.coach-icon i:nth-child(1) {
  height: 10px;
}

.coach-icon i:nth-child(2) {
  height: 22px;
}

.coach-screen {
  gap: 14px;
}

.coach-goal-panel,
.coach-plan,
.coach-history {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(8, 15, 20, 0.78);
  padding: 14px;
}

.coach-goal-panel {
  display: grid;
  gap: 12px;
}

.coach-goal-panel textarea {
  width: 100%;
  resize: vertical;
}

.coach-goal-panel button,
.coach-history button {
  min-height: 44px;
}

.coach-plan {
  display: grid;
  gap: 12px;
}

.coach-plan--featured {
  border-color: rgba(100, 223, 196, 0.32);
}

.coach-plan header {
  display: grid;
  gap: 4px;
}

.coach-plan header span,
.coach-plan header p,
.coach-history small,
.coach-history p {
  color: var(--muted);
}

.coach-plan-items {
  display: grid;
  gap: 10px;
}

.coach-plan-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: start;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.055);
}

.coach-plan-item div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.coach-plan-item small {
  color: var(--accent);
}

.coach-plan-item p,
.coach-plan-item em {
  margin: 0;
  color: var(--muted);
  font-style: normal;
  overflow-wrap: anywhere;
}

.coach-history {
  display: grid;
  gap: 10px;
}

.coach-history header,
.coach-history button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.coach-history button {
  width: 100%;
  text-align: left;
  border-radius: 8px;
}

.coach-history button span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit styles**

Run:

```bash
git add src/App.css
git commit -m "style: polish ai coach screen"
```

Expected: commit succeeds.

## Task 6: Full Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm run test
```

Expected: PASS for all `node:test` suites.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS with `dist/` build output.

- [ ] **Step 3: Start local dev server**

Run:

```bash
npm run dev
```

Expected: Vite starts on `http://localhost:5173/`. If port `5173` is busy, use the next Vite-provided localhost URL.

- [ ] **Step 4: Manual browser pass**

Open the local URL and verify:

- Overview shows a new `AI Coach` quick card.
- Tapping `AI Coach` opens a dedicated screen with a back button.
- If the current user has no profile skills, the empty state appears and no AI request is made.
- With profile skills present, typing `Muốn lên Middle Frontend` enables `Tạo kế hoạch`.
- When `/api/ai-proxy` succeeds, the latest plan renders skill names, current levels, target levels, reasons, and next steps.
- The saved session appears in `Lịch sử coach`.
- If session saving fails, the generated plan remains visible and the history-save error appears.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: no uncommitted tracked changes from this implementation. Untracked files that existed before the work, such as `.agents/`, `.playwright-mcp/`, `plans/2026-06-01-remove-mock-runtime/`, and `skills-lock.json`, may still be present and should not be added unless the user explicitly requests it.

## Self-Review Checklist

- Spec coverage:
  - Overview entry point is covered by Task 4.
  - Dedicated coach screen is covered by Task 4.
  - Personal-only prompt data is covered by Tasks 1 and 2.
  - Saved history is covered by Tasks 1, 3, and 4.
  - Strict structured AI validation is covered by Tasks 1 and 2.
  - Error behavior is covered by Tasks 2 and 4.
  - Tests, build, and manual pass are covered by Task 6.
- Red-flag scan:
  - No incomplete task markers, deferred implementation notes, or undefined follow-up steps remain.
- Type consistency:
  - The request uses `goalText`, `profileSkills`, `levelLabels`, and `maxItems`.
  - The AI/session plan uses `summary` and `items`.
  - Item fields are consistently `skill_id`, `current_level`, `target_level`, `reason`, and `next_step`.
