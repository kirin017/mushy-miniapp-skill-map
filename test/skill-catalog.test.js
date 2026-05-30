import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CATALOG_CATEGORIES,
  CATALOG_SKILL_TYPES,
  STANDARD_SKILLS,
  normalizeSkillName,
  validateStandardCatalog,
} from '../src/lib/app/skill-catalog.js';

test('standard catalog has medium-sized unique approved entries', () => {
  const result = validateStandardCatalog(STANDARD_SKILLS);

  assert.deepEqual(result, { ok: true, errors: [] });
  assert.equal(STANDARD_SKILLS.length >= 50, true);
  assert.equal(STANDARD_SKILLS.length <= 70, true);
  assert.equal(new Set(STANDARD_SKILLS.map((skill) => skill.key)).size, STANDARD_SKILLS.length);
  assert.equal(STANDARD_SKILLS.every((skill) => skill.status === 'approved'), true);
});

test('standard catalog uses only known categories and skill types', () => {
  const categories = new Set(CATALOG_CATEGORIES);
  const types = new Set(CATALOG_SKILL_TYPES);

  assert.equal(STANDARD_SKILLS.every((skill) => categories.has(skill.category)), true);
  assert.equal(STANDARD_SKILLS.every((skill) => types.has(skill.skillType)), true);
});

test('standard catalog aliases are unique after normalization', () => {
  const seen = new Map();

  for (const skill of STANDARD_SKILLS) {
    for (const label of [skill.name, ...skill.aliases]) {
      const normalized = normalizeSkillName(label);
      assert.equal(seen.has(normalized), false, `${label} duplicates ${seen.get(normalized)}`);
      seen.set(normalized, skill.key);
    }
  }
});

test('normalizeSkillName handles accents, separators, and common punctuation', () => {
  assert.equal(normalizeSkillName('  React.js  '), 'reactjs');
  assert.equal(normalizeSkillName('CI / CD'), 'cicd');
  assert.equal(normalizeSkillName('Kiểm thử tự động'), 'kiemthutudong');
  assert.equal(normalizeSkillName('PostgreSQL'), 'postgresql');
});
