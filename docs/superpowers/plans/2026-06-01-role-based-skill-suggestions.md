# Role-Based Skill Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add role-based skill suggestions to the profile add-skill flow using Gemini JSON suggestions with local fallback, restricted to the existing skill catalog.

**Architecture:** Put role suggestion domain logic in a focused app helper, reuse `STANDARD_SKILLS`/`PRESET_SKILLS`, and keep server AI validation in `api/ai-proxy.js`. The UI panel lives inside `ProfileScreen` add mode and only selects existing catalog skills into the existing draft/save flow.

**Tech Stack:** Vite, React 18, Node test runner, Vercel Serverless Functions, Gemini API via `GEMINI_API_KEY`.

---

## File Structure

- Create `src/lib/app/role-suggestions.js`: role fallback data, normalized role matching, Gemini JSON parsing/validation, catalog payload building, profile filtering.
- Create `test/role-suggestions.test.js`: unit tests for parser, validation, fallback, catalog payload, and profile filtering.
- Modify `api/ai-proxy.js`: add `action: "suggest_role_skills"` path with request validation, Gemini prompt, JSON validation, and structured errors.
- Modify `src/App.jsx`: add role suggestion state/request handling in `ProfileScreen`, render compact suggestion panel, and select suggested catalog skills into the existing draft.
- Modify `src/App.css`: add compact styles for the role suggestion panel using existing chip/form visual language.

## Task 1: Role Suggestion Helper Tests

**Files:**
- Create: `test/role-suggestions.test.js`
- Create later: `src/lib/app/role-suggestions.js`

- [ ] **Step 1: Write failing helper tests**

Create `test/role-suggestions.test.js` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROLE_PRESETS,
  buildCatalogPayload,
  filterSuggestedSkills,
  parseRoleSuggestionText,
  suggestRoleSkillsFallback,
  validateRoleSuggestionPayload,
} from '../src/lib/app/role-suggestions.js';
import { STANDARD_SKILLS } from '../src/lib/app/skill-catalog.js';

const catalogKeys = new Set(STANDARD_SKILLS.map((skill) => skill.key));

test('role presets expose the approved quick role labels', () => {
  assert.deepEqual(
    ROLE_PRESETS.map((role) => role.label),
    ['AI Engineer', 'Frontend Engineer', 'Backend Engineer', 'DevOps Engineer', 'Product Designer'],
  );
});

test('buildCatalogPayload keeps only compact public catalog fields', () => {
  const payload = buildCatalogPayload(STANDARD_SKILLS).find((skill) => skill.key === 'aiml.rag');

  assert.deepEqual(Object.keys(payload).sort(), ['aliases', 'category', 'key', 'name', 'skillType'].sort());
  assert.equal(payload.key, 'aiml.rag');
  assert.equal(payload.name, 'RAG');
  assert.equal(Array.isArray(payload.aliases), true);
});

test('parseRoleSuggestionText accepts strict JSON', () => {
  const parsed = parseRoleSuggestionText(JSON.stringify({
    role: 'AI Engineer',
    suggestions: [
      { catalog_key: 'aiml.rag', reason: 'Retrieval for LLM apps' },
    ],
  }));

  assert.equal(parsed.role, 'AI Engineer');
  assert.equal(parsed.suggestions[0].catalog_key, 'aiml.rag');
});

test('parseRoleSuggestionText accepts fenced JSON', () => {
  const parsed = parseRoleSuggestionText('```json\n{"role":"AI Engineer","suggestions":[{"catalog_key":"aiml.embeddings"}]}\n```');

  assert.equal(parsed.suggestions[0].catalog_key, 'aiml.embeddings');
});

test('parseRoleSuggestionText rejects malformed JSON', () => {
  assert.throws(
    () => parseRoleSuggestionText('not json'),
    /invalid_json/,
  );
});

