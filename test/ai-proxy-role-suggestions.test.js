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
