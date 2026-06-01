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
  const catalogByKey = new Map(profileSkillCatalog.map((skill) => [skill.catalogKey || skill.id, skill]));
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