test('validateRoleSuggestionPayload drops unknown keys, duplicates, and clamps output', () => {
  const validated = validateRoleSuggestionPayload({
    payload: {
      role: 'AI Engineer',
      suggestions: [
        { catalog_key: 'aiml.rag', reason: 'Use private knowledge' },
        { catalog_key: 'unknown.skill', reason: 'Nope' },
        { catalog_key: 'aiml.rag', reason: 'Duplicate' },
        { catalog_key: 'aiml.embeddings', reason: 'Vector search' },
      ],
    },
    catalogKeys,
    maxSuggestions: 1,
  });

  assert.deepEqual(validated, {
    role: 'AI Engineer',
    suggestions: [
      { catalog_key: 'aiml.rag', reason: 'Use private knowledge' },
    ],
  });
});

test('validateRoleSuggestionPayload trims long reasons and handles no usable keys as empty success', () => {
  const validated = validateRoleSuggestionPayload({
    payload: {
      role: 'Mystery',
      suggestions: [
        { catalog_key: 'unknown.skill', reason: 'x'.repeat(300) },
      ],
    },
    catalogKeys,
    maxSuggestions: 10,
  });

  assert.deepEqual(validated, {
    role: 'Mystery',
    suggestions: [],
  });
});

test('suggestRoleSkillsFallback maps AI engineer aliases to catalog keys', () => {
  const suggestions = suggestRoleSkillsFallback('ML engineer', STANDARD_SKILLS);
  const keys = suggestions.map((item) => item.catalog_key);

  assert.equal(keys.includes('aiml.rag'), true);
  assert.equal(keys.includes('aiml.llm_integration'), true);
  assert.equal(keys.includes('backend.python'), true);
});

test('suggestRoleSkillsFallback filters stale keys through active catalog', () => {
  const tinyCatalog = STANDARD_SKILLS.filter((skill) => skill.key === 'aiml.rag');

  assert.deepEqual(suggestRoleSkillsFallback('AI engineer', tinyCatalog), [
    { catalog_key: 'aiml.rag', reason: 'Relevant to AI Engineer' },
  ]);
});

