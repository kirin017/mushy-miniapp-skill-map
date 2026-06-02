import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCoachLevelPlanPrompt,
  buildRoleSuggestionPrompt,
  handleGenericPromptRequest,
  handleCoachLevelPlanRequest,
  handleRoleSuggestionRequest,
} from '../api/ai-proxy.js';
import { buildCatalogPayload } from '../src/lib/app/role-suggestions.js';
import { STANDARD_SKILLS } from '../src/lib/app/skill-catalog.js';

const coachProfileSkills = [
  { skill_id: 'react', name: 'React', category: 'Frontend', level: 2, interest: 3, note: 'UI work' },
  { skill_id: 'node', name: 'Node.js', category: 'Backend', level: 1, interest: 2, note: 'APIs' },
  { skill_id: 'sql', name: 'Postgres', category: 'Data', level: 3, interest: 1, note: 'Queries' },
];

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

test('buildCoachLevelPlanPrompt includes personal coaching inputs and JSON-only contract', () => {
  const prompt = buildCoachLevelPlanPrompt({
    goalText: 'Become a senior frontend engineer',
    profileSkills: coachProfileSkills,
    levelLabels: ['None', 'Basic', 'Working', 'Advanced', 'Expert'],
    maxItems: 3,
  });

  assert.match(prompt, /personal skill coach for one user/i);
  assert.match(prompt, /Become a senior frontend engineer/);
  assert.match(prompt, /"skill_id": "react"/);
  assert.match(prompt, /target_level/);
  assert.match(prompt, /Return JSON only/i);
  assert.match(prompt, /None/);
  assert.match(prompt, /Basic/);
  assert.doesNotMatch(prompt, /workspace/i);
  assert.doesNotMatch(prompt, /team coverage/i);
});

test('handleGenericPromptRequest preserves the legacy prompt proxy behavior', async () => {
  let requestBody;
  const response = await handleGenericPromptRequest({
    body: { prompt: 'Say hello' },
    apiKey: 'gemini-key',
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Hello from Gemini' }] } }],
        }),
      };
    },
  });

  assert.deepEqual(requestBody, {
    contents: [{ parts: [{ text: 'Say hello' }] }],
  });
  assert.deepEqual(response, {
    status: 200,
    body: { text: 'Hello from Gemini' },
  });
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
                  { catalog_key: 'aiml.llm_integration', reason: 'LLM APIs' },
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

