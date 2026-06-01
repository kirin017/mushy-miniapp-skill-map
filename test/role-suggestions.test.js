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

test('validateRoleSuggestionPayload trims long reasons', () => {
  const validated = validateRoleSuggestionPayload({
    payload: {
      role: 'AI Engineer',
      suggestions: [
        { catalog_key: 'aiml.rag', reason: 'x'.repeat(300) },
      ],
    },
    catalogKeys,
    maxSuggestions: 10,
  });

  assert.deepEqual(validated, {
    role: 'AI Engineer',
    suggestions: [
      { catalog_key: 'aiml.rag', reason: 'x'.repeat(160) },
    ],
  });
});

test('validateRoleSuggestionPayload handles no usable keys as empty success', () => {
  const validated = validateRoleSuggestionPayload({
    payload: {
      role: 'Mystery',
      suggestions: [
        { catalog_key: 'unknown.skill', reason: 'No usable key' },
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
    { id: 'rag', catalogKey: 'aiml.rag', skillId: 'skill-rag', name: 'RAG' },
    { id: 'embeddings', catalogKey: 'aiml.embeddings', skillId: 'skill-embeddings', name: 'Embeddings' },
  ];
  const profileSkills = [{ id: 'rag' }, { skillId: 'skill-other' }];

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
        skill: { id: 'embeddings', catalogKey: 'aiml.embeddings', skillId: 'skill-embeddings', name: 'Embeddings' },
        reason: 'Useful for search',
      },
    ],
  );
});