test('filterSuggestedSkills maps catalog keys to profile catalog and removes existing profile skills', () => {
  const profileCatalog = [
    { id: 'aiml.rag', skillId: 'skill-rag', name: 'RAG' },
    { id: 'aiml.embeddings', skillId: 'skill-embeddings', name: 'Embeddings' },
  ];
  const profileSkills = [{ id: 'aiml.rag' }, { skillId: 'skill-other' }];

  assert.deepEqual(
    filterSuggestedSkills({
      suggestions: [
        { catalog_key: 'aiml.rag', reason: 'Already added' },
        { catalog_key: 'aiml.embeddings', reason: 'Useful for search' },
        { catalog_key: 'unknown.skill', reason: 'Unknown' },
      ],
      profileSkillCatalog: profileCatalog,
      profileSkills,
    }),
    [
      {
        skill: { id: 'aiml.embeddings', skillId: 'skill-embeddings', name: 'Embeddings' },
        reason: 'Useful for search',
      },
    ],
  );
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `npm run test -- test/role-suggestions.test.js`

Expected: FAIL with module not found for `src/lib/app/role-suggestions.js`.

## Task 2: Role Suggestion Helper Implementation

**Files:**
- Create: `src/lib/app/role-suggestions.js`
- Test: `test/role-suggestions.test.js`

- [ ] **Step 1: Implement the helper module**

Create `src/lib/app/role-suggestions.js`:

```js
import { normalizeSkillName } from './skill-catalog.js';

export const ROLE_PRESETS = [
  { label: 'AI Engineer', aliases: ['ai engineer', 'ml engineer', 'machine learning engineer', 'llm engineer', 'ai dev'] },
  { label: 'Frontend Engineer', aliases: ['frontend engineer', 'front end engineer', 'frontend dev', 'react developer', 'web developer'] },
  { label: 'Backend Engineer', aliases: ['backend engineer', 'back end engineer', 'backend dev', 'api developer', 'server developer'] },
  { label: 'DevOps Engineer', aliases: ['devops engineer', 'devops', 'platform engineer', 'cloud engineer', 'sre'] },
  { label: 'Product Designer', aliases: ['product designer', 'ui designer', 'ux designer', 'designer'] },
];

const ROLE_SKILL_KEYS = new Map([
  ['AI Engineer', ['aiml.prompt_engineering', 'aiml.llm_integration', 'aiml.rag', 'aiml.embeddings', 'aiml.vector_databases', 'aiml.machine_learning', 'backend.python', 'backend.rest_api', 'data.postgresql']],
  ['Frontend Engineer', ['frontend.react', 'frontend.nextjs', 'frontend.typescript', 'frontend.tailwind', 'frontend.accessibility', 'frontend.state_management']],
  ['Backend Engineer', ['backend.nodejs', 'backend.python', 'backend.fastapi', 'backend.rest_api', 'data.postgresql', 'data.redis', 'devops.docker']],
  ['DevOps Engineer', ['devops.docker', 'devops.kubernetes', 'devops.aws', 'devops.gcp', 'devops.azure', 'devops.ci_cd', 'devops.iac', 'devops.monitoring']],
  ['Product Designer', ['design.ux_research', 'design.ui_design', 'design.design_systems', 'design.prototyping', 'design.figma', 'design.product_management']],
]);

const MAX_REASON_LENGTH = 160;

export function buildCatalogPayload(catalog = []) {
  return catalog.map((skill) => ({
    key: skill.key,
    name: skill.name,
    category: skill.category,
    skillType: skill.skillType,
    aliases: [...(skill.aliases || [])],
  }));
}

export function parseRoleSuggestionText(text) {
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

export function validateRoleSuggestionPayload({ payload, catalogKeys, maxSuggestions = 10 }) {
  const keySet = catalogKeys instanceof Set ? catalogKeys : new Set(catalogKeys || []);
  const limit = clampInteger(maxSuggestions, 1, 12);
  const seen = new Set();
  const suggestions = [];

  for (const item of Array.isArray(payload?.suggestions) ? payload.suggestions : []) {
    const catalogKey = String(item?.catalog_key || '').trim();
    if (!catalogKey || !keySet.has(catalogKey) || seen.has(catalogKey)) continue;
    seen.add(catalogKey);
    suggestions.push({
      catalog_key: catalogKey,
      reason: String(item?.reason || '').trim().slice(0, MAX_REASON_LENGTH),
    });
    if (suggestions.length >= limit) break;
  }

  return {
    role: String(payload?.role || '').trim().slice(0, 80),
    suggestions,
  };
}

export function suggestRoleSkillsFallback(roleText, catalog = [], maxSuggestions = 10) {
  const role = matchFallbackRole(roleText);
  if (!role) return [];

  const activeKeys = new Set(catalog.map((skill) => skill.key));
  return (ROLE_SKILL_KEYS.get(role.label) || [])
    .filter((key) => activeKeys.has(key))
    .slice(0, clampInteger(maxSuggestions, 1, 12))
    .map((key) => ({
      catalog_key: key,
      reason: `Relevant to ${role.label}`,
    }));
}

export function filterSuggestedSkills({ suggestions = [], profileSkillCatalog = [], profileSkills = [] }) {
  const catalogByKey = new Map(profileSkillCatalog.map((skill) => [skill.id, skill]));
  const existingKeys = new Set(profileSkills.map((skill) => skill.id).filter(Boolean));
  const existingSkillIds = new Set(profileSkills.map((skill) => skill.skillId).filter(Boolean));

  return suggestions
    .map((suggestion) => {
      const skill = catalogByKey.get(suggestion.catalog_key);
      if (!skill || !skill.skillId) return null;
      if (existingKeys.has(skill.id) || existingSkillIds.has(skill.skillId)) return null;
      return {
        skill,
        reason: String(suggestion.reason || '').trim(),
      };
    })
    .filter(Boolean);
}

function matchFallbackRole(roleText) {
  const normalized = normalizeRole(roleText);
  if (!normalized) return null;

  return ROLE_PRESETS.find((role) => (
    normalizeRole(role.label) === normalized
    || role.aliases.some((alias) => normalizeRole(alias) === normalized)
    || role.aliases.some((alias) => normalized.includes(normalizeRole(alias)))
  )) || null;
}

function normalizeRole(value) {
  return normalizeSkillName(value);
}

function clampInteger(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
```

- [ ] **Step 2: Run helper tests**

Run: `npm run test -- test/role-suggestions.test.js`

Expected: PASS for all tests in `role-suggestions.test.js`.

- [ ] **Step 3: Run full unit suite**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 4: Commit helper and tests**

```bash
git add src/lib/app/role-suggestions.js test/role-suggestions.test.js
git commit -m "Add role suggestion helpers"
```

## Task 3: AI Proxy JSON Suggestion Path Tests

**Files:**
- Modify: `api/ai-proxy.js`
- Create: `test/ai-proxy-role-suggestions.test.js`

- [ ] **Step 1: Write failing proxy tests**

Create `test/ai-proxy-role-suggestions.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRoleSuggestionPrompt,
  handleRoleSuggestionRequest,
} from '../api/ai-proxy.js';
import { buildCatalogPayload } from '../src/lib/app/role-suggestions.js';
import { STANDARD_SKILLS } from '../src/lib/app/skill-catalog.js';

test('buildRoleSuggestionPrompt includes role, catalog keys, and JSON contract', () => {
  const prompt = buildRoleSuggestionPrompt({
    roleText: 'AI engineer',
    catalog: buildCatalogPayload(STANDARD_SKILLS).slice(0, 2),
    maxSuggestions: 8,
  });

  assert.match(prompt, /AI engineer/);
  assert.match(prompt, /catalog_key/);
  assert.match(prompt, /Return JSON only/i);
});

test('handleRoleSuggestionRequest validates Gemini output against supplied catalog', async () => {
  const response = await handleRoleSuggestionRequest({
    body: {
      roleText: 'AI engineer',
      catalog: buildCatalogPayload(STANDARD_SKILLS),
      maxSuggestions: 2,
    },
    apiKey: 'gemini-key',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                role: 'AI Engineer',
                suggestions: [
                  { catalog_key: 'aiml.rag', reason: 'RAG apps' },
                  { catalog_key: 'unknown.skill', reason: 'Unknown' },
                  { catalog_key: 'aiml.embeddings', reason: 'Vectors' },
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
      role: 'AI Engineer',
      suggestions: [
        { catalog_key: 'aiml.rag', reason: 'RAG apps' },
        { catalog_key: 'aiml.embeddings', reason: 'Vectors' },
      ],
    },
  });
});

test('handleRoleSuggestionRequest rejects missing role text', async () => {
  const response = await handleRoleSuggestionRequest({
    body: { roleText: '', catalog: buildCatalogPayload(STANDARD_SKILLS) },
    apiKey: 'gemini-key',
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'role_text_required');
});

test('handleRoleSuggestionRequest rejects missing API key', async () => {
  const response = await handleRoleSuggestionRequest({
    body: { roleText: 'AI engineer', catalog: buildCatalogPayload(STANDARD_SKILLS) },
    apiKey: '',
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    },
  });

  assert.equal(response.status, 500);
  assert.equal(response.body.error, 'missing_gemini_api_key');
});

test('handleRoleSuggestionRequest returns validation error for malformed Gemini JSON', async () => {
  const response = await handleRoleSuggestionRequest({
    body: { roleText: 'AI engineer', catalog: buildCatalogPayload(STANDARD_SKILLS) },
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
```

- [ ] **Step 2: Run proxy tests to verify they fail**

Run: `npm run test -- test/ai-proxy-role-suggestions.test.js`

Expected: FAIL because `buildRoleSuggestionPrompt` and `handleRoleSuggestionRequest` are not exported.

## Task 4: AI Proxy JSON Suggestion Path Implementation

**Files:**
- Modify: `api/ai-proxy.js`
- Test: `test/ai-proxy-role-suggestions.test.js`

- [ ] **Step 1: Update `api/ai-proxy.js` imports**

At the top of `api/ai-proxy.js`, add:

```js
import {
  parseRoleSuggestionText,
  validateRoleSuggestionPayload,
} from '../src/lib/app/role-suggestions.js';
```

Keep the existing `verifyRequest` import.

- [ ] **Step 2: Replace handler body with action routing**

Modify the default handler to route role suggestion requests before the old prompt path:

```js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const ctx = await verifyRequest(req);
  if (!ctx) return res.status(401).json({ error: 'unauthorized' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (req.body?.action === 'suggest_role_skills') {
    const result = await handleRoleSuggestionRequest({
      body: req.body,
      apiKey,
      fetchImpl: fetch,
    });
    return res.status(result.status).json(result.body);
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt required' });
  }

  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY chưa set' });

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );
  if (!r.ok) {
    const text = await r.text();
    return res.status(502).json({ error: 'upstream', detail: text });
  }
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return res.status(200).json({ text, workspaceId: ctx.workspaceId });
}
```

- [ ] **Step 3: Add exported helper functions below handler**

Add to `api/ai-proxy.js`:

```js
export function buildRoleSuggestionPrompt({ roleText, catalog, maxSuggestions }) {
  return [
    'You suggest software skills for a role.',
    'Return JSON only. Do not wrap it in markdown unless unavoidable.',
    'Only use catalog_key values from the provided catalog.',
    `Role: ${String(roleText).trim()}`,
    `Maximum suggestions: ${maxSuggestions}`,
    'JSON schema:',
    '{"role":"string","suggestions":[{"catalog_key":"string","reason":"short string"}]}',
    'Catalog:',
    JSON.stringify(catalog),
  ].join('\n');
}

export async function handleRoleSuggestionRequest({ body, apiKey, fetchImpl = fetch }) {
  const roleText = String(body?.roleText || '').trim().slice(0, 80);
  const catalog = Array.isArray(body?.catalog) ? body.catalog : [];
  const maxSuggestions = clampInteger(body?.maxSuggestions, 1, 12);
  const catalogKeys = new Set(catalog.map((skill) => String(skill?.key || '').trim()).filter(Boolean));

  if (!roleText) {
    return { status: 400, body: { error: 'role_text_required' } };
  }

  if (!catalog.length || !catalogKeys.size) {
    return { status: 400, body: { error: 'catalog_required' } };
  }

  if (!apiKey) {
    return { status: 500, body: { error: 'missing_gemini_api_key' } };
  }

  const prompt = buildRoleSuggestionPrompt({
    roleText,
    catalog: catalog.map((skill) => ({
      key: String(skill.key || '').trim(),
      name: String(skill.name || '').trim(),
      category: String(skill.category || '').trim(),
      skillType: String(skill.skillType || '').trim(),
      aliases: Array.isArray(skill.aliases) ? skill.aliases.map((alias) => String(alias).trim()).filter(Boolean).slice(0, 8) : [],
    })),
    maxSuggestions,
  });

  const upstream = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return { status: 502, body: { error: 'upstream', detail } };
  }

  const data = await upstream.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  try {
    const payload = parseRoleSuggestionText(text);
    return {
      status: 200,
      body: validateRoleSuggestionPayload({ payload, catalogKeys, maxSuggestions }),
    };
  } catch {
    return { status: 502, body: { error: 'invalid_ai_json' } };
  }
}

function clampInteger(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return max;
  return Math.max(min, Math.min(max, n));
}
```

- [ ] **Step 4: Run proxy tests**

Run: `npm run test -- test/ai-proxy-role-suggestions.test.js`

Expected: PASS.

- [ ] **Step 5: Run full unit suite**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 6: Commit proxy changes**

```bash
git add api/ai-proxy.js test/ai-proxy-role-suggestions.test.js
git commit -m "Add Gemini role skill suggestion proxy"
```

## Task 5: Client Role Suggestion Request and UI State

**Files:**
- Modify: `src/App.jsx`
- Modify later: `src/App.css`
- Test via build/manual browser.

- [ ] **Step 1: Update `App.jsx` imports**

Extend the import from `skill-map-data.js` unchanged, and add a new import below it:

```js
import {
  ROLE_PRESETS,
  buildCatalogPayload,
  filterSuggestedSkills,
  suggestRoleSkillsFallback,
} from './lib/app/role-suggestions.js';
import { STANDARD_SKILLS } from './lib/app/skill-catalog.js';
```

- [ ] **Step 2: Add suggestion state inside `ProfileScreen`**

Inside `ProfileScreen`, after existing `useState` declarations, add:

```js
  const [roleText, setRoleText] = useState('AI Engineer');
  const [roleSuggesting, setRoleSuggesting] = useState(false);
  const [roleSuggestionError, setRoleSuggestionError] = useState(null);
  const [roleSuggestionSource, setRoleSuggestionSource] = useState(null);
  const [roleSuggestions, setRoleSuggestions] = useState([]);
```

- [ ] **Step 3: Add suggestion helpers inside `ProfileScreen` before `return`**

Add:

```js
  const visibleRoleSuggestions = useMemo(() => filterSuggestedSkills({
    suggestions: roleSuggestions,
    profileSkillCatalog,
    profileSkills,
  }), [profileSkillCatalog, profileSkills, roleSuggestions]);

  function applyFallbackRoleSuggestions(nextRoleText) {
    const fallback = suggestRoleSkillsFallback(nextRoleText, STANDARD_SKILLS, 10);
    setRoleSuggestions(fallback);
    setRoleSuggestionSource(fallback.length ? 'fallback' : 'empty');
    return fallback;
  }

  async function requestRoleSuggestions(nextRoleText = roleText) {
    const trimmedRole = String(nextRoleText || '').trim();
    setRoleText(trimmedRole);
    setRoleSuggestionError(null);

    if (!trimmedRole) {
      setRoleSuggestions([]);
      setRoleSuggestionSource('empty');
      return;
    }

    setRoleSuggesting(true);
    try {
      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest_role_skills',
          roleText: trimmedRole,
          catalog: buildCatalogPayload(STANDARD_SKILLS),
          maxSuggestions: 10,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error || `role suggestion failed: ${response.status}`);
      }
      const suggestions = Array.isArray(json.suggestions) ? json.suggestions : [];
      setRoleSuggestions(suggestions);
      setRoleSuggestionSource(suggestions.length ? 'ai' : 'empty');
    } catch (suggestError) {
      setRoleSuggestionError(suggestError);
      applyFallbackRoleSuggestions(trimmedRole);
    } finally {
      setRoleSuggesting(false);
    }
  }

  function selectRoleSuggestion(skill) {
    setDraft((current) => ({
      ...current,
      customSkill: false,
      skillId: skill.id,
    }));
  }
```

- [ ] **Step 4: Render suggestion panel above `.skill-picker` for add mode**

Inside the `draft && <section className="skill-form">` block, after `.skill-form-head` and before `.skill-picker`, add:

```jsx
          {draft.mode === 'add' && (
            <section className="role-suggestion-panel" aria-label="Gợi ý kỹ năng theo role">
              <div className="role-suggestion-head">
                <label className="text-field">
                  <span>Role</span>
                  <input
                    value={roleText}
                    maxLength="80"
                    onChange={(event) => setRoleText(event.target.value)}
                    placeholder="Ví dụ: AI engineer, frontend dev..."
                  />
                </label>
                <button type="button" onClick={() => requestRoleSuggestions()} disabled={saving || roleSuggesting}>
                  {roleSuggesting ? 'Đang gợi ý...' : 'Gợi ý skill'}
                </button>
              </div>
              <div className="role-chip-row" aria-label="Role phổ biến">
                {ROLE_PRESETS.map((role) => (
                  <button
                    key={role.label}
                    type="button"
                    onClick={() => requestRoleSuggestions(role.label)}
                    disabled={saving || roleSuggesting}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
              {roleSuggestionError && roleSuggestionSource === 'fallback' && (
                <p className="role-suggestion-note">AI chưa sẵn sàng, đang dùng gợi ý mặc định.</p>
              )}
              {roleSuggestionSource === 'empty' && !roleSuggesting && (
                <p className="role-suggestion-note">Chưa tìm thấy gợi ý phù hợp trong catalog.</p>
              )}
              {visibleRoleSuggestions.length > 0 && (
                <div className="role-suggestion-results">
                  {visibleRoleSuggestions.map(({ skill, reason }) => (
                    <button
                      key={skill.id}
                      type="button"
                      className={draft.skillId === skill.id && !draft.customSkill ? 'active' : ''}
                      onClick={() => selectRoleSuggestion(skill)}
                    >
                      <SkillIcon skill={skill} compact />
                      <span>
                        <strong>{skill.name}</strong>
                        {reason && <small>{reason}</small>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
```

- [ ] **Step 5: Run build to catch JSX/import errors**

Run: `npm run build`

Expected: PASS.

## Task 6: Role Suggestion Panel Styling

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add compact panel styles near existing `.skill-form` styles**

Add:

```css
.role-suggestion-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
}

.role-suggestion-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
}

.role-suggestion-head button {
  min-height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: #64DFC4;
  color: #071312;
  font-weight: 800;
}

.role-suggestion-head button:disabled {
  opacity: 0.55;
}

.role-chip-row,
.role-suggestion-results {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.role-chip-row button {
  flex: 0 0 auto;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font-weight: 700;
}

.role-suggestion-results button {
  flex: 0 0 min(260px, 78vw);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-height: 58px;
  padding: 9px 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  text-align: left;
}

.role-suggestion-results button.active {
  border-color: #64DFC4;
  background: rgba(100, 223, 196, 0.14);
}

.role-suggestion-results strong,
.role-suggestion-results small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-suggestion-results small,
.role-suggestion-note {
  color: rgba(255, 255, 255, 0.68);
}

.role-suggestion-note {
  margin: 0;
  font-size: 13px;
}

@media (max-width: 520px) {
  .role-suggestion-head {
    grid-template-columns: 1fr;
  }

  .role-suggestion-head button {
    width: 100%;
  }
}
```

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Commit client UI changes**

```bash
git add src/App.jsx src/App.css
git commit -m "Add role suggestion panel"
```

## Task 7: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run full tests**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Start local dev server**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite reports a local URL, typically `http://127.0.0.1:5173/`.

- [ ] **Step 4: Browser visual pass**

Open the local URL in the in-app browser. Verify:

- The app loads or shows the existing Mushy shell-required state if no app context is available.
- In a valid Mushy context, opening `Cá nhân` and `+ Thêm kỹ năng` shows the role suggestion panel.
- Role chips fit on mobile width and scroll horizontally.
- Empty/error/fallback notes do not overlap the form.
- Selecting a suggestion highlights/selects the same skill in the normal picker.

- [ ] **Step 5: Final status check**

Run: `git status --short`

Expected: only intentional changes are committed, with unrelated pre-existing untracked files left untouched.