test('handleCoachLevelPlanRequest validates Gemini output against personal skills and maxItems', async () => {
  const response = await handleCoachLevelPlanRequest({
    body: {
      goalText: 'Grow into frontend leadership',
      profileSkills: coachProfileSkills,
      levelLabels: ['None', 'Basic', 'Working', 'Advanced', 'Expert'],
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
                summary: 'Focus on visible frontend and backend growth',
                items: [
                  { skill_id: 'react', current_level: 2, target_level: 3, reason: 'Lead UI delivery', next_step: 'Ship a component system improvement' },
                  { skill_id: 'unknown', current_level: 0, target_level: 1, reason: 'Unknown skill', next_step: 'Skip this' },
                  { skill_id: 'node', current_level: 1, target_level: 2, reason: 'Support API decisions', next_step: 'Own one endpoint change' },
                  { skill_id: 'sql', current_level: 3, target_level: 4, reason: 'Analyze product data', next_step: 'Tune one reporting query' },
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
      summary: 'Focus on visible frontend and backend growth',
      items: [
        { skill_id: 'react', current_level: 2, target_level: 3, reason: 'Lead UI delivery', next_step: 'Ship a component system improvement' },
        { skill_id: 'node', current_level: 1, target_level: 2, reason: 'Support API decisions', next_step: 'Own one endpoint change' },
      ],
    },
  });
});

test('handleCoachLevelPlanRequest rejects empty goal before Gemini call', async () => {
  const response = await handleCoachLevelPlanRequest({
    body: { goalText: '   ', profileSkills: coachProfileSkills },
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
    body: { goalText: 'Reach level 3', profileSkills: [] },
    apiKey: 'gemini-key',
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'profile_skills_required');
});

test('handleCoachLevelPlanRequest rejects non-array personal skills before Gemini call', async () => {
  let fetchCalls = 0;
  const response = await handleCoachLevelPlanRequest({
    body: { goalText: 'Reach level 3', profileSkills: {} },
    apiKey: 'gemini-key',
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('fetch should not be called');
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'profile_skills_required');
  assert.equal(fetchCalls, 0);
});

test('handleCoachLevelPlanRequest returns invalid_ai_json for malformed Gemini text', async () => {
  const response = await handleCoachLevelPlanRequest({
    body: { goalText: 'Reach level 3', profileSkills: coachProfileSkills },
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

test('handleCoachLevelPlanRequest returns invalid_coach_plan when no items survive validation', async () => {
  const response = await handleCoachLevelPlanRequest({
    body: { goalText: 'Reach level 3', profileSkills: coachProfileSkills },
    apiKey: 'gemini-key',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                summary: 'No valid items',
                items: [
                  { skill_id: 'unknown', current_level: 0, target_level: 1 },
                  { skill_id: 'react', current_level: 2, target_level: 2 },
                ],
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

test('handleRoleSuggestionRequest rejects arbitrary client catalog keys', async () => {
  const response = await handleRoleSuggestionRequest({
    body: {
      roleText: 'AI engineer',
      catalog: [{ key: 'attacker.skill', name: 'Owned' }],
    },
    apiKey: 'gemini-key',
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'catalog_required');
});

test('handleRoleSuggestionRequest uses server-owned catalog metadata for submitted keys', async () => {
  let requestBody;
  const response = await handleRoleSuggestionRequest({
    body: {
      roleText: 'AI engineer',
      catalog: [{ key: 'aiml.rag', name: 'Client Controlled Name', aliases: ['Injected Alias'] }],
      maxSuggestions: 1,
    },
    apiKey: 'gemini-key',
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  role: 'AI Engineer',
                  suggestions: [{ catalog_key: 'aiml.rag', reason: 'Relevant retrieval work' }],
                }),
              }],
            },
          }],
        }),
      };
    },
  });

  const prompt = requestBody.contents[0].parts[0].text;

  assert.equal(response.status, 200);
  assert.match(prompt, /"name": "RAG"/);
  assert.doesNotMatch(prompt, /Client Controlled Name/);
  assert.doesNotMatch(prompt, /Injected Alias/);
});

test('handleRoleSuggestionRequest rejects oversized role text before Gemini call', async () => {
  const response = await handleRoleSuggestionRequest({
    body: {
      roleText: 'A'.repeat(5000),
      catalog: buildCatalogPayload(STANDARD_SKILLS),
    },
    apiKey: 'gemini-key',
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'prompt_too_large');
});

test('handleRoleSuggestionRequest returns structured error when Gemini fetch fails', async () => {
  const response = await handleRoleSuggestionRequest({
    body: { roleText: 'AI engineer', catalog: buildCatalogPayload(STANDARD_SKILLS) },
    apiKey: 'gemini-key',
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });

  assert.equal(response.status, 502);
  assert.equal(response.body.error, 'upstream_fetch_failed');
});

test('handleRoleSuggestionRequest returns structured error when Gemini JSON is invalid', async () => {
  const response = await handleRoleSuggestionRequest({
    body: { roleText: 'AI engineer', catalog: buildCatalogPayload(STANDARD_SKILLS) },
    apiKey: 'gemini-key',
    fetchImpl: async () => ({
      ok: true,
      json: async () => {
        throw new Error('bad upstream json');
      },
    }),
  });

  assert.equal(response.status, 502);
  assert.equal(response.body.error, 'upstream_json_invalid');
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
